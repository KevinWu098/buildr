"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CameraOffIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CameraFeedProps {
  className?: string;
  active?: boolean;
}

export function CameraFeed({ className, active = true }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!active) {
      // Clean up stream when not active
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    let mounted = true;

    async function startCamera() {
      // Check if camera API is available (requires HTTPS)
      if (!navigator.mediaDevices?.getUserMedia) {
        if (mounted) {
          setHasPermission(false);
          setIsLoading(false);
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
        }
      } catch (err) {
        console.error("Camera access error:", err);
        if (mounted) {
          setHasPermission(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [active]);

  if (!active) {
    return null;
  }

  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-black", className)}>
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "h-full w-full object-cover",
          (!hasPermission || isLoading) && "hidden"
        )}
      />

      {/* Loading skeleton */}
      {isLoading && <Skeleton className="absolute inset-0" />}

      {/* No permission state */}
      {!isLoading && hasPermission === false && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
          <CameraOffIcon className="size-12" />
          <p className="text-sm">Camera access denied</p>
          <p className="text-muted-foreground max-w-xs text-center text-xs">
            Please allow camera access in your browser settings to use the
            assembly guide.
          </p>
        </div>
      )}

      {/* Subtle overlay gradient for better drawer visibility */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-black/20" />
    </div>
  );
}
