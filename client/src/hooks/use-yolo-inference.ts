"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Detection } from "@/lib/yolo";
import {
  loadModel,
  preprocessFrame,
  runInference,
  INPUT_SIZE,
} from "@/lib/yolo";
import { drawDetections } from "@/lib/yolo-renderer";

interface UseYoloInferenceOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
}

interface UseYoloInferenceResult {
  isModelLoaded: boolean;
  isRunning: boolean;
  fps: number;
  detections: Detection[];
  error: string | null;
}

export function useYoloInference({
  videoRef,
  canvasRef,
  enabled,
}: UseYoloInferenceOptions): UseYoloInferenceResult {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [fps, setFps] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const rafRef = useRef<number>(0);
  const preprocessCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fpsFrameCount = useRef(0);
  const fpsLastTime = useRef(0);
  const fpsValueRef = useRef(0);
  const runningRef = useRef(false);

  // Load model when enabled
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    loadModel()
      .then(() => {
        if (!cancelled) {
          setIsModelLoaded(true);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(`Failed to load model: ${err.message}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Inference loop
  const startLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Create offscreen canvas for preprocessing (640x640)
    if (!preprocessCanvasRef.current) {
      preprocessCanvasRef.current = document.createElement("canvas");
      preprocessCanvasRef.current.width = INPUT_SIZE;
      preprocessCanvasRef.current.height = INPUT_SIZE;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    runningRef.current = true;
    setIsRunning(true);
    fpsLastTime.current = performance.now();
    fpsFrameCount.current = 0;

    const runFrame = async () => {
      if (!runningRef.current) return;

      // Skip if video isn't ready
      if (video.readyState < 2) {
        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }

      // Sync canvas pixel buffer to video native resolution.
      // The canvas CSS dimensions are managed separately by the component,
      // but the pixel buffer must match the video so scaleX/scaleY are correct.
      if (
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        (canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight)
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      try {
        // Preprocess
        const inputTensor = preprocessFrame(
          video,
          preprocessCanvasRef.current!,
        );

        // Run inference
        const { detections: dets, protoMasks } =
          await runInference(inputTensor);

        // Dispose input tensor immediately
        inputTensor.dispose();

        // Scale from model space (640x640) to canvas pixel space (video native res)
        const scaleX = canvas.width / INPUT_SIZE;
        const scaleY = canvas.height / INPUT_SIZE;

        // Draw detections + masks on canvas overlay
        drawDetections(ctx, dets, scaleX, scaleY, protoMasks);

        // Dispose proto masks after drawing
        if (protoMasks) {
          protoMasks.dispose();
        }

        // FPS calculation — update React state once per second to avoid re-rendering every frame
        fpsFrameCount.current++;
        const now = performance.now();
        const elapsed = now - fpsLastTime.current;
        if (elapsed >= 1000) {
          const currentFps = (fpsFrameCount.current * 1000) / elapsed;
          fpsValueRef.current = currentFps;
          setFps(currentFps);
          setDetections(dets);
          fpsFrameCount.current = 0;
          fpsLastTime.current = now;
        }
      } catch (err) {
        console.error("[YOLO] Inference error:", err);
      }

      // Schedule next frame
      if (runningRef.current) {
        rafRef.current = requestAnimationFrame(runFrame);
      }
    };

    rafRef.current = requestAnimationFrame(runFrame);
  }, [videoRef, canvasRef]);

  // Start/stop loop based on model loaded state
  useEffect(() => {
    if (enabled && isModelLoaded) {
      startLoop();
    }

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      setIsRunning(false);
    };
  }, [enabled, isModelLoaded, startLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { isModelLoaded, isRunning, fps, detections, error };
}
