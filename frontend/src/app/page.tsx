"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useVoiceChat } from "@/hooks/use-voice-chat";

type TimeRange = "1m" | "3m" | "5m";

const rangeToMs: Record<TimeRange, number> = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
};

const rangeLabels: Record<TimeRange, string[]> = {
  "1m": ["60s", "45s", "30s", "15s", "now"],
  "3m": ["180s", "135s", "90s", "45s", "now"],
  "5m": ["300s", "225s", "150s", "75s", "now"],
};

type Segment = {
  start: number;
  end: number;
  type: "user" | "ai" | "silence";
};

type ToolMarker = {
  timestamp: number;
  x: number;
};

function useAnimationFrame(callback: () => void, isActive: boolean = true) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isActive) return;
    
    let frameId: number;
    const loop = () => {
      callbackRef.current();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isActive]);
}

export default function Page() {
  const {
    start,
    stop,
    isRunning,
    isConnected,
    isUserSpeaking,
    isAISpeaking,
    currentSpeaker,
    transcripts,
    activities,
    error,
  } = useVoiceChat();

  const [timeRange, setTimeRange] = useState<TimeRange>("1m");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const connectionLabel = useMemo(() => {
    if (isConnected) return "Connected";
    if (isRunning) return "Connecting";
    return "Disconnected";
  }, [isConnected, isRunning]);

  const statusPillClass = useMemo(() => {
    if (isConnected) return "bg-emerald-500/20 text-emerald-200";
    if (isRunning) return "bg-amber-500/20 text-amber-200";
    return "bg-red-500/10 text-red-200";
  }, [isConnected, isRunning]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = container.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    if (typeof ctx.resetTransform === "function") {
      ctx.resetTransform();
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const padding = 48;
    const centerY = height / 2;
    const rangeMs = rangeToMs[timeRange];
    const now = Date.now();
    const startTime = now - rangeMs;

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(padding, centerY);
    ctx.lineTo(width - padding, centerY);
    ctx.stroke();

    const timeline = activities
      .filter((event) => event.timestamp >= startTime)
      .sort((a, b) => a.timestamp - b.timestamp);

    const augmented = [
      { timestamp: startTime, type: "silence" as const },
      ...timeline,
      { timestamp: now, type: currentSpeaker },
    ];

    const segments: Segment[] = [];
    const markers: ToolMarker[] = [];

    let lastType: Segment["type"] = "silence";
    let lastTimestamp = startTime;

    for (let i = 1; i < augmented.length; i += 1) {
      const event = augmented[i];
      const clampedTime = Math.max(Math.min(event.timestamp, now), startTime);
      if (event.type === "tool") {
        const x = padding + ((clampedTime - startTime) / rangeMs) * (width - padding * 2);
        markers.push({ timestamp: event.timestamp, x });
        continue;
      }
      if (clampedTime > lastTimestamp) {
        segments.push({ start: lastTimestamp, end: clampedTime, type: lastType });
      }
      lastTimestamp = clampedTime;
      lastType = event.type;
    }

    if (lastTimestamp < now) {
      segments.push({ start: lastTimestamp, end: now, type: lastType });
    }

    const pixelsPerMs = (width - padding * 2) / rangeMs;

    segments.forEach((segment) => {
      const segmentWidth = Math.max((segment.end - segment.start) * pixelsPerMs, 1);
      const x = padding + (segment.start - startTime) * pixelsPerMs;
      const color =
        segment.type === "user"
          ? "rgba(148, 163, 184, 0.6)"
          : segment.type === "ai"
          ? "rgba(74, 222, 128, 0.8)"
          : "rgba(255, 255, 255, 0.12)";
      const amplitude = segment.type === "silence" ? 18 : 56;
      ctx.fillStyle = color;
      ctx.fillRect(x, centerY - amplitude / 2, segmentWidth, amplitude);
    });

    markers.forEach((marker) => {
      ctx.fillStyle = "rgba(250, 204, 21, 0.9)";
      ctx.beginPath();
      ctx.arc(marker.x, centerY - 64, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "center";
    const labels = rangeLabels[timeRange];
    labels.forEach((label, idx) => {
      const x = padding + ((width - padding * 2) * idx) / (labels.length - 1);
      ctx.fillText(label, x, height - 12);
    });

  }, [activities, currentSpeaker, timeRange]);

  // Draw only when data changes, no animation
  useEffect(() => {
    draw();
  }, [draw]);

  const onToggle = async () => {
    if (isRunning) {
      await stop();
    } else {
      await start();
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center px-6">
      <div className="w-full max-w-5xl pt-16">
        <Card className="border-white/10 bg-black/40 text-white">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Activity className="h-4 w-4 text-emerald-400" />
              Live Activity Pulse
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${statusPillClass}`}
              >
                {connectionLabel}
              </span>
              <div className="flex items-center gap-1 text-xs text-white/50">
                <Mic className={`h-4 w-4 ${isUserSpeaking ? "text-slate-200" : "text-white/30"}`} />
                <Volume2 className={`h-4 w-4 ${isAISpeaking ? "text-emerald-300" : "text-white/30"}`} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/60">
                {(["1m", "3m", "5m"] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setTimeRange(range)}
                    className={`rounded-full border px-3 py-1 transition ${
                      timeRange === range
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-white/10 bg-transparent hover:border-white/30 hover:bg-white/5"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <div
                ref={containerRef}
                className="relative h-60 w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-transparent to-white/5"
              >
                <canvas ref={canvasRef} className="h-full w-full" />
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-white/70">
                  Current speaker:
                  <span className="ml-2 font-semibold text-white">
                    {currentSpeaker === "silence"
                      ? "Listening"
                      : currentSpeaker === "user"
                      ? "You"
                      : "AI"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button onClick={onToggle} variant={isRunning ? "outline" : "default"}>
                    {isRunning ? "Stop Session" : "Start Session"}
                  </Button>
                </div>
              </div>
              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="border-white/10 bg-black/30">
            <CardHeader>
              <CardTitle>Conversation Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-2">
                {transcripts.length === 0 ? (
                  <p className="text-sm text-white/50">
                    Transcript will appear here once the conversation begins.
                  </p>
                ) : (
                  transcripts.map((entry, index) => (
                    <div key={`${entry.timestamp}-${index}`} className="space-y-1">
                      <div className="text-xs uppercase tracking-wide text-white/40">
                        {entry.speaker === "user" ? "You" : "AI"}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/90">
                        {entry.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/30">
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="font-medium text-white">{connectionLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>User speaking</span>
                <span className={`font-medium ${isUserSpeaking ? "text-emerald-300" : "text-white/40"}`}>
                  {isUserSpeaking ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>AI responding</span>
                <span className={`font-medium ${isAISpeaking ? "text-emerald-300" : "text-white/40"}`}>
                  {isAISpeaking ? "Yes" : "No"}
                </span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-white/60">
                Connect to your Python backend to see live audio activity. Green waveform shows AI speaking, gray waveform shows
                you speaking, and amber icons mark tool calls.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
