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
  timestamp: string;
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Click 'Start Session' to begin");
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRange, setSelectedRange] = useState("1m");

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const getTimestamp = () =>
    new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });

  const timeRanges = ["1m", "3m", "5m"];

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
              {
                role: "user",
                content: realtimeEvent.transcript ?? "",
                timestamp: getTimestamp(),
              },
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
                {
                  role: "ai",
                  content: realtimeEvent.delta ?? "",
                  timestamp: getTimestamp(),
                },
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
    <main className="flex min-h-screen w-full bg-gradient-to-b from-black to-[#1A1A1A] p-6 text-white">
      <div className="flex w-full gap-6">
        <div className="flex flex-1 flex-col gap-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#7B9DD3]">
                Agent Command Center
              </h1>
              <p className="mt-2 text-sm text-[#9ca3af]">
                WebRTC Direct Connection • GPT-4o Realtime API
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={isConnected ? stopConversation : startConversation}
                disabled={isLoading}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-70 ${
                  isConnected ? "bg-[#ef4444] hover:bg-[#dc2626]" : "bg-[#7B9DD3] hover:bg-[#6B8DC3]"
                }`}
              >
                <span aria-hidden className="text-base">
                  {isConnected ? "■" : "▶"}
                </span>
                {isLoading ? "Connecting..." : isConnected ? "Stop" : "Start"}
              </button>
              {timeRanges.map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setSelectedRange(range)}
                  className={`rounded-md px-3 py-2 text-sm font-medium shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-colors duration-200 ${
                    selectedRange === range
                      ? "bg-[#5B7DB3]"
                      : "bg-[#7B9DD3] hover:bg-[#6B8DC3]"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </header>

          <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

          <section className="flex flex-col gap-6">
            <div className="rounded-lg border border-[#333333] bg-gradient-to-b from-[#050505] to-[#111111] p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Audio Visualization</h2>
                  <p className="mt-2 text-sm text-[#9ca3af]">{status}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#9ca3af]">
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      isConnected ? "bg-[#10b981]" : "bg-[#374151]"
                    }`}
                  />
                  <span>{isConnected ? "Live" : "Standby"}</span>
                </div>
              </div>
              <div className="mt-6 flex flex-col rounded-md border border-dashed border-[#333333] bg-black/60 p-4">
                <div className="flex flex-1 items-center justify-center text-xs uppercase tracking-[0.35em] text-[#6b7280]">
                  awaiting signal
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-[#9ca3af]">
                  <span>0:00 / 0:00</span>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#6b7280]" />
                      <span>You</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                      <span>AI</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                      <span>Tool</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex justify-between text-xs uppercase tracking-widest text-[#6b7280]">
                  {['60s', '45s', '30s', '15s', 'now'].map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex min-h-[16rem] flex-col rounded-lg border border-[#333333] bg-gradient-to-b from-[#050505] to-[#111111] p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
              <h2 className="text-xl font-semibold text-white">Agent Telemetry</h2>
              <div className="mt-6 flex flex-1 items-center justify-center rounded-md border border-dashed border-[#333333] bg-black/40 text-sm text-[#6b7280]">
                Telemetry data will appear here
              </div>
            </div>
          </section>
        </div>

        <aside className="flex h-[calc(100vh-3rem)] w-96 flex-col rounded-lg border border-[#333333] bg-gradient-to-b from-[#050505] to-[#111111] p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
          <h2 className="text-xl font-semibold text-white">Conversation Transcript</h2>
          <div className="mt-4 flex-1 overflow-y-auto pr-2">
            {transcript.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-[#6b7280]">
                Start the conversation to see transcripts here
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {transcript.map((message, index) => {
                  const isAi = message.role === "ai";
                  return (
                    <div key={index} className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[85%] rounded-lg border p-3 shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
                          isAi
                            ? 'border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.1)]'
                            : 'border-[#333333] bg-[#374151]'
                        }`}
                      >
                        <div
                          className={`mb-1 flex items-center text-xs font-mono text-[#9ca3af]/70 ${
                            isAi ? 'justify-start' : 'justify-end'
                          }`}
                        >
                          {isAi && (
                            <span className="mr-2 inline-flex h-3 w-3 items-center justify-center text-[#10b981]">
                              ✦
                            </span>
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
        </aside>
      </div>
    </main>
  );
}