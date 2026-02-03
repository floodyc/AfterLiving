'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

interface VideoRecorderProps {
  messageId: string;
  onUploadComplete: () => void;
}

type RecordingState = 'idle' | 'recording' | 'stopped' | 'uploading';

export function VideoRecorder({ messageId, onUploadComplete }: VideoRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingType, setRecordingType] = useState<'video' | 'audio'>('video');

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      setError('');

      const constraints = recordingType === 'video'
        ? { video: true, audio: true }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current && recordingType === 'video') {
        videoRef.current.srcObject = stream;
      }

      const mimeType = recordingType === 'video'
        ? 'video/webm;codecs=vp9,opus'
        : 'audio/webm;codecs=opus';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recordingType === 'video' ? 'video/webm' : 'audio/webm'
        });
        await uploadRecording(blob);
      };

      mediaRecorder.start(1000);
      setState('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'Failed to access camera/microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setState('stopped');
      stopStream();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const uploadRecording = async (blob: Blob) => {
    try {
      setState('uploading');
      setProgress(0);

      const urlResponse = await api.post(`/api/uploads/${messageId}/url`, {
        filename: `recording-${Date.now()}.webm`,
        contentType: blob.type,
        size: blob.size,
      });

      const { uploadUrl, storageKey } = urlResponse.data.data;

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(Math.round(percentComplete));
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          await api.post(`/api/uploads/${messageId}/finalize`, {
            storageKey,
          });

          setState('idle');
          setProgress(0);
          onUploadComplete();
        } else {
          throw new Error('Upload failed');
        }
      });

      xhr.addEventListener('error', () => {
        setError('Upload failed. Please try again.');
        setState('idle');
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', blob.type);
      xhr.send(blob);

    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Upload failed');
      setState('idle');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {state === 'idle' && (
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setRecordingType('video')}
            className={`flex-1 px-4 py-2 rounded-lg border-2 transition ${
              recordingType === 'video'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            📹 Video Message
          </button>
          <button
            onClick={() => setRecordingType('audio')}
            className={`flex-1 px-4 py-2 rounded-lg border-2 transition ${
              recordingType === 'audio'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            🎤 Audio Message
          </button>
        </div>
      )}

      {recordingType === 'video' && (state === 'recording' || state === 'stopped') && (
        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {recordingType === 'audio' && state === 'recording' && (
        <div className="aspect-video bg-gradient-to-br from-blue-900 to-purple-900 rounded-lg flex items-center justify-center">
          <div className="text-center text-white">
            <div className="text-6xl mb-4 animate-pulse">🎤</div>
            <p className="text-xl">Recording audio...</p>
            <p className="text-3xl font-mono mt-2">{formatTime(recordingTime)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-center">
        {state === 'idle' && (
          <button
            onClick={startRecording}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2"
          >
            <span className="w-3 h-3 bg-white rounded-full"></span>
            Start Recording
          </button>
        )}

        {state === 'recording' && (
          <>
            <div className="flex items-center gap-2 text-red-600 font-mono text-xl">
              <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></span>
              {formatTime(recordingTime)}
            </div>
            <button
              onClick={stopRecording}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              ⏹ Stop Recording
            </button>
          </>
        )}

        {state === 'uploading' && (
          <div className="w-full">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Uploading...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500 text-center">
        {state === 'idle' && (
          <p>Click "Start Recording" to begin. Your message will be encrypted and stored securely.</p>
        )}
        {state === 'recording' && (
          <p>Recording in progress. Click "Stop Recording" when done.</p>
        )}
        {state === 'uploading' && (
          <p>Uploading your message securely...</p>
        )}
      </div>
    </div>
  );
}
