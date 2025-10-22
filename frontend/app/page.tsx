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
    <main className="flex h-screen bg-gradient-to-b from-black to-[#1A1A1A] p-6 gap-6 text-white">
      {/* Hidden audio element */}
      <audio ref={audioElementRef} autoPlay />

      {/* Left Column - Main Content */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-[#7B9DD3]">
            Agent Command Center
          </h1>
          
          <div className="flex items-center gap-2">
            {/* Start/Stop Button */}
            <button
              onClick={isConnected ? stopConversation : startConversation}
              disabled={isLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
                isConnected
                  ? "bg-[#ef4444] hover:bg-[#dc2626] text-white"
                  : "bg-[#7B9DD3] hover:bg-[#6B8DC3] text-white"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                "Connecting..."
              ) : isConnected ? (
                <>
                  <Square className="w-4 h-4" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start
                </>
              )}
            </button>

            {/* Time Range Buttons */}
            <button className="px-3 py-2 bg-[#7B9DD3] hover:bg-[#6B8DC3] text-white rounded-md text-sm font-medium shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all">
              1m
            </button>
            <button className="px-3 py-2 bg-[#7B9DD3] hover:bg-[#6B8DC3] text-white rounded-md text-sm font-medium shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all">
              3m
            </button>
            <button className="px-3 py-2 bg-[#7B9DD3] hover:bg-[#6B8DC3] text-white rounded-md text-sm font-medium shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all">
              5m
            </button>
          </div>
        </div>

        {/* Visualization Panel */}
        <div className="bg-gradient-to-b from-black to-[#1A1A1A] border border-[#333333] rounded-lg p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5)] h-64">
          <div className="flex h-full items-center justify-center text-sm text-[#6b7280]">
            Telemetry data will appear here
          </div>
        </div>

        {/* Agent Telemetry Panel */}
        <div className="bg-gradient-to-b from-black to-[#1A1A1A] border border-[#333333] rounded-lg p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5)] flex-1 min-h-64">
          <h2 className="text-xl font-semibold mb-4">Agent Telemetry</h2>
          <div className="flex h-full items-center justify-center text-sm text-[#6b7280]">
            Telemetry data will appear here
          </div>
        </div>
      </div>

      {/* Right Column - Transcript Sidebar */}
      <div className="w-96 bg-gradient-to-b from-black to-[#1A1A1A] border border-[#333333] rounded-lg p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.5)] flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Conversation Transcript</h2>
        
        {transcript.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[#6b7280]">
            Start the conversation to see transcripts here
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {transcript.map((message, index) => {
              const isAi = message.role === "ai";
              const now = new Date();
              const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
              
              return (
                <div
                  key={index}
                  className={`flex flex-col ${isAi ? "items-start" : "items-end"}`}
                >
                  <div className="text-xs font-mono text-[#9ca3af] opacity-70 mb-1 flex items-center gap-1">
                    {isAi && <Sparkles className="w-3 h-3 text-[#10b981]" />}
                    {timestamp}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-lg p-3 shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
                      isAi
                        ? "bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] self-start"
                        : "bg-[#374151] border border-[#333333] self-end"
                    }`}
                  >
                    <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
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