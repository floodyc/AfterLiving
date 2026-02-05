# -*- coding: utf-8 -*-
"""
GEM-AI Web API - FastAPI Backend
Full integration with HVACPlus features
"""

import io
import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from PIL import Image

from gem_ai.detector import detect_rooms, detect_rooms_advanced, SAM_AVAILABLE, load_sam_model
from gem_ai.exporter import GbXMLWriter, export_obj
from gem_ai.scale import detect_scale

# Import API routes from HVACPlus integration
from app.api import api_router
from app.core.config import settings

app = FastAPI(
    title="GEM-AI API",
    description="AI-powered floorplan to 3D geometry conversion with HVAC load calculations",
    version="2.0.0"
)

# Include API routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# CORS - allow all origins for now
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temp storage for results
RESULTS_DIR = Path(tempfile.gettempdir()) / "gem-ai-results"
RESULTS_DIR.mkdir(exist_ok=True)


@app.on_event("startup")
async def preload_sam_model():
    """Preload SAM model at startup to avoid timeout on first request."""
    print(f"[STARTUP] SAM_AVAILABLE={SAM_AVAILABLE}", flush=True)
    if SAM_AVAILABLE:
        print("[STARTUP] Preloading SAM model...", flush=True)
        try:
            load_sam_model("vit_b")
            print("[STARTUP] SAM model loaded successfully!", flush=True)
        except Exception as e:
            print(f"[STARTUP] Failed to preload SAM model: {e}", flush=True)
    else:
        print("[STARTUP] SAM not available, skipping preload", flush=True)


@app.get("/")
async def root():
    return {
        "service": "GEM-AI API",
        "version": "2.0.0",
        "sam_available": SAM_AVAILABLE,
        "features": [
            "AI floorplan analysis (SAM + Classical CV)",
            "HVAC load calculations (ASHRAE)",
            "User authentication",
            "Project management",
            "Credits system",
            "Multi-story building support",
            "AI-powered space classification",
            "Interactive correction tools",
            "Batch processing (ZIP upload)",
            "Material/construction assignment",
            "Version history & comparison",
            "Collaboration (multi-user, comments)",
            "Shade/overhang detection",
            "Thermal zoning recommendations",
            "ASHRAE 90.1 compliance checking",
            "Custom report templates",
            "Project templates"
        ],
        "endpoints": {
            "POST /analyze": "Upload floorplan for analysis",
            "GET /result/{job_id}": "Get analysis results",
            "GET /download/{job_id}/{file}": "Download output files",
            "/api/v1/auth/*": "Authentication endpoints",
            "/api/v1/projects/*": "Project management",
            "/api/v1/calculations/*": "HVAC calculations",
            "/api/v1/projects/{id}/floors/*": "Multi-story floor management",
            "/api/v1/projects/{id}/classify-spaces": "AI space classification",
            "/api/v1/projects/{id}/batch/*": "Batch processing",
            "/api/v1/projects/{id}/corrections/*": "Interactive corrections",
            "/api/v1/projects/{id}/constructions": "Materials & constructions",
            "/api/v1/projects/{id}/versions/*": "Version history",
            "/api/v1/projects/{id}/collaborators/*": "Collaboration",
            "/api/v1/projects/{id}/compliance/*": "Code compliance",
            "/api/v1/projects/{id}/zoning/*": "Thermal zoning",
            "/api/v1/projects/templates/*": "Project templates",
            "/api/v1/report-templates/*": "Report templates"
        }
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "sam_available": SAM_AVAILABLE}


@app.options("/analyze")
async def analyze_options():
    """Explicit OPTIONS handler for CORS preflight."""
    return JSONResponse(
        content={"status": "ok"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )


@app.get("/test-cors")
async def test_cors():
    """Simple endpoint to test CORS is working."""
    return {"cors": "working", "sam_available": SAM_AVAILABLE}


@app.post("/analyze")
async def analyze_floorplan(
    file: UploadFile = File(...),
    pixels_per_metre: Optional[float] = Form(None),
    floor_height: float = Form(3.0),
    use_sam: bool = Form(True),
    building_name: str = Form("Building")
):
    """
    Analyze a floorplan image and detect rooms.
    Returns job_id for retrieving results.
    """
    print(f"[ANALYZE] Request received - use_sam={use_sam}, SAM_AVAILABLE={SAM_AVAILABLE}", flush=True)

    job_id = str(uuid.uuid4())[:8]
    job_dir = RESULTS_DIR / job_id
    job_dir.mkdir(exist_ok=True)

    start_time = time.time()

    try:
        # Read uploaded image
        print(f"[ANALYZE] Reading uploaded file...", flush=True)
        contents = await file.read()
        print(f"[ANALYZE] File read: {len(contents)} bytes", flush=True)
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape

        # Save input image
        cv2.imwrite(str(job_dir / "input.png"), image)

        # Scale detection
        if pixels_per_metre is None:
            scale_result = detect_scale(gray)
            ppm = scale_result.pixels_per_metre
            scale_info = {
                "detected": scale_result.scale_text,
                "pixels_per_metre": ppm,
                "confidence": scale_result.confidence
            }
        else:
            ppm = pixels_per_metre
            scale_info = {
                "detected": "user_provided",
                "pixels_per_metre": ppm,
                "confidence": "user"
            }

        # Room detection - use trained floorplan model as primary, fall back to hybrid
        print(f"[ANALYZE] Starting room detection with floorplan model...", flush=True)
        rooms_px = detect_rooms_advanced(
            image, gray,
            method="floorplan",
            use_sam=use_sam and SAM_AVAILABLE,
            debug_dir=job_dir
        )

        # Fall back to hybrid SAM+CV if floorplan model found nothing
        if not rooms_px:
            print(f"[ANALYZE] Floorplan model found no rooms, falling back to hybrid...", flush=True)
            rooms_px = detect_rooms(
                image, gray,
                use_sam=use_sam and SAM_AVAILABLE,
                debug_dir=job_dir
            )
        print(f"[ANALYZE] Room detection complete: {len(rooms_px)} rooms found", flush=True)

        if not rooms_px:
            raise HTTPException(status_code=422, detail="No rooms detected in image")

        # Convert to metres
        rooms_m = []
        for r in rooms_px:
            x, y, w, h = r["x"], r["y"], r["w"], r["h"]
            y_flipped = (height - y - h) / ppm
            rooms_m.append({
                "x": x / ppm,
                "y": y_flipped,
                "width": w / ppm,
                "height": h / ppm,
                "area_m2": (w / ppm) * (h / ppm)
            })

        total_area = sum(r["area_m2"] for r in rooms_m)

        # Generate gbXML
        gbxml = GbXMLWriter(building_name=building_name)
        for i, room in enumerate(rooms_m, start=1):
            aspect = max(room["width"], room["height"]) / max(0.1, min(room["width"], room["height"]))
            room_type = "Corridor" if aspect > 5 else "Circulation" if aspect > 3 else "Room"

            gbxml.add_space(
                space_id=f"space-{i:03d}",
                name=f"{room_type}_{i:03d}",
                x=room["x"], y=room["y"], z=0.0,
                width=room["width"],
                depth=room["height"],
                height=floor_height
            )

        gbxml.save(job_dir / "floorplan.xml")

        # Generate OBJ
        export_obj(rooms_m, floor_height, job_dir / "floorplan.obj")

        # Create debug visualization
        debug_img = image.copy()
        for i, r in enumerate(rooms_px, 1):
            x, y, w, h = r["x"], r["y"], r["w"], r["h"]
            cv2.rectangle(debug_img, (x, y), (x + w, y + h), (0, 255, 0), 2)
            cv2.putText(debug_img, f"#{i}", (x + 5, y + 25),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.imwrite(str(job_dir / "preview.png"), debug_img)

        elapsed = time.time() - start_time

        # Save results JSON
        result = {
            "job_id": job_id,
            "status": "success",
            "processing_time_sec": round(elapsed, 2),
            "method": "SAM" if (use_sam and SAM_AVAILABLE) else "Classical CV",
            "scale": scale_info,
            "image_size": {"width": width, "height": height},
            "rooms_detected": len(rooms_m),
            "total_area_m2": round(total_area, 1),
            "floor_height_m": floor_height,
            "rooms": rooms_m,
            "files": {
                "preview": f"/download/{job_id}/preview.png",
                "gbxml": f"/download/{job_id}/floorplan.xml",
                "obj": f"/download/{job_id}/floorplan.obj",
                "input": f"/download/{job_id}/input.png"
            }
        }

        (job_dir / "result.json").write_text(json.dumps(result, indent=2))

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/result/{job_id}")
async def get_result(job_id: str):
    """Get results for a completed job."""
    job_dir = RESULTS_DIR / job_id
    result_file = job_dir / "result.json"

    if not result_file.exists():
        raise HTTPException(status_code=404, detail="Job not found")

    return json.loads(result_file.read_text())


@app.get("/download/{job_id}/{filename}")
async def download_file(job_id: str, filename: str):
    """Download an output file."""
    job_dir = RESULTS_DIR / job_id
    file_path = job_dir / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    media_types = {
        ".png": "image/png",
        ".xml": "application/xml",
        ".obj": "text/plain",
        ".json": "application/json"
    }

    suffix = file_path.suffix.lower()
    media_type = media_types.get(suffix, "application/octet-stream")

    return FileResponse(
        file_path,
        media_type=media_type,
        filename=filename
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
