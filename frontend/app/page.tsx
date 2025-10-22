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
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="max-w-4xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-fuchsia-500 text-transparent bg-clip-text">
            Agent Command Center
          </h1>
          <p className="text-gray-400 text-lg">
            WebRTC Direct Connection • GPT-4o Realtime API
          </p>
        </div>

        {/* Hidden audio element */}
        <audio ref={audioElementRef} autoPlay />

        {/* Status Card */}
        <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected
                    ? "bg-purple-400 animate-pulse"
                    : "bg-slate-500"
                }`}
              />
              <span className="font-semibold">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          <p className="text-gray-300 text-center py-2">{status}</p>

          {/* Control Button */}
          <button
            onClick={isConnected ? stopConversation : startConversation}
            disabled={isLoading}
            className={`w-full mt-4 px-8 py-4 rounded-xl text-xl font-semibold transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              isConnected
                ? "bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 shadow-lg shadow-purple-500/50"
                : "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-500/40"
            }`}
          >
            {isLoading
              ? "Connecting..."
              : isConnected
              ? "⏹ End Session"
              : "🚀 Start Session"}
          </button>
        </div>

        {/* Transcript Card */}
        {transcript.length > 0 && (
          <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700 max-h-96 overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>💬</span>
              Conversation Transcript
            </h2>
            <div className="space-y-4">
              {transcript.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "ai" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex max-w-xl items-start gap-3 ${
                      message.role === "ai" ? "flex-row-reverse text-right" : ""
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                        message.role === "ai"
                          ? "border-purple-400/60 bg-purple-500/20 text-purple-200"
                          : "border-blue-400/60 bg-blue-500/20 text-blue-200"
                      }`}
                    >
                      {message.role === "ai" ? "🤖" : "🧑"}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-3 shadow-lg backdrop-blur-sm ${
                        message.role === "ai"
                          ? "bg-gradient-to-l from-purple-500/20 to-indigo-500/10 border border-purple-400/40"
                          : "bg-gradient-to-r from-blue-500/20 to-cyan-500/10 border border-blue-400/40"
                      }`}
                    >
                      <p className="text-sm leading-relaxed text-gray-100 whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}