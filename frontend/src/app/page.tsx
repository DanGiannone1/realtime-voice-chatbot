"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, Mic, UserRound, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useVoiceChat } from "@/hooks/use-voice-chat";

type TimeRange = "1m" | "3m" | "5m";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "3m", label: "3m" },
  { value: "5m", label: "5m" },
];

const RANGE_TO_MS: Record<TimeRange, number> = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
};

const RANGE_LABELS: Record<TimeRange, string[]> = {
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

const SILENCE_COLOR = "rgba(226,232,240,0.35)";

const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
};

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
  const transcriptsRef = useRef<HTMLDivElement>(null);

  const waveformCacheRef = useRef(new Map<string, number[]>());
  const containerSizeRef = useRef({ width: 0, height: 0 });
  const animationFrameRef = useRef<number | null>(null);

  const connectionLabel = useMemo(() => {
    if (isConnected) return "Connected";
    if (isRunning) return "Connecting";
    return "Disconnected";
  }, [isConnected, isRunning]);

  const statusPillClass = useMemo(() => {
    if (isConnected) return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40";
    if (isRunning) return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40";
    return "bg-red-500/10 text-red-200 ring-1 ring-red-500/30";
  }, [isConnected, isRunning]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = containerRef.current;
    if (!container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (containerSizeRef.current.width === 0 || containerSizeRef.current.height === 0) {
      const rect = container.getBoundingClientRect();
      containerSizeRef.current = { width: rect.width, height: rect.height };
    }

    const { width, height } = containerSizeRef.current;
    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    if (typeof ctx.resetTransform === "function") {
      ctx.resetTransform();
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const paddingX = 56;
    const paddingY = 28;
    const centerY = height / 2;
    const rangeMs = RANGE_TO_MS[timeRange];
    const now = Date.now();
    const startTime = now - rangeMs;

    const verticalGradient = ctx.createLinearGradient(0, 0, 0, height);
    verticalGradient.addColorStop(0, "rgba(15,23,42,0.4)");
    verticalGradient.addColorStop(1, "rgba(15,23,42,0.2)");
    ctx.fillStyle = verticalGradient;
    const rectX = paddingX - 24;
    const rectY = paddingY;
    const rectWidth = width - rectX * 2;
    const rectHeight = height - paddingY * 2;
    const radius = 24;
    ctx.beginPath();
    ctx.moveTo(rectX + radius, rectY);
    ctx.lineTo(rectX + rectWidth - radius, rectY);
    ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
    ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
    ctx.quadraticCurveTo(
      rectX + rectWidth,
      rectY + rectHeight,
      rectX + rectWidth - radius,
      rectY + rectHeight
    );
    ctx.lineTo(rectX + radius, rectY + rectHeight);
    ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
    ctx.lineTo(rectX, rectY + radius);
    ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = paddingY + ((height - paddingY * 2) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(paddingX, y);
      ctx.lineTo(width - paddingX, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(226,232,240,0.08)";
    ctx.beginPath();
    ctx.moveTo(paddingX, centerY);
    ctx.lineTo(width - paddingX, centerY);
    ctx.stroke();

    const timeline = activities
      .filter((event) => event.timestamp >= startTime - 1000)
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
        const x =
          paddingX + ((clampedTime - startTime) / rangeMs) * (width - paddingX * 2);
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

    const pixelsPerMs = (width - paddingX * 2) / rangeMs;

    if (waveformCacheRef.current.size > 600) {
      waveformCacheRef.current.clear();
    }

    const getWaveformPoints = (segment: Segment, segmentWidth: number) => {
      const key = `${segment.start}-${segment.end}-${segment.type}-${Math.round(segmentWidth)}`;
      const cached = waveformCacheRef.current.get(key);
      if (cached) return cached;

      const sampleSpacing = 6;
      const sampleCount = Math.max(6, Math.floor(segmentWidth / sampleSpacing));
      const baseAmplitude = segment.type === "ai" ? 44 : segment.type === "user" ? 34 : 6;
      const variance = segment.type === "ai" ? 22 : segment.type === "user" ? 16 : 2;
      const points: number[] = [];

      for (let i = 0; i <= sampleCount; i += 1) {
        const mixSeed = segment.start * 0.0001 + segment.end * 0.0003 + i * 12.9898;
        const random = pseudoRandom(mixSeed);
        const amplitude =
          segment.type === "silence"
            ? 4
            : baseAmplitude + (random - 0.5) * variance * 2;
        points.push(Math.max(segment.type === "silence" ? 2 : 8, amplitude));
      }

      waveformCacheRef.current.set(key, points);
      return points;
    };

    segments.forEach((segment) => {
      const segmentWidth = Math.max((segment.end - segment.start) * pixelsPerMs, 2);
      const x = paddingX + (segment.start - startTime) * pixelsPerMs;

      if (segment.type === "silence") {
        ctx.strokeStyle = "rgba(148,163,184,0.25)";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(x, centerY);
        ctx.lineTo(x + segmentWidth, centerY);
        ctx.stroke();
        return;
      }

      const waveformPoints = getWaveformPoints(segment, segmentWidth);
      const gradient = ctx.createLinearGradient(x, centerY - 80, x, centerY + 80);
      if (segment.type === "ai") {
        gradient.addColorStop(0, "rgba(34,197,94,0.9)");
        gradient.addColorStop(1, "rgba(16,185,129,0.55)");
      } else {
        gradient.addColorStop(0, "rgba(148,163,184,0.85)");
        gradient.addColorStop(1, "rgba(100,116,139,0.45)");
      }

      ctx.fillStyle = gradient;
      ctx.shadowColor = segment.type === "ai" ? "rgba(16,185,129,0.35)" : "rgba(148,163,184,0.25)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(x, centerY);

      waveformPoints.forEach((amplitude, index) => {
        const t = index / (waveformPoints.length - 1);
        const pointX = x + t * segmentWidth;
        ctx.lineTo(pointX, centerY - amplitude);
      });

      ctx.lineTo(x + segmentWidth, centerY);

      for (let i = waveformPoints.length - 1; i >= 0; i -= 1) {
        const t = i / (waveformPoints.length - 1);
        const pointX = x + t * segmentWidth;
        ctx.lineTo(pointX, centerY + waveformPoints[i]);
      }

      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = segment.type === "ai" ? "rgba(16,185,129,0.35)" : "rgba(148,163,184,0.35)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    markers.forEach((marker) => {
      ctx.font = "16px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(250,204,21,0.85)";
      ctx.fillText("⚡", marker.x, centerY - 64);
    });

    ctx.fillStyle = "rgba(226,232,240,0.55)";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "center";
    const labels = RANGE_LABELS[timeRange];
    labels.forEach((label, idx) => {
      const labelX = paddingX + ((width - paddingX * 2) * idx) / (labels.length - 1);
      ctx.fillText(label, labelX, height - paddingY + 16);
    });

    ctx.fillStyle = "rgba(148,163,184,0.35)";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Silence", paddingX, paddingY - 10);

    ctx.fillStyle = SILENCE_COLOR;
    ctx.fillRect(paddingX, paddingY - 6, 32, 2);
  }, [activities, currentSpeaker, timeRange]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width !== containerSizeRef.current.width || height !== containerSizeRef.current.height) {
        containerSizeRef.current = { width, height };
        drawWaveform();
      }
    };

    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const { width, height } = entry.contentRect;
          if (
            width !== containerSizeRef.current.width ||
            height !== containerSizeRef.current.height
          ) {
            containerSizeRef.current = { width, height };
            drawWaveform();
          }
        });
      });
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, [drawWaveform]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const MIN_FRAME_INTERVAL = 16;
    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const renderFrame = (timestamp: number) => {
      if (timestamp - lastTimestamp >= MIN_FRAME_INTERVAL) {
        drawWaveform();
        lastTimestamp = timestamp;
      }
      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    drawWaveform();
    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [drawWaveform]);

  useEffect(() => {
    const container = transcriptsRef.current;
    if (!container) return;
    if (transcripts.length <= 1) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [transcripts]);

  const onToggle = async () => {
    if (isRunning) {
      await stop();
    } else {
      await start();
    }
  };

  const currentSpeakerLabel =
    currentSpeaker === "silence" ? "Listening" : currentSpeaker === "user" ? "You" : "AI";

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <Card className="border-white/10 bg-black/40 text-white">
          <CardHeader className="flex flex-col gap-6 border-b border-white/5 pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
                  Live Activity Pulse
                </p>
                <p className="mt-1 text-base text-white/70">
                  Visualize the conversation timeline in real time.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide ${statusPillClass}`}
              >
                {connectionLabel}
              </span>
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                <div className="flex items-center gap-1">
                  <Mic className={`h-4 w-4 ${isUserSpeaking ? "text-slate-100" : "text-white/30"}`} />
                  <span className="hidden sm:inline">You</span>
                </div>
                <div className="h-4 w-px bg-white/10" />
                <div className="flex items-center gap-1">
                  <Volume2 className={`h-4 w-4 ${isAISpeaking ? "text-emerald-300" : "text-white/30"}`} />
                  <span className="hidden sm:inline">Assistant</span>
                </div>
              </div>
              <Button onClick={onToggle} variant={isRunning ? "outline" : "default"} className="shadow-lg">
                {isRunning ? "Stop Session" : "Start Session"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-8 pt-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-medium text-white/60">Activity range</div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTimeRange(option.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        timeRange === option.value
                          ? "bg-sky-500 text-white shadow-[0_0_0_1px_rgba(14,165,233,0.6)]"
                          : "text-white/50 hover:text-white/80"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                ref={containerRef}
                className="relative h-[22rem] w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-900/20"
              >
                <canvas ref={canvasRef} className="h-full w-full" />
                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/5" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-white/70">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/40">Current speaker</p>
                  <p className="mt-1 text-lg font-semibold text-white">{currentSpeakerLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-wide text-white/40">
                  <div className="flex items-center gap-2 text-white/70">
                    <span className="h-2 w-8 rounded-full bg-emerald-400/80" />
                    AI
                  </div>
                  <div className="flex items-center gap-2 text-white/70">
                    <span className="h-2 w-8 rounded-full bg-slate-300/70" />
                    You
                  </div>
                  <div className="flex items-center gap-2 text-white/70">
                    <span className="h-px w-8 bg-white/50" />
                    Silence
                  </div>
                </div>
              </div>
              {error && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}
            </div>

            <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">
                  Conversation Transcript
                </p>
                <span className="text-xs text-white/40">{transcripts.length} entries</span>
              </div>
              <div
                ref={transcriptsRef}
                className="mt-5 flex h-[22rem] flex-col gap-4 overflow-y-auto pr-1"
              >
                {transcripts.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-white/50">
                    <p>Transcripts will appear here as soon as the conversation begins.</p>
                    <p className="text-xs text-white/30">Stay on this pane to follow along in real time.</p>
                  </div>
                ) : (
                  transcripts.map((entry, index) => (
                    <div
                      key={`${entry.timestamp}-${index}`}
                      className={`flex gap-3 ${entry.speaker === "ai" ? "flex-row-reverse text-right" : ""}`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                          entry.speaker === "ai"
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                            : "border-white/10 bg-white/10 text-white/80"
                        }`}
                      >
                        {entry.speaker === "ai" ? <Bot className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                      </div>
                      <div
                        className={`max-w-xs rounded-3xl border px-4 py-3 text-sm leading-relaxed ${
                          entry.speaker === "ai"
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                            : "border-white/10 bg-white/10 text-white/90"
                        }`}
                      >
                        {entry.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/30">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.3em] text-white/40">
              Session Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 text-sm text-white/70 sm:grid-cols-3">
            <div className="space-y-1 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/40">Connection</p>
              <p className="text-base font-medium text-white">{connectionLabel}</p>
            </div>
            <div className="space-y-1 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/40">User speaking</p>
              <p className={`text-base font-medium ${isUserSpeaking ? "text-emerald-300" : "text-white"}`}>
                {isUserSpeaking ? "Active" : "Idle"}
              </p>
            </div>
            <div className="space-y-1 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/40">AI responding</p>
              <p className={`text-base font-medium ${isAISpeaking ? "text-emerald-300" : "text-white"}`}>
                {isAISpeaking ? "Streaming" : "Standing by"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

