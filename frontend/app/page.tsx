"use client";

import { useState, useRef, useEffect } from "react";

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
  error?: {
    type: string;
    code: string;
    message: string;
  };
  [key: string]: any;
}

type TranscriptRole = "user" | "ai";

interface TranscriptMessage {
  role: TranscriptRole;
  content: string;
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Click 'Start Session' to begin");
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
    }
  };

  const handleDataChannelMessage = (event: MessageEvent) => {
    try {
      const realtimeEvent: RealtimeEvent = JSON.parse(event.data);
      console.log("📨 Server event:", realtimeEvent.type, realtimeEvent);

      switch (realtimeEvent.type) {
        case "session.created":
          setStatus("✅ Session created. Start speaking!");
          break;

        case "session.updated":
          setStatus("✅ Session configured. Ready!");
          break;

        case "input_audio_buffer.speech_started":
          setStatus("🎤 Listening...");
          break;

        case "input_audio_buffer.speech_stopped":
          setStatus("💭 Processing...");
          break;

        case "conversation.item.input_audio_transcription.completed":
          if (realtimeEvent.transcript) {
            setTranscript((prev) => [
              ...prev,
              { role: "user", content: realtimeEvent.transcript ?? "" },
            ]);
            setStatus("🤖 AI is responding...");
          }
          break;

        case "response.audio_transcript.delta":
          if (realtimeEvent.delta) {
            setTranscript((prev) => {
              const lastIndex = prev.length - 1;
              if (lastIndex >= 0 && prev[lastIndex].role === "ai") {
                const updated = [...prev];
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  content: `${updated[lastIndex].content}${realtimeEvent.delta}`,
                };
                return updated;
              }
              return [
                ...prev,
                { role: "ai", content: realtimeEvent.delta ?? "" },
              ];
            });
          }
          break;

        case "response.audio_transcript.done":
          setStatus("✅ Ready to listen...");
          break;

        case "response.done":
          setStatus("✅ Ready to listen...");
          break;

        case "error":
          console.error("❌ Server error:", realtimeEvent.error);
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
      
      console.log("✅ Session received");
      console.log("WebRTC URL:", sessionData.webrtc_url);
      console.log("Model:", sessionData.model);

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
        if (audioElementRef.current && event.streams[0]) {
          audioElementRef.current.srcObject = event.streams[0];
          audioElementRef.current.play().catch((e) => {
            console.error("Error playing audio:", e);
          });
        }
      };

      // ========================================
      // STEP 7: Handle connection state changes
      // ========================================
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        
        if (pc.connectionState === "connected") {
          setStatus("✅ Connected! Start speaking...");
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
      console.log("Connecting to:", webrtcUrl);
      
      const sdpResponse = await fetch(webrtcUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ephemeralToken}`,
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
      console.log("✅ Got SDP answer from Azure");

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
    setStatus("Disconnected. Click 'Start Session' to reconnect.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#050b18] via-[#040615] to-[#010109] px-6 py-10 text-white">
      <div className="w-full max-w-5xl space-y-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.35em] text-slate-300/80">
            Realtime Control
          </div>
          <h1 className="text-4xl font-semibold text-white md:text-5xl">
            <span className="bg-gradient-to-r from-sky-300 via-indigo-400 to-fuchsia-500 bg-clip-text text-transparent">
              Agent Command Center
            </span>
          </h1>
          <p className="text-sm text-slate-400 md:text-base">
            WebRTC Direct Connection • GPT-4o Realtime API
          </p>
        </div>

        {/* Hidden audio element */}
        <audio ref={audioElementRef} autoPlay />

        {/* Status Card */}
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-[#0b1020]/80 p-6 shadow-[0_35px_120px_-60px_rgba(59,130,246,0.5)] backdrop-blur">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    isConnected ? "bg-sky-400 animate-pulse" : "bg-slate-600"
                  }`}
                />
                <span className="text-sm font-medium tracking-wide text-slate-200">
                  {isConnected ? "Live" : "Standby"}
                </span>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">
                {isConnected ? "Session Active" : "Awaiting Start"}
              </span>
            </div>

            <p className="text-center text-sm text-slate-300 md:text-base">{status}</p>

            {/* Control Button */}
            <button
              onClick={isConnected ? stopConversation : startConversation}
              disabled={isLoading}
              className={`mt-6 w-full rounded-2xl px-10 py-4 text-lg font-semibold tracking-wide transition-all duration-200 ease-out hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                isConnected
                  ? "bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 shadow-[0_20px_45px_-25px_rgba(168,85,247,0.8)] hover:from-fuchsia-500 hover:via-purple-500 hover:to-indigo-500"
                  : "bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 shadow-[0_20px_45px_-25px_rgba(56,189,248,0.8)] hover:from-sky-400 hover:via-indigo-500 hover:to-purple-500"
              }`}
            >
              {isLoading
                ? "Connecting..."
                : isConnected
                ? "⏹ End Session"
                : "🚀 Start Session"}
            </button>
          </div>

          {/* Visualization */}
          <div className="rounded-3xl border border-white/10 bg-[#0a0f1c]/80 p-6 shadow-[0_45px_140px_-80px_rgba(14,116,144,0.8)] backdrop-blur">
            <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
              <span>Audio Visualization</span>
              <span>Waveform</span>
            </div>
            <div className="flex h-48 items-center justify-center rounded-2xl border border-white/5 bg-gradient-to-br from-[#0b1224] via-[#050912] to-[#02040b] text-[0.7rem] uppercase tracking-[0.4em] text-slate-600">
              awaiting signal
            </div>
          </div>
        </section>

        {/* Transcript Card */}
        {transcript.length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-[#090f1d]/80 p-6 shadow-[0_45px_160px_-90px_rgba(79,70,229,0.8)] backdrop-blur">
            <h2 className="mb-6 flex items-center gap-3 text-lg font-semibold text-slate-200">
              <span className="text-xl">💬</span>
              Conversation Transcript
            </h2>
            <div className="space-y-5 overflow-y-auto pr-1 max-h-[28rem]">
              {transcript.map((message, index) => {
                const isAi = message.role === "ai";
                return (
                  <div
                    key={index}
                    className={`flex ${isAi ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`flex max-w-2xl items-end gap-3 ${
                        isAi ? "flex-row" : "flex-row-reverse"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                          isAi
                            ? "border-indigo-400/40 bg-indigo-500/10 text-indigo-200"
                            : "border-sky-400/40 bg-sky-500/10 text-sky-200"
                        }`}
                      >
                        {isAi ? "✨" : "🧑"}
                      </div>
                      <div
                        className={`rounded-3xl px-5 py-3 text-sm leading-relaxed shadow-[0_18px_60px_-45px_rgba(99,102,241,0.7)] backdrop-blur ${
                          isAi
                            ? "bg-gradient-to-r from-[#0f172a]/90 via-[#111a2f]/70 to-[#0b1224]/60 text-slate-200"
                            : "bg-gradient-to-l from-sky-500/20 via-sky-500/10 to-cyan-400/10 text-slate-100"
                        } ${isAi ? "border border-indigo-400/20" : "border border-sky-400/20"}`}
                      >
                        <p className="whitespace-pre-wrap text-[0.95rem] text-slate-100">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}