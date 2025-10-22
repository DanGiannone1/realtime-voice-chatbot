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
  const [status, setStatus] = useState("Disconnected. Click 'Start' to reconnect.");
  const [transcript, setTranscript] = useState<string[]>([]);
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
          setStatus("Session created. Start speaking!");
          break;

        case "session.updated":
          setStatus("Session configured. Ready!");
          break;

        case "input_audio_buffer.speech_started":
          setStatus("Listening...");
          break;

        case "input_audio_buffer.speech_stopped":
          setStatus("Processing...");
          break;

        case "conversation.item.input_audio_transcription.completed":
          if (realtimeEvent.transcript) {
            setTranscript((prev) => [...prev, `You: ${realtimeEvent.transcript}`]);
            setStatus("AI is responding...");
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
          setStatus("Ready to listen");
          break;

        case "response.done":
          setStatus("Ready to listen");
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
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-[1400px] mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/50">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-blue-400">Live Activity Pulse</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                  <span>Simulated</span>
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-neutral-700"></div>

            {/* Start/Stop Button */}
            <button
              onClick={isConnected ? stopConversation : startConversation}
              disabled={isLoading}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isConnected
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {isLoading
                ? "Connecting..."
                : isConnected
                ? "Stop Conversation"
                : "Start Conversation"}
            </button>

            <div className="flex items-center gap-3 text-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className="text-gray-400">{status}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              1m
            </button>
            <button className="px-5 py-2 bg-neutral-800 text-gray-400 rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors">
              3m
            </button>
            <button className="px-5 py-2 bg-neutral-800 text-gray-400 rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors">
              5m
            </button>
          </div>
        </div>

        {/* Hidden audio element */}
        <audio ref={audioElementRef} autoPlay />

        {/* Visualization Box - Compact */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 h-[380px] flex flex-col">
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            {/* Placeholder for waveform visualization */}
            <div className="text-center space-y-2">
              <div className="text-xs opacity-50">Audio Visualization Area</div>
            </div>
          </div>
          
          {/* Bottom info bar */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-800 text-xs text-gray-500">
            <div>0:00 / 0:00</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                <span>You</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>AI</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span>Tool Call</span>
              </div>
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
        </div>

        {/* Transcript Card */}
        {transcript.length > 0 && (
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 max-h-[400px] overflow-y-auto transcript-scroll">
            <h2 className="text-base font-semibold mb-4 text-gray-300">Conversation Transcript</h2>
            <div className="space-y-2.5">
              {transcript.map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg text-sm ${
                    message.startsWith("You:")
                      ? "bg-neutral-800/60 border-l-2 border-gray-600 text-gray-300"
                      : "bg-emerald-950/30 border-l-2 border-emerald-600 text-emerald-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info footer */}
        <div className="text-center text-xs text-gray-600 pt-2">
          <p>Start your Python backend with WebSocket server on ws://localhost:8765</p>
          <p className="mt-1">
            <span className="text-emerald-500">Green waveform</span> = AI speaking • 
            <span className="text-gray-400"> Gray waveform</span> = You speaking • 
            <span className="text-amber-500"> Amber icons</span> = Tool calls
          </p>
        </div>
      </div>
    </main>
  );
}