"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioCapture } from "@/lib/audio-capture";
import { AudioPlayback } from "@/lib/audio-playback";
import { VoiceWebSocketClient } from "@/lib/websocket-client";

type Speaker = "user" | "ai" | "silence";

type TranscriptEntry = {
  speaker: "user" | "ai";
  text: string;
  timestamp: number;
};

type ActivityEvent = {
  timestamp: number;
  type: Speaker | "tool";
};

type HookState = {
  isConnected: boolean;
  isUserSpeaking: boolean;
  isAISpeaking: boolean;
  transcripts: TranscriptEntry[];
  activities: ActivityEvent[];
  currentSpeaker: Speaker;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: boolean;
};

const SERVER_URL =
  typeof window !== "undefined"
    ? (window.env?.VOICE_SERVER_URL as string) ??
      (process.env.NEXT_PUBLIC_VOICE_SERVER_URL as string) ??
      "ws://localhost:8765"
    : "ws://localhost:8765";

export function useVoiceChat(): HookState {
  const [isConnected, setIsConnected] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<Speaker>("silence");
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const wsClientRef = useRef<VoiceWebSocketClient | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const playbackRef = useRef<AudioPlayback | null>(null);
  const aiSpeakingRef = useRef(false);

  const pushActivity = useCallback((type: ActivityEvent["type"]) => {
    const timestamp = Date.now();
    setActivities((prev) => [...prev.slice(-300), { timestamp, type }]);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const client = new VoiceWebSocketClient(SERVER_URL);
    wsClientRef.current = client;

    const unsubscribeState = client.onConnectionStateChange((state) => {
      setIsConnected(state === "open");
      if (state === "closed") {
        setCurrentSpeaker("silence");
        setIsUserSpeaking(false);
      }
    });

    const unsubscribeMessages = client.onMessage((message) => {
      const { type } = message ?? {};
      if (!type) return;

      switch (type) {
        case "speech_started":
          setIsUserSpeaking(true);
          setCurrentSpeaker("user");
          pushActivity("user");
          break;
        case "speech_stopped":
          setIsUserSpeaking(false);
          setCurrentSpeaker(aiSpeakingRef.current ? "ai" : "silence");
          pushActivity("silence");
          break;
        case "audio_output": {
          const data = message.data;
          if (typeof data === "string" && playbackRef.current) {
            aiSpeakingRef.current = true;
            setIsAISpeaking(true);
            setCurrentSpeaker("ai");
            pushActivity("ai");
            playbackRef.current.play(data).catch((err) => {
              console.error("Playback error", err);
              setError("Unable to play audio output.");
            });
          }
          break;
        }
        case "transcript": {
          const payload = message.data;
          if (payload && (payload.speaker === "user" || payload.speaker === "ai")) {
            setTranscripts((prev) => [
              ...prev,
              {
                speaker: payload.speaker,
                text: payload.text,
                timestamp: Date.now(),
              },
            ]);
          }
          break;
        }
        case "error":
          setError(message.message ?? "An unknown error occurred.");
          break;
        default:
          break;
      }
    });

    client.connect();

    return () => {
      unsubscribeMessages();
      unsubscribeState();
      client.close();
      wsClientRef.current = null;
    };
  }, [pushActivity]);

  const start = useCallback(async () => {
    if (isRunning) return;
    setError(null);
    setIsRunning(true);

    try {
      if (!wsClientRef.current) {
        const client = new VoiceWebSocketClient(SERVER_URL);
        wsClientRef.current = client;
        client.connect();
      }

      if (!playbackRef.current) {
        playbackRef.current = new AudioPlayback();
        await playbackRef.current.init({
          onQueueEmpty: () => {
            aiSpeakingRef.current = false;
            setIsAISpeaking(false);
            if (!isUserSpeaking) {
              setCurrentSpeaker("silence");
            }
          },
        });
      }

      if (!captureRef.current) {
        captureRef.current = new AudioCapture();
      }

      await captureRef.current.start({
        onData: (base64) => {
          wsClientRef.current?.send({ type: "audio_input", data: base64 });
        },
      });
    } catch (err) {
      console.error("Failed to start voice chat", err);
      setError("Unable to access microphone or initialize audio.");
      await captureRef.current?.stop();
      await playbackRef.current?.stop();
      setIsRunning(false);
    }
  }, [isRunning, isUserSpeaking]);

  const stop = useCallback(async () => {
    if (!isRunning) return;
    setIsRunning(false);

    wsClientRef.current?.send({ type: "stop" });
    await captureRef.current?.stop();
    await playbackRef.current?.stop();

    aiSpeakingRef.current = false;
    setIsAISpeaking(false);
    setIsUserSpeaking(false);
    setCurrentSpeaker("silence");
  }, [isRunning]);

  return useMemo(
    () => ({
      isConnected,
      isUserSpeaking,
      isAISpeaking,
      transcripts,
      activities,
      currentSpeaker,
      error,
      start,
      stop,
      isRunning,
    }),
    [
      activities,
      currentSpeaker,
      error,
      isAISpeaking,
      isConnected,
      isRunning,
      isUserSpeaking,
      start,
      stop,
      transcripts,
    ]
  );
}
