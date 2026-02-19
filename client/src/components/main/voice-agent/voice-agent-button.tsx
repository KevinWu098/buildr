"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, TranscriptionSegment } from "livekit-client";
import { Button } from "@/components/ui/button";
import { LoaderIcon, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectionState = "disconnected" | "connecting" | "connected";
type VideoPopup = { component: string; url: string };

export function VoiceAgentButton() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [agentCaption, setAgentCaption] = useState("");
  const [videoPopup, setVideoPopup] = useState<VideoPopup | null>(null);
  const roomRef = useRef<Room | null>(null);
  const captionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionContainerRef = useRef<HTMLDivElement>(null);
  const segmentsMapRef = useRef<Map<string, string>>(new Map());

  // Disable mic while video is playing so the agent doesn't process new input;
  // re-enable when the video closes
  useEffect(() => {
    if (!roomRef.current) return;
    if (videoPopup) {
      roomRef.current.localParticipant.setMicrophoneEnabled(false);
    } else if (connectionState === "connected") {
      roomRef.current.localParticipant.setMicrophoneEnabled(!isMuted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoPopup]);

  // Auto-scroll caption to bottom when text updates
  useEffect(() => {
    if (captionContainerRef.current) {
      captionContainerRef.current.scrollTop =
        captionContainerRef.current.scrollHeight;
    }
  }, [agentCaption]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current);
      }
    };
  }, []);

  const connect = useCallback(async () => {
    setConnectionState("connecting");

    try {
      // Get token from API
      const response = await fetch("/api/livekit-token");
      if (!response.ok) {
        throw new Error("Failed to get token");
      }
      const { token, url } = await response.json();

      // Create and connect to room
      const room = new Room({
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      roomRef.current = room;

      // Handle remote audio tracks (agent's voice)
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.id = `audio-${participant.identity}`;
          document.body.appendChild(audioElement);
        }
      });

      room.on(
        RoomEvent.TrackUnsubscribed,
        (track, _publication, participant) => {
          const audioElement = document.getElementById(
            `audio-${participant.identity}`
          );
          if (audioElement) {
            audioElement.remove();
          }
          track.detach();
        }
      );

      // Track speaking state of remote participants (agent)
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const agentSpeaking = speakers.some(
          (p) => p.identity !== room.localParticipant.identity
        );
        setIsSpeaking(agentSpeaking);
      });

      // Handle transcription from agent (including interim results for low latency)
      room.on(
        RoomEvent.TranscriptionReceived,
        (segments: TranscriptionSegment[], participant) => {
          // Only show agent's transcription (not local user)
          if (participant?.identity === room.localParticipant.identity) return;

          // Update segments map with new/updated segments
          for (const segment of segments) {
            segmentsMapRef.current.set(segment.id, segment.text);
          }

          // Build caption from all segments
          const text = Array.from(segmentsMapRef.current.values()).join(" ");
          if (text.trim()) {
            setAgentCaption(text);
          }

          // Clear caption and segments after silence
          if (captionTimeoutRef.current) {
            clearTimeout(captionTimeoutRef.current);
          }
          captionTimeoutRef.current = setTimeout(() => {
            setAgentCaption("");
            segmentsMapRef.current.clear();
          }, 5000);
        }
      );

      room.on(RoomEvent.DataReceived, async (payload: Uint8Array) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(payload));
          if (
            data.type === "show_video" &&
            ["cpu", "gpu", "ram"].includes(data.component)
          ) {
            const res = await fetch(`/api/clip/${data.component}`);
            const { url } = await res.json();
            setVideoPopup({ component: data.component, url });
          }
        } catch {
          // Ignore malformed data messages
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setConnectionState("disconnected");
        setIsMuted(false);
        setIsSpeaking(false);
        setAgentCaption("");
        setVideoPopup(null);
        segmentsMapRef.current.clear();
        roomRef.current = null;
      });

      // Log local participant track events for debugging
      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        console.log("[LiveKit] Local track published:", publication.trackSid, publication.kind);
      });

      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        console.log("[LiveKit] Local track unpublished:", publication.trackSid);
      });

      await room.connect(url, token);
      console.log("[LiveKit] Connected to room:", room.name);

      // Enable microphone with explicit error handling
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        console.log("[LiveKit] Microphone enabled successfully");
        
        // Verify the mic track was published
        const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (micTrack) {
          console.log("[LiveKit] Mic track published:", micTrack.trackSid, "muted:", micTrack.isMuted);
        } else {
          console.warn("[LiveKit] No microphone track found after enabling");
        }
      } catch (micError) {
        console.error("[LiveKit] Failed to enable microphone:", micError);
        // Continue anyway - user can still hear the agent
      }

      setConnectionState("connected");
    } catch (error) {
      console.error("[LiveKit] Failed to connect:", error);
      setConnectionState("disconnected");
      roomRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
    if (captionTimeoutRef.current) {
      clearTimeout(captionTimeoutRef.current);
    }
    setConnectionState("disconnected");
    setIsMuted(false);
    setIsSpeaking(false);
    setAgentCaption("");
    segmentsMapRef.current.clear();
    roomRef.current = null;
  }, []);

  const toggleMute = useCallback(async () => {
    if (roomRef.current) {
      const newMuteState = !isMuted;
      await roomRef.current.localParticipant.setMicrophoneEnabled(
        !newMuteState
      );
      setIsMuted(newMuteState);
    }
  }, [isMuted]);

  if (connectionState === "disconnected") {
    return (
      <Button
        onClick={connect}
        size="lg"
        className="border-border w-full gap-2 border-2 bg-emerald-600 text-lg text-white hover:bg-emerald-700"
      >
        Connect
      </Button>
    );
  }

  if (connectionState === "connecting") {
    return (
      <Button size="lg" disabled className="w-full gap-2 text-lg">
        <LoaderIcon className="size-5 animate-spin" />
        Connecting...
      </Button>
    );
  }

  // Connected state
  return (
    <div className="flex flex-col items-center gap-3">
      {videoPopup && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
          <div className="relative w-full max-w-md px-4">
            <p className="mb-2 text-center text-sm font-semibold uppercase text-white">
              {videoPopup.component} Installation
            </p>
            <video
              src={videoPopup.url}
              controls
              autoPlay
              className="w-full rounded-lg"
              onEnded={() => setVideoPopup(null)}
            />
            <button
              onClick={() => setVideoPopup(null)}
              className="absolute right-6 top-0 text-xl text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Agent caption */}
      {agentCaption && (
        <div
          ref={captionContainerRef}
          className="max-h-18 w-full overflow-y-auto rounded-lg bg-black/60 px-4 py-2 backdrop-blur-sm"
        >
          <p className="text-center text-sm leading-6 text-white">
            {agentCaption}
          </p>
        </div>
      )}

      {/* Control buttons */}
      <div className="flex items-center gap-2">
        <Button
          onClick={toggleMute}
          size="icon"
          variant={isMuted ? "destructive" : "secondary"}
          className={cn(
            "size-12 rounded-full transition-all",
            !isMuted && isSpeaking && "ring-2 ring-emerald-500 ring-offset-2",
            "ring"
          )}
        >
          {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </Button>
        <Button
          onClick={disconnect}
          size="icon"
          variant="destructive"
          className="size-12 rounded-full ring"
        >
          <PhoneOff className="size-5" />
        </Button>
      </div>
    </div>
  );
}
