"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CameraOffIcon,
  VideoIcon,
  VideoOffIcon,
  Loader2Icon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// External YOLO WebRTC server
const WEBRTC_SERVER_URL = "http://34.217.69.181:6934";

type ConnectionState =
  | "idle"
  | "requesting_camera"
  | "connecting"
  | "connected"
  | "error";

interface CameraFeedProps {
  className?: string;
  active?: boolean;
}

export function CameraFeed({ className, active = true }: CameraFeedProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showLocalPreview, setShowLocalPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  // Start WebRTC connection
  const startWebRTC = useCallback(async () => {
    setConnectionState("requesting_camera");
    setErrorMessage(null);

    // Check if camera API is available
    if (!navigator.mediaDevices?.getUserMedia) {
      setHasPermission(false);
      setConnectionState("error");
      setErrorMessage("Camera API not available. HTTPS required.");
      return;
    }

    try {
      // Get user media with environment camera preference (phone back camera)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
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

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setConnectionState("connecting");

      // Create peer connection with multiple STUN servers for better connectivity
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      // Add local tracks with higher quality encoding
      stream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, stream);

        // Set encoding parameters for higher quality
        if (track.kind === "video") {
          const params = sender.getParameters();
          if (!params.encodings) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 2_500_000; // 2.5 Mbps
          params.encodings[0].maxFramerate = 30;
          sender.setParameters(params).catch(console.warn);
        }
      });

      // Handle remote tracks (processed video from YOLO server)
      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        setConnectionState("connected");
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed"
        ) {
          setConnectionState("error");
          setErrorMessage("Connection lost");
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          pc.addEventListener("icegatheringstatechange", () => {
            if (pc.iceGatheringState === "complete") {
              resolve();
            }
          });
        }
      });

      // Send offer directly to external YOLO WebRTC server
      const response = await fetch(`${WEBRTC_SERVER_URL}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to connect");
      }

      const answer = await response.json();
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error("WebRTC error:", err);
      setConnectionState("error");
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setHasPermission(false);
          setErrorMessage("Camera access denied");
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Failed to start video stream");
      }
    }
  }, []);

  // Stop WebRTC connection
  const stopWebRTC = useCallback(() => {
    cleanup();
    setConnectionState("idle");
    setHasPermission(null);
    setErrorMessage(null);
  }, [cleanup]);

  // Effect to handle active state changes
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
    connectionState === "requesting_camera" || connectionState === "connecting";
  const isConnected = connectionState === "connected";
  const isError = connectionState === "error";
  const isIdle = connectionState === "idle";

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Main video feed - shows remote (processed) when connected, local when connecting */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={cn("h-full w-full object-cover", !isConnected && "hidden")}
      />

      {/* Local video preview (small overlay when connected) */}
      {isConnected && showLocalPreview && (
        <div className="absolute top-4 right-4 z-20 overflow-hidden rounded-lg border-2 border-white/30 shadow-xl">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-24 w-32 object-cover"
          />
        </div>
      )}

      {/* Local video while connecting (full screen) */}
      {!isConnected && hasPermission && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
      )}

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
              Stream your camera to get AI-powered component detection overlay
            </p>
          </div>
          <Button
            onClick={startWebRTC}
            size="lg"
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <VideoIcon className="size-5" />
            Start Camera
          </Button>
        </div>
      )}

      {/* Connecting overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-sm">
          <Loader2Icon className="size-12 animate-spin text-white" />
          <p className="text-white">
            {connectionState === "requesting_camera"
              ? "Requesting camera..."
              : "Connecting to vision server..."}
          </p>
        </div>
      )}

      {/* Connected status indicator */}
      {isConnected && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-full bg-emerald-600/90 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
          <CheckCircleIcon className="size-4" />
          <span>YOLO Vision Active</span>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60">
          <AlertCircleIcon className="size-16 text-red-400" />
          <div className="text-center">
            <p className="mb-1 text-lg font-medium text-white">
              Connection Error
            </p>
            <p className="text-muted-foreground mb-4 max-w-xs text-sm">
              {errorMessage || "Failed to connect to vision server"}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={startWebRTC} variant="secondary" className="gap-2">
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
            onClick={() => setShowLocalPreview(!showLocalPreview)}
            size="icon"
            variant="secondary"
            className="size-10 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70"
          >
            {showLocalPreview ? (
              <VideoOffIcon className="size-5" />
            ) : (
              <VideoIcon className="size-5" />
            )}
          </Button>
          <Button
            onClick={stopWebRTC}
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
