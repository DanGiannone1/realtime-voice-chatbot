"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Square, Sparkles } from "lucide-react";

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
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1m' | '3m' | '5m'>('1m');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isAiRespondingRef = useRef(false);

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

  const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
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
                timestamp: getTimestamp()
              },
            ]);
            setStatus("🤖 AI is responding...");
            isAiRespondingRef.current = true;
          }
          break;

        case "response.audio_transcript.delta":
          if (realtimeEvent.delta) {
            setTranscript((prev) => {
              const lastIndex = prev.length - 1;
              // Only append to last message if it's AI AND we're currently in an AI response
              if (lastIndex >= 0 && prev[lastIndex].role === "ai" && isAiRespondingRef.current) {
                const updated = [...prev];
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  content: `${updated[lastIndex].content}${realtimeEvent.delta}`,
                };
                return updated;
              }
              // Create new AI message only if we're in AI responding mode
              if (isAiRespondingRef.current) {
                return [
                  ...prev,
                  { 
                    role: "ai", 
                    content: realtimeEvent.delta ?? "",
                    timestamp: getTimestamp()
                  },
                ];
              }
              return prev;
            });
          }
          break;

        case "response.audio_transcript.done":
          // Transcript is done but audio might still be playing
          // Don't change status here
          break;

        case "response.content_part.done":
        case "response.output_item.done":
        case "response.done":
          // These events fire when content is generated, but audio might still be playing
          // Don't change status here
          break;

        case "output_audio_buffer.stopped":
          // Audio playback is actually complete
          setStatus("✅ Ready to listen...");
          isAiRespondingRef.current = false;
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
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#7B9DD3' }}>
              Agent Command Center
            </h1>
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4" style={{ color: '#10b981' }} />
              <p className="text-slate-400">{status}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={isConnected ? stopConversation : startConversation}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ 
                backgroundColor: isConnected ? '#ef4444' : '#7B9DD3'
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
                  Start
                </>
              )}
            </button>
            <button
              onClick={() => setSelectedTimeRange('1m')}
              className="rounded-md px-3 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-200 hover:opacity-90"
              style={{ 
                backgroundColor: selectedTimeRange === '1m' ? '#7B9DD3' : '#374151',
                opacity: selectedTimeRange === '1m' ? 1 : 0.6
              }}
            >
              1m
            </button>
            <button
              onClick={() => setSelectedTimeRange('3m')}
              className="rounded-md px-3 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-200 hover:opacity-90"
              style={{ 
                backgroundColor: selectedTimeRange === '3m' ? '#7B9DD3' : '#374151',
                opacity: selectedTimeRange === '3m' ? 1 : 0.6
              }}
            >
              3m
            </button>
            <button
              onClick={() => setSelectedTimeRange('5m')}
              className="rounded-md px-3 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-200 hover:opacity-90"
              style={{ 
                backgroundColor: selectedTimeRange === '5m' ? '#7B9DD3' : '#374151',
                opacity: selectedTimeRange === '5m' ? 1 : 0.6
              }}
            >
              5m
            </button>
          </div>
        </div>

        {/* Visualization Panel */}
        <div className="flex h-64 flex-col rounded-lg border border-[#333333] p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5)]" style={{ background: 'linear-gradient(to bottom, #000000 0%, #1A1A1A 100%)' }}>
          <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-wider text-gray-500">
            <span>Audio Visualization</span>
            <span>Waveform</span>
          </div>
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            Telemetry data will appear here
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">0:14 / 0:14</span>
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
                <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                <span>Tool Call</span>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Telemetry Panel */}
        <div className="flex min-h-64 flex-1 flex-col rounded-lg border border-[#333333] p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5)]" style={{ background: 'linear-gradient(to bottom, #000000 0%, #1A1A1A 100%)' }}>
          <h2 className="mb-4 text-xl font-semibold">Agent Telemetry</h2>
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            <p>Disconnected. Click 'Start Session' to reconnect.</p>
          </div>
        </div>
      </div>

      {/* Right Column - Conversation Transcript */}
      <div className="flex w-96 flex-col rounded-lg border border-[#333333] p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5)]" style={{ background: 'linear-gradient(to bottom, #000000 0%, #1A1A1A 100%)' }}>
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
                    <div className="mb-1 flex items-center gap-1 font-mono text-xs opacity-70" style={{ color: '#9ca3af' }}>
                      {isAi && <Sparkles className="h-5 w-5" style={{ color: '#10b981' }} />}
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
