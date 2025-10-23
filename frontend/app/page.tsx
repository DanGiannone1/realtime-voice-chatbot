"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Square, Sparkles, Wrench } from "lucide-react";
import WaveformVisualizer from "./components/WaveformVisualizer";

interface SessionResponse {
  id: string;
  model: string;
  expires_at: number;
  client_secret: {
    value: string;
    expires_at: number;
  };
  webrtc_url: string; // Added by our backend
  turn_detection: any;
  voice: string;
  instructions: string;
}

interface RealtimeEvent {
  type: string;
  event_id?: string;
  transcript?: string;
  delta?: string;
  item?: any;
  error?: {
    type: string;
    code: string;
    message: string;
  };
  call_id?: string;
  name?: string;
  arguments?: string;
  [key: string]: any;
}

type TranscriptRole = "user" | "ai";

interface TranscriptMessage {
  role: TranscriptRole;
  content: string;
  timestamp: string;
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Click 'Start Session' to begin");
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<"1m" | "3m" | "5m">("1m");
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isAiRespondingRef = useRef(false);

  // Instant flags for the visualizer
  const isUserSpeakingRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const isToolRunningRef = useRef(false);

  // WebAudio bits for visualization (cheap, optional)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const userAnalyserRef = useRef<AnalyserNode | null>(null);
  const aiAnalyserRef = useRef<AnalyserNode | null>(null);
  const pendingToolCallsRef = useRef<
    Record<string, { name: string; args: string }>
  >({});

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const makeAnalyser = (ctx: AudioContext) => {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;
    return analyser;
  };

  const cleanup = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch {}
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
    }

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    userAnalyserRef.current = null;
    aiAnalyserRef.current = null;
    pendingToolCallsRef.current = {};
    isToolRunningRef.current = false;
  };

  const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  function safeParseJSON<T = any>(
    s: string | undefined | null,
    fallback: T = {} as any
  ): T {
    try {
      return s ? (JSON.parse(s) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  async function getWeather(city: string) {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(
        city
      )}`
    ).then((r) => r.json());
    if (!geo?.results?.length) {
      return { ok: false, error: `City not found: ${city}` };
    }
    const { latitude, longitude, name, country } = geo.results[0];

    const wx = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
    ).then((r) => r.json());

    const current = wx?.current_weather ?? {};
    return {
      ok: true,
      city: name,
      country,
      latitude,
      longitude,
      current_weather: current,
    };
  }

  const handleDataChannelMessage = (event: MessageEvent) => {
    try {
      const realtimeEvent: RealtimeEvent = JSON.parse(event.data);
      // console.log("📨 Server event:", realtimeEvent.type, realtimeEvent);

      switch (realtimeEvent.type) {
        case "session.created":
          setStatus("Session created. Start speaking!");
          break;

        case "session.updated":
          setStatus("Session configured. Ready!");
          break;

        case "input_audio_buffer.speech_started":
          setStatus("Listening...");
          isUserSpeakingRef.current = true;
          setIsUserSpeaking(true);
          break;

        case "input_audio_buffer.speech_stopped":
          setStatus("Processing...");
          isUserSpeakingRef.current = false;
          setIsUserSpeaking(false);
          break;

        case "conversation.item.input_audio_transcription.completed":
          if (realtimeEvent.transcript) {
            setTranscript((prev) => [
              ...prev,
              {
                role: "user",
                content: realtimeEvent.transcript ?? "",
                timestamp: getTimestamp(),
              },
            ]);
            setStatus("AI is responding...");
            isAiRespondingRef.current = true;
          }
          break;

        case "response.audio.delta":
        case "response.audio_transcript.delta":
          if (isAiRespondingRef.current && !isAiSpeakingRef.current) {
            isAiSpeakingRef.current = true;
            setIsAiSpeaking(true);
          }

          if (realtimeEvent.delta) {
            setTranscript((prev) => {
              const lastIndex = prev.length - 1;
              if (
                lastIndex >= 0 &&
                prev[lastIndex].role === "ai" &&
                isAiRespondingRef.current
              ) {
                const updated = [...prev];
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  content: `${updated[lastIndex].content}${realtimeEvent.delta}`,
                };
                return updated;
              }
              if (isAiRespondingRef.current) {
                return [
                  ...prev,
                  {
                    role: "ai",
                    content: realtimeEvent.delta ?? "",
                    timestamp: getTimestamp(),
                  },
                ];
              }
              return prev;
            });
          }
          break;

        case "response.audio_transcript.done":
          break;

        case "response.content_part.done":
        case "response.output_item.done":
        case "response.done":
          break;

        case "output_audio_buffer.stopped":
          setStatus("Ready to listen...");
          isAiSpeakingRef.current = false;
          setIsAiSpeaking(false);
          isAiRespondingRef.current = false;
          break;

        case "response.output_item.added": {
          const it = realtimeEvent.item;
          if (it?.type === "function_call") {
            const callId = it.call_id;
            if (callId) {
              pendingToolCallsRef.current[callId] = {
                name: it.name ?? "unknown_tool",
                args: "",
              };
              isToolRunningRef.current = true;
              setStatus(
                it.name
                  ? `Running tool: ${it.name}`
                  : "Running tool..."
              );
            }
          }
          break;
        }

        case "response.function_call_arguments.delta": {
          const { call_id, delta } = realtimeEvent;
          if (call_id) {
            const entry =
              pendingToolCallsRef.current[call_id] ?? { name: "", args: "" };
            entry.args += delta ?? "";
            pendingToolCallsRef.current[call_id] = entry;
          }
          break;
        }

        case "response.function_call_arguments.done": {
          const { call_id } = realtimeEvent;
          if (!call_id) {
            break;
          }
          const entry = pendingToolCallsRef.current[call_id];
          const fnName = entry?.name || realtimeEvent.name || "unknown_tool";
          const finalArgsString =
            entry?.args || realtimeEvent.arguments || "{}";
          const args = safeParseJSON<{ city?: string }>(finalArgsString, {});

          (async () => {
            let result: any = { ok: false, error: "No tool executed" };

            try {
              if (fnName === "get_weather") {
                const city = args.city ?? "";
                result = await getWeather(city);
              } else {
                result = { ok: false, error: `Unknown tool: ${fnName}` };
              }
            } catch (err: any) {
              result = { ok: false, error: String(err) };
            }

            if (dataChannelRef.current) {
              dataChannelRef.current.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id,
                    output: JSON.stringify(result),
                  },
                })
              );

              dataChannelRef.current.send(
                JSON.stringify({ type: "response.create" })
              );
            }

            delete pendingToolCallsRef.current[call_id];
            if (Object.keys(pendingToolCallsRef.current).length === 0) {
              isToolRunningRef.current = false;
            }

            setStatus("AI is responding...");
          })();

          break;
        }

        case "error":
          console.error("Server error:", realtimeEvent.error);
          setStatus(`Error: ${realtimeEvent.error?.message || "Unknown error"}`);
          break;
      }
    } catch (error) {
      console.error("Error parsing server message:", error);
    }
  };

  const startConversation = async () => {
    setIsLoading(true);
    setStatus("Requesting session from backend...");

    try {
      // ========================================
      // STEP 1: Get ephemeral token from backend
      // ========================================
      const tokenResponse = await fetch("http://localhost:8080/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Failed to get session token: ${errorText}`);
      }

      const sessionData: SessionResponse = await tokenResponse.json();

      if (!sessionData.webrtc_url) {
        throw new Error("Backend did not return webrtc_url");
      }

      const ephemeralToken = sessionData.client_secret.value;

      setStatus("Getting microphone access...");

      // ========================================
      // STEP 2: Get user's microphone
      // ========================================
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // WebAudio analyzers (for visualization only)
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      userAnalyserRef.current = makeAnalyser(ctx);
      const userSrc = ctx.createMediaStreamSource(stream);
      userSrc.connect(userAnalyserRef.current);

      setStatus("Creating WebRTC connection...");

      // ========================================
      // STEP 3: Create WebRTC peer connection
      // ========================================
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // ========================================
      // STEP 4: Create data channel for events
      // ========================================
      const dataChannel = pc.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;

      dataChannel.addEventListener("open", () => {
        console.log("📡 Data channel opened");

        dataChannel.send(
          JSON.stringify({
            type: "session.update",
            session: {
              tool_choice: "auto",
              tools: [
                {
                  type: "function",
                  name: "get_weather",
                  description: "Get current weather by city name",
                  parameters: {
                    type: "object",
                    properties: {
                      city: { type: "string", description: "City name" },
                    },
                    required: ["city"],
                  },
                },
              ],
            },
          })
        );
      });

      dataChannel.addEventListener("message", handleDataChannelMessage);

      dataChannel.addEventListener("error", (error) => {
        console.error("❌ Data channel error:", error);
      });

      // ========================================
      // STEP 5: Add user's audio track
      // ========================================
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // ========================================
      // STEP 6: Handle incoming audio from Azure
      // ========================================
      pc.ontrack = (event) => {
        console.log("🔊 Received audio track");

        // Visual analyser for AI audio (observation only)
        if (audioCtxRef.current && event.streams[0]) {
          const ctx = audioCtxRef.current;
          aiAnalyserRef.current = makeAnalyser(ctx);
          const aiSrc = ctx.createMediaStreamSource(event.streams[0]);
          aiSrc.connect(aiAnalyserRef.current);
        }

        if (audioElementRef.current && event.streams[0]) {
          audioElementRef.current.srcObject = event.streams[0];
          audioElementRef.current
            .play()
            .catch((e) => console.error("Error playing audio:", e));
        }
      };

      // ========================================
      // STEP 7: Handle connection state changes
      // ========================================
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);

        if (pc.connectionState === "connected") {
          setStatus("Connected! Start speaking...");
          setIsConnected(true);
        } else if (pc.connectionState === "failed") {
          setStatus("Connection failed");
          setIsConnected(false);
          cleanup();
        }
      };

      // ========================================
      // STEP 8: Create SDP offer
      // ========================================
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // ========================================
      // STEP 9: Exchange SDP with Azure
      // ========================================
      setStatus("Connecting to Azure...");

      const webrtcUrl = `${sessionData.webrtc_url}?model=${sessionData.model}`;
      const sdpResponse = await fetch(webrtcUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralToken}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error("SDP exchange failed:", errorText.substring(0, 200));
        throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
      }

      const answerSdp = await sdpResponse.text();

      // ========================================
      // STEP 10: Set remote description
      // ========================================
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });

      console.log("✅ WebRTC connected!");
    } catch (error) {
      console.error("Connection error:", error);
      setStatus(`Error: ${error instanceof Error ? error.message : "Unknown"}`);
      cleanup();
    } finally {
      setIsLoading(false);
    }
  };

  const stopConversation = () => {
    setStatus("Disconnecting...");
    cleanup();
    setIsConnected(false);
    isAiRespondingRef.current = false;
    setStatus("Disconnected. Click 'Start Session' to reconnect.");
  };

  return (
    <main className="flex h-screen gap-6 bg-black p-6 text-white">
      {/* Hidden audio element */}
      <audio ref={audioElementRef} autoPlay />

      {/* Left Column - Main Content */}
      <div className="flex flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: "#059669" }}
            >
              Agent Command Center
            </h1>
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4" style={{ color: "#10b981" }} />
              <p className="text-slate-400">{status}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={isConnected ? stopConversation : startConversation}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-200 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: isConnected
                  ? "#ef4444"
                  : "linear-gradient(135deg, #1B4965 0%, #1F7A8C 100%)",
              }}
            >
              {isConnected ? (
                <>
                  <Square className="h-4 w-4" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Session
                </>
              )}
            </button>
            <button
              onClick={() => setSelectedTimeRange("1m")}
              className="rounded-md px-3 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-200 hover:opacity-90"
              style={{
                background:
                  selectedTimeRange === "1m"
                    ? "linear-gradient(135deg, #1B4965 0%, #1F7A8C 100%)"
                    : "#1B3A4B",
                opacity: selectedTimeRange === "1m" ? 1 : 0.75,
              }}
            >
              1m
            </button>
            <button
              onClick={() => setSelectedTimeRange("3m")}
              className="rounded-md px-3 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-200 hover:opacity-90"
              style={{
                background:
                  selectedTimeRange === "3m"
                    ? "linear-gradient(135deg, #1B4965 0%, #1F7A8C 100%)"
                    : "#1B3A4B",
                opacity: selectedTimeRange === "3m" ? 1 : 0.75,
              }}
            >
              3m
            </button>
            <button
              onClick={() => setSelectedTimeRange("5m")}
              className="rounded-md px-3 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-200 hover:opacity-90"
              style={{
                background:
                  selectedTimeRange === "5m"
                    ? "linear-gradient(135deg, #1B4965 0%, #1F7A8C 100%)"
                    : "#1B3A4B",
                opacity: selectedTimeRange === "5m" ? 1 : 0.75,
              }}
            >
              5m
            </button>
          </div>
        </div>

        {/* Visualization Panel */}
        <div
          className="flex h-64 flex-col rounded-lg border border-[#333333] p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5)]"
          style={{
            background: "linear-gradient(to bottom, #000000 0%, #1A1A1A 100%)",
          }}
        >
          <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-wider text-gray-500">
            <span>Audio Visualization</span>
            <span>Waveform</span>
          </div>
          <div className="relative flex-1" style={{ minHeight: "130px" }}>
            <WaveformVisualizer
              isUserSpeakingRef={isUserSpeakingRef}
              isAiSpeakingRef={isAiSpeakingRef}
              isToolRunningRef={isToolRunningRef}
              timeWindow={
                selectedTimeRange === "1m"
                  ? 60
                  : selectedTimeRange === "3m"
                  ? 180
                  : 300
              }
              userAnalyser={userAnalyserRef.current ?? undefined}
              aiAnalyser={aiAnalyserRef.current ?? undefined}
              isActive={isConnected}
            />
          </div>
          <div className="mt-3 flex items-center justify-end text-sm">
            <div className="flex gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gray-600"></div>
                <span>You</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                <span>AI</span>
              </div>
              <div className="flex items-center gap-2">
                <Wrench className="h-3 w-3 text-amber-400" />
                <span>Tool Call</span>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Telemetry Panel */}
        <div
          className="flex min-h-64 flex-1 flex-col rounded-lg border border-[#333333] p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5)]"
          style={{
            background: "linear-gradient(to bottom, #000000 0%, #1A1A1A 100%)",
          }}
        >
          <h2 className="mb-4 text-xl font-semibold">Agent Telemetry</h2>
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            <p>
              {isConnected
                ? "Streaming…"
                : "Disconnected. Click 'Start Session' to reconnect."}
            </p>
          </div>
        </div>
      </div>

      {/* Right Column - Conversation Transcript */}
      <div
        className="flex w-96 flex-col rounded-lg border border-[#333333] p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5)]"
        style={{
          background: "linear-gradient(to bottom, #000000 0%, #1A1A1A 100%)",
        }}
      >
        <h2 className="mb-4 text-xl font-semibold">Conversation Transcript</h2>

        {transcript.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            Start the conversation to see transcripts here
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {transcript.map((message, index) => {
              const isAi = message.role === "ai";
              return (
                <div
                  key={index}
                  className={`flex flex-col ${isAi ? "items-start" : "items-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg border p-3 shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
                      isAi
                        ? "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.1)]"
                        : "border-[#333333] bg-[#374151]"
                    }`}
                  >
                    <div
                      className="mb-1 flex items-center gap-1 font-mono text-xs opacity-70"
                      style={{ color: "#9ca3af" }}
                    >
                      {isAi && (
                        <Sparkles className="h-5 w-5" style={{ color: "#10b981" }} />
                      )}
                      <span>{message.timestamp}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">
                      {message.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
