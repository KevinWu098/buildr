"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, RefreshCwIcon, CheckIcon, LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelHeader } from "@/components/main/panel-header";

interface PartPhotoProps {
  onBack?: () => void;
  onPhotoCapture?: (photoDataUrl: string) => void;
  onComplete?: () => void;
}

export function PartPhoto({
  onBack,
  onPhotoCapture,
  onComplete,
}: PartPhotoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Failed to access camera:", err);
      setCameraError("Could not access camera. Please grant permission.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedPhoto(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedPhoto(null);
    startCamera();
  }, [startCamera]);

  const confirmPhoto = useCallback(async () => {
    if (!capturedPhoto) return;

    setIsProcessing(true);

    if (onPhotoCapture) {
      onPhotoCapture(capturedPhoto);
    }

    // TODO: Send API request here
    // const response = await fetch('/api/analyze-part', { ... });

    // Simulate API delay, then transition
    await new Promise((resolve) => setTimeout(resolve, 5000));

    if (onComplete) {
      onComplete();
    }
  }, [capturedPhoto, onPhotoCapture, onComplete]);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full flex-col overflow-hidden"
    >
      <PanelHeader title="Part Photo" onBack={onBack} />

      <div className="flex max-w-full flex-1 flex-col justify-between gap-6 overflow-hidden p-4">
        <div className="flex max-w-full flex-1 flex-col items-center justify-center overflow-hidden">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <LoaderIcon className="text-primary size-10 animate-spin" />
              <p className="text-muted-foreground">Analyzing...</p>
            </div>
          ) : cameraError ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-muted-foreground">{cameraError}</p>
              <Button onClick={startCamera}>
                <CameraIcon className="size-4" />
                Try Again
              </Button>
            </div>
          ) : capturedPhoto ? (
            <img
              src={capturedPhoto}
              alt="Captured part"
              className="aspect-9/16 h-fit max-h-full max-w-full -scale-x-100 rounded-lg object-cover object-center"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-9/16 h-fit max-h-full max-w-full -scale-x-100 rounded-lg object-cover object-center"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="flex w-full flex-row justify-center gap-2">
          {isProcessing ? null : capturedPhoto ? (
            <>
              <Button
                variant="outline"
                onClick={retakePhoto}
                size="lg"
                className="text-lg"
              >
                <RefreshCwIcon className="size-4" />
                Retake
              </Button>
              <Button onClick={confirmPhoto} size="lg" className="text-lg">
                <CheckIcon className="size-4" />
                Use Photo
              </Button>
            </>
          ) : (
            <Button
              onClick={capturePhoto}
              disabled={!stream}
              size="lg"
              className="text-lg"
            >
              <CameraIcon className="size-4" />
              Capture
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
