"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CameraOffIcon,
  VideoIcon,
  Loader2Icon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useYoloInference } from "@/hooks/use-yolo-inference";

type ConnectionState =
  | "idle"
  | "requesting_camera"
  | "loading_model"
  | "connected"
  | "error";

interface CameraFeedProps {
  className?: string;
  active?: boolean;
}

export function CameraFeed({ className, active = true }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inferenceEnabled =
    connectionState === "loading_model" || connectionState === "connected";

  const {
    isRunning,
    fps,
    detections,
    error: modelError,
  } = useYoloInference({
    videoRef,
    canvasRef,
    enabled: inferenceEnabled,
  });

  // Transition to "connected" when inference starts running
  useEffect(() => {
    if (isRunning && connectionState === "loading_model") {
      setConnectionState("connected");
    }
  }, [isRunning, connectionState]);

  // Handle model errors
  useEffect(() => {
    if (modelError) {
      setConnectionState("error");
      setErrorMessage(modelError);
    }
  }, [modelError]);

  // Compute the CSS position/size of the canvas to match the letterboxed video area.
  // The hook owns canvas pixel dimensions (synced from video in runFrame).
  // This callback only sets CSS dimensions so the canvas aligns with the video display.
  const updateCanvasBounds = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const cW = container.clientWidth;
    const cH = container.clientHeight;
    if (!vW || !vH || !cW || !cH) return;

    // Replicate object-contain: scale uniformly to fit, centered (letterboxed)
    const scale = Math.min(cW / vW, cH / vH);
    const dW = Math.round(vW * scale);
    const dH = Math.round(vH * scale);
    const left = Math.round((cW - dW) / 2);
    const top = Math.round((cH - dH) / 2);

    canvas.style.left = `${left}px`;
    canvas.style.top = `${top}px`;
    canvas.style.width = `${dW}px`;
    canvas.style.height = `${dH}px`;
  }, []);

  // Re-position the canvas when the container is resized
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!container) return;
    const ro = new ResizeObserver(updateCanvasBounds);
    ro.observe(container);
    return () => ro.disconnect();
  }, [updateCanvasBounds]);

  // Re-position the canvas when inference starts (video is definitely playing at this point)
  useEffect(() => {
    if (isRunning) {
      updateCanvasBounds();
    }
  }, [isRunning, updateCanvasBounds]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start camera and begin model loading
  const startCamera = useCallback(async () => {
    setConnectionState("requesting_camera");
    setErrorMessage(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setHasPermission(false);
      setConnectionState("error");
      setErrorMessage("Camera API not available. HTTPS required.");
      return;
    }

    try {
      // Prefer back camera on mobile
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput",
      );
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: videoDevices[1]
            ? { exact: videoDevices[1].deviceId }
            : undefined,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
        },
        audio: false,
      });

      localStreamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Transition to loading_model — the inference hook will start loading
      setConnectionState("loading_model");
    } catch (err) {
      console.error("Camera error:", err);
      setConnectionState("error");
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setHasPermission(false);
          setErrorMessage("Camera access denied");
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Failed to start camera");
      }
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    cleanup();
    setConnectionState("idle");
    setHasPermission(null);
    setErrorMessage(null);
  }, [cleanup]);

  // Handle active state changes
  useEffect(() => {
    if (!active) {
      cleanup();
      setConnectionState("idle");
      setHasPermission(null);
    }
  }, [active, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  if (!active) {
    return null;
  }

  const isLoading =
    connectionState === "requesting_camera" ||
    connectionState === "loading_model";
  const isConnected = connectionState === "connected";
  const isError = connectionState === "error";
  const isIdle = connectionState === "idle";

  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-black", className)}>
      {/* Camera video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={updateCanvasBounds}
        className={cn(
          "h-full w-full object-contain",
          !hasPermission && "hidden",
        )}
      />

      {/* Canvas overlay for detection bounding boxes and masks.
          CSS position/size set by updateCanvasBounds to match the letterboxed video area.
          Pixel dimensions are synced from video native resolution in the inference loop. */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute"
      />

      {/* Loading skeleton */}
      {isLoading && !hasPermission && <Skeleton className="absolute inset-0" />}

      {/* Idle state - start button */}
      {isIdle && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60">
          <div className="text-center">
            <VideoIcon className="mx-auto mb-3 size-16 text-white/70" />
            <p className="mb-1 text-lg font-medium text-white">
              Start Vision Assistance
            </p>
            <p className="text-muted-foreground mb-6 max-w-xs text-sm">
              Point your camera at PC components for AI-powered detection
            </p>
          </div>
          <Button
            onClick={startCamera}
            size="lg"
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <VideoIcon className="size-5" />
            Start Camera
          </Button>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-sm">
          <Loader2Icon className="size-12 animate-spin text-white" />
          <p className="text-white">
            {connectionState === "requesting_camera"
              ? "Requesting camera..."
              : "Loading YOLO model..."}
          </p>
        </div>
      )}

      {/* Connected status indicator */}
      {isConnected && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-full bg-emerald-600/90 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
          <CheckCircleIcon className="size-4" />
          <span>YOLO Vision Active</span>
          <span className="ml-2 font-mono text-xs opacity-80">
            {fps.toFixed(0)} FPS | {detections.length} det
          </span>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60">
          <AlertCircleIcon className="size-16 text-red-400" />
          <div className="text-center">
            <p className="mb-1 text-lg font-medium text-white">Error</p>
            <p className="text-muted-foreground mb-4 max-w-xs text-sm">
              {errorMessage || "Failed to start vision assistance"}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={startCamera}
              variant="secondary"
              className="gap-2"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* No permission state */}
      {hasPermission === false && !isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
          <CameraOffIcon className="size-12" />
          <p className="text-sm">Camera access denied</p>
          <p className="text-muted-foreground max-w-xs text-center text-xs">
            Please allow camera access in your browser settings to use the
            assembly guide.
          </p>
        </div>
      )}

      {/* Controls overlay */}
      {isConnected && (
        <div className="absolute right-4 bottom-4 z-20 flex gap-2">
          <Button
            onClick={stopCamera}
            size="icon"
            variant="destructive"
            className="size-10 rounded-full"
          >
            <CameraOffIcon className="size-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
