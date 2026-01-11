"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, RefreshCwIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelHeader } from "@/components/main/panel-header";
import {
  PanelShell,
  PanelContent,
  PanelFooter,
} from "@/components/main/panel-shell";
import { Skeleton } from "@/components/ui/skeleton";

interface PartPhotoProps {
  onBack?: () => void;
  onConfirm?: (photoDataUrl: string) => void;
}

export function PartPhoto({ onBack, onConfirm }: PartPhotoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  const startCamera = useCallback(async () => {
    setCameraStarted(true);
    setCameraError(null);

    // Check if camera API is available (requires HTTPS)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not available. Make sure you're using HTTPS.");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
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

  const confirmPhoto = useCallback(() => {
    if (!capturedPhoto) return;
    onConfirm?.(capturedPhoto);
  }, [capturedPhoto, onConfirm]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <PanelShell>
      <PanelHeader title="Part Photo" onBack={onBack} />

      <PanelContent className="items-center justify-center">
        {!cameraStarted ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-muted-foreground">
              Take a photo of your PC parts to get started
            </p>
            <Button onClick={startCamera} size="lg" className="text-lg">
              <CameraIcon className="size-4" />
              Start Camera
            </Button>
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
            className="aspect-9/16 h-fit max-h-full max-w-full rounded-lg object-cover object-center"
          />
        ) : (
          <div className="relative aspect-9/16 h-fit max-h-full max-w-full overflow-hidden rounded-lg">
            {/* Loading skeleton */}
            {!stream && <Skeleton className="absolute inset-0" />}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover object-center"
            />
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </PanelContent>

      {cameraStarted && (
        <PanelFooter className="justify-center">
          {capturedPhoto ? (
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
        </PanelFooter>
      )}
    </PanelShell>
  );
}
