# -*- coding: utf-8 -*-
"""
Custom Floor Plan Segmentation Model
Trained on CubiCasa5K dataset
"""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

TORCH_AVAILABLE = False
TORCH_IMPORT_ERROR = None

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torchvision import models
    TORCH_AVAILABLE = True
except ImportError as e:
    TORCH_IMPORT_ERROR = str(e)

ROOM_CATEGORIES = {
    0: "background", 1: "outdoor", 2: "wall", 3: "kitchen",
    4: "living_room", 5: "bedroom", 6: "bathroom", 7: "hallway",
    8: "storage", 9: "garage", 10: "other",
}
NUM_CLASSES = len(ROOM_CATEGORIES)

def get_model_cache_dir():
    return Path(__file__).parent / "models"

class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU(inplace=True),
        )
    def forward(self, x):
        return self.conv(x)

class DecoderBlock(nn.Module):
    def __init__(self, in_ch, skip_ch, out_ch):
        super().__init__()
        self.up = nn.ConvTranspose2d(in_ch, out_ch, kernel_size=2, stride=2)
        self.conv = ConvBlock(out_ch + skip_ch, out_ch)
    def forward(self, x, skip):
        x = self.up(x)
        if x.shape[2:] != skip.shape[2:]:
            x = F.interpolate(x, size=skip.shape[2:], mode='bilinear', align_corners=True)
        return self.conv(torch.cat([x, skip], dim=1))

class ResNetUNet(nn.Module):
    def __init__(self, num_classes=11, pretrained=False):
        super().__init__()
        weights = models.ResNet34_Weights.IMAGENET1K_V1 if pretrained else None
        resnet = models.resnet34(weights=weights)
        self.enc1 = nn.Sequential(resnet.conv1, resnet.bn1, resnet.relu)
        self.enc2 = nn.Sequential(resnet.maxpool, resnet.layer1)
        self.enc3 = resnet.layer2
        self.enc4 = resnet.layer3
        self.enc5 = resnet.layer4
        self.dec5 = DecoderBlock(512, 256, 256)
        self.dec4 = DecoderBlock(256, 128, 128)
        self.dec3 = DecoderBlock(128, 64, 64)
        self.dec2 = DecoderBlock(64, 64, 64)
        self.final_up = nn.ConvTranspose2d(64, 32, kernel_size=2, stride=2)
        self.final_conv = nn.Sequential(ConvBlock(32, 32), nn.Conv2d(32, num_classes, kernel_size=1))

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(e1)
        e3 = self.enc3(e2)
        e4 = self.enc4(e3)
        e5 = self.enc5(e4)
        d5 = self.dec5(e5, e4)
        d4 = self.dec4(d5, e3)
        d3 = self.dec3(d4, e2)
        d2 = self.dec2(d3, e1)
        return self.final_conv(self.final_up(d2))

class FloorPlanSegmentationModel:
    def __init__(self, model_path=None, device=None, image_size=512):
        if not TORCH_AVAILABLE:
            raise RuntimeError(f"PyTorch not available: {TORCH_IMPORT_ERROR}")
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.image_size = image_size
        self.model = ResNetUNet(num_classes=NUM_CLASSES, pretrained=False)
        if model_path is None:
            model_path = get_model_cache_dir() / "best_model.pt"
        if Path(model_path).exists():
            print(f"[FloorPlanModel] Loading weights from {model_path}")
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))
        else:
            print(f"[FloorPlanModel] WARNING: No weights at {model_path}")
        self.model = self.model.to(self.device)
        self.model.eval()
        self.mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1).to(self.device)
        self.std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1).to(self.device)
        print(f"[FloorPlanModel] Initialized on {self.device}")

    @torch.no_grad()
    def predict(self, image):
        orig_size = image.shape[:2]
        img = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (self.image_size, self.image_size))
        tensor = torch.from_numpy(img).float().permute(2, 0, 1).unsqueeze(0) / 255.0
        tensor = (tensor.to(self.device) - self.mean) / self.std
        pred = self.model(tensor).argmax(dim=1).squeeze(0).cpu().numpy().astype(np.uint8)
        return cv2.resize(pred, (orig_size[1], orig_size[0]), interpolation=cv2.INTER_NEAREST)

    def extract_rooms_from_mask(self, mask, min_area=500):
        rooms = []
        for class_id in range(NUM_CLASSES):
            if class_id in [0, 2]: continue
            class_mask = (mask == class_id).astype(np.uint8) * 255
            contours, _ = cv2.findContours(class_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for contour in contours:
                area = cv2.contourArea(contour)
                if area >= min_area:
                    x, y, w, h = cv2.boundingRect(contour)
                    rooms.append({"x": int(x), "y": int(y), "w": int(w), "h": int(h), 
                                  "class_name": ROOM_CATEGORIES.get(class_id, "other")})
        return rooms

def detect_rooms_floorplan_model(image, model=None, min_area=500):
    if not TORCH_AVAILABLE:
        return []
    try:
        if model is None:
            model = load_floorplan_model()
        mask = model.predict(image)
        return model.extract_rooms_from_mask(mask, min_area)
    except Exception as e:
        print(f"[FloorPlanModel] Detection failed: {e}")
        return []

_floorplan_model_cache = {}

def load_floorplan_model(model_path=None):
    global _floorplan_model_cache
    key = model_path or "default"
    if key not in _floorplan_model_cache:
        _floorplan_model_cache[key] = FloorPlanSegmentationModel(model_path=model_path)
    return _floorplan_model_cache[key]
