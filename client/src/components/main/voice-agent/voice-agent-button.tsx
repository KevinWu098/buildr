"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Button } from "@/components/ui/button";
import { LoaderIcon, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectionState = "disconnected" | "connecting" | "connected";

export function VoiceAgentButton() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const roomRef = useRef<Room | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
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

      room.on(RoomEvent.Disconnected, () => {
        setConnectionState("disconnected");
        setIsMuted(false);
        setIsSpeaking(false);
        roomRef.current = null;
      });

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      setConnectionState("connected");
    } catch (error) {
      console.error("Failed to connect:", error);
      setConnectionState("disconnected");
      roomRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
    setConnectionState("disconnected");
    setIsMuted(false);
    setIsSpeaking(false);
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
  );
}
