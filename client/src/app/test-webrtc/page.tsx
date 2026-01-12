"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  VideoIcon,
  VideoOffIcon,
  Loader2Icon,
  CheckCircleIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  ServerIcon,
} from "lucide-react";

type ConnectionState =
  | "idle"
  | "checking_server"
  | "requesting_camera"
  | "connecting"
  | "connected"
  | "error";

interface ServerHealth {
  status: string;
  yolo_available: boolean;
}

export default function TestWebRTCPage() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  // Check server health
  const checkServerHealth = useCallback(async () => {
    addLog("Checking WebRTC server health...");
    try {
      const response = await fetch("/api/webrtc-offer");
      const health = await response.json();
      setServerHealth(health);
      if (health.status === "ok") {
        addLog(`Server is healthy. YOLO: ${health.yolo_available ? "enabled" : "mock mode"}`);
        return true;
      } else {
        addLog(`Server unavailable: ${health.error || "Unknown error"}`);
        return false;
      }
    } catch (err) {
      addLog(`Server check failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setServerHealth({ status: "unavailable", yolo_available: false });
      return false;
    }
  }, [addLog]);

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
    cleanup();
    setErrorMessage(null);
    setConnectionState("checking_server");

    // Check server health first
    const serverOk = await checkServerHealth();
    if (!serverOk) {
      setConnectionState("error");
      setErrorMessage("WebRTC server is not available. Make sure it's running on port 8080.");
      return;
    }

    setConnectionState("requesting_camera");
    addLog("Requesting camera access...");

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      localStreamRef.current = stream;
      addLog("Camera access granted");

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setConnectionState("connecting");
      addLog("Creating WebRTC peer connection...");

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        addLog(`Added track: ${track.kind}`);
      });

      // Handle remote tracks
      pc.ontrack = (event) => {
        addLog(`Received remote track: ${event.track.kind}`);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        setConnectionState("connected");
        addLog("✅ Connection established - YOLO processing active");
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addLog(`ICE candidate: ${event.candidate.type || "unknown"}`);
        }
      };

      pc.onconnectionstatechange = () => {
        addLog(`Connection state: ${pc.connectionState}`);
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setConnectionState("error");
          setErrorMessage("Connection lost");
        }
      };

      // Create offer
      addLog("Creating SDP offer...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      addLog("Local description set");

      // Wait for ICE gathering
      addLog("Gathering ICE candidates...");
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
      addLog("ICE gathering complete");

      // Send offer to server
      addLog("Sending offer to server...");
      const response = await fetch("/api/webrtc-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Server rejected offer");
      }

      const answer = await response.json();
      addLog("Received SDP answer from server");
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      addLog("Remote description set");

    } catch (err) {
      console.error("WebRTC error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      addLog(`❌ Error: ${message}`);
      setConnectionState("error");
      setErrorMessage(message);
    }
  }, [cleanup, checkServerHealth, addLog]);

  // Stop connection
  const stopWebRTC = useCallback(() => {
    addLog("Stopping connection...");
    cleanup();
    setConnectionState("idle");
    setErrorMessage(null);
    addLog("Disconnected");
  }, [cleanup, addLog]);

  // Check server health on mount
  useEffect(() => {
    checkServerHealth();
  }, [checkServerHealth]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const isLoading =
    connectionState === "checking_server" ||
    connectionState === "requesting_camera" ||
    connectionState === "connecting";
  const isConnected = connectionState === "connected";
  const isError = connectionState === "error";
  const isIdle = connectionState === "idle";

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 p-4">
        <div className="mx-auto max-w-4xl">
          <h1 className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent">
            WebRTC Vision Test
          </h1>
          <p className="text-sm text-slate-400">
            Test the YOLO video processing pipeline
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-4xl flex-1 p-4">
        {/* Server Status */}
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <ServerIcon className="size-5 text-slate-400" />
          <div className="flex-1">
            <span className="text-sm text-slate-300">WebRTC Server: </span>
            {serverHealth ? (
              serverHealth.status === "ok" ? (
                <span className="text-sm text-emerald-400">
                  Online {serverHealth.yolo_available ? "(YOLO enabled)" : "(Mock mode)"}
                </span>
              ) : (
                <span className="text-sm text-red-400">
                  Offline - {serverHealth.error || "Not running"}
                </span>
              )
            ) : (
              <span className="text-sm text-slate-500">Checking...</span>
            )}
          </div>
          <Button
            onClick={checkServerHealth}
            size="sm"
            variant="ghost"
            className="text-slate-400 hover:text-white"
          >
            <RefreshCwIcon className="size-4" />
          </Button>
        </div>

        {/* Controls */}
        <div className="mb-4 flex gap-3">
          <Button
            onClick={startWebRTC}
            disabled={isLoading || isConnected}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? (
              <Loader2Icon className="size-5 animate-spin" />
            ) : (
              <VideoIcon className="size-5" />
            )}
            {isLoading ? "Connecting..." : "Start"}
          </Button>
          <Button
            onClick={stopWebRTC}
            disabled={isIdle}
            variant="destructive"
            className="gap-2"
          >
            <VideoOffIcon className="size-5" />
            Stop
          </Button>
          <Button
            onClick={() => setLogs([])}
            variant="outline"
            className="ml-auto border-white/20 text-slate-300"
          >
            Clear Logs
          </Button>
        </div>

        {/* Connection Status */}
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
          {isConnected && <CheckCircleIcon className="size-5 text-emerald-400" />}
          {isError && <AlertCircleIcon className="size-5 text-red-400" />}
          {isLoading && <Loader2Icon className="size-5 animate-spin text-cyan-400" />}
          {isIdle && <div className="size-5 rounded-full border-2 border-slate-500" />}
          <span className="text-sm">
            {isConnected && "Connected - YOLO Vision Active"}
            {isError && `Error: ${errorMessage}`}
            {isLoading && `${connectionState.replace("_", " ")}...`}
            {isIdle && "Ready to connect"}
          </span>
        </div>

        {/* Video feeds */}
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
              <div className="size-2 rounded-full bg-cyan-400" />
              <span className="text-sm font-medium">Local Camera</span>
            </div>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full bg-slate-900 object-cover"
            />
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
              <div
                className={`size-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-slate-500"}`}
              />
              <span className="text-sm font-medium">YOLO Processed</span>
              {isConnected && (
                <span className="ml-auto text-xs text-emerald-400">Live</span>
              )}
            </div>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="aspect-video w-full bg-slate-900 object-cover"
            />
          </div>
        </div>

        {/* Connection Logs */}
        <div className="rounded-lg border border-white/10 bg-black/50">
          <div className="border-b border-white/10 px-3 py-2">
            <span className="text-sm font-medium text-slate-300">
              Connection Logs
            </span>
          </div>
          <div className="h-48 overflow-auto p-3 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-slate-500">No logs yet. Click Start to begin.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-slate-400">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 p-4">
        <div className="mx-auto max-w-4xl text-center text-xs text-slate-500">
          <p className="mb-2">
            <strong>To run the WebRTC server:</strong>
          </p>
          <code className="rounded bg-slate-800 px-2 py-1">
            cd server && uv run python main.py --mock
          </code>
          <p className="mt-2">
            Or with YOLO: <code className="rounded bg-slate-800 px-1">uv run python main.py --weights epoch55.pt</code>
          </p>
        </div>
      </footer>
    </div>
  );
}


