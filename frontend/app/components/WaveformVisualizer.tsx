"use client";

import { useEffect, useRef, MutableRefObject } from "react";

interface WaveformVisualizerProps {
  isUserSpeakingRef: MutableRefObject<boolean>;
  isAiSpeakingRef: MutableRefObject<boolean>;
  isToolRunningRef: MutableRefObject<boolean>;
  /** Seconds visible in the chart (60 = 1m, 180 = 3m, 300 = 5m) */
  timeWindow?: number;
  /** Optional WebAudio analysers for mic and remote audio */
  userAnalyser?: AnalyserNode;
  aiAnalyser?: AnalyserNode;
  /** When false, the chart stays idle (prevents pre-session “grey lines”) */
  isActive?: boolean;
}

type State = "silence" | "user" | "ai" | "tool";

export default function WaveformVisualizer({
  isUserSpeakingRef,
  isAiSpeakingRef,
  isToolRunningRef,
  timeWindow = 60,
  userAnalyser,
  aiAnalyser,
  isActive = false,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const wrenchPathData =
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.911a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const axisBottomPad = 18; // space reserved for axis & labels
    const contentHeight = () => Math.max(1, height - axisBottomPad - 2);

    // time-based scrolling
    const lastTsRef = { t: performance.now() };
    let pxAccumulator = 0; // accumulate fractional pixels before we shift/draw

    const drawAxis = () => {
      const axisY = height - axisBottomPad;

      // baseline
      ctx.strokeStyle = "#B8997A";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, axisY);
      ctx.lineTo(width, axisY);
      ctx.stroke();

      // fixed ticks: 60s,45s,30s,15s,now
      const tickSeconds = [60, 45, 30, 15, 0];
      ctx.font = "11px monospace";
      ctx.textBaseline = "top";

      tickSeconds.forEach((secsAgo) => {
        const p = 1 - secsAgo / timeWindow; // 0..1 from left..right
        if (p < 0 || p > 1) return; // out of view for larger windows
        const x = Math.round(width * p);

        // tick
        ctx.strokeStyle = "#B8997A";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, axisY);
        ctx.lineTo(x, axisY + 6);
        ctx.stroke();

        // label - adjust alignment for edge labels to prevent clipping
        const label = secsAgo === 0 ? "now" : `${secsAgo}s`;
        ctx.fillStyle = "#E8D5C4";
        
        // Right edge (now): align right
        if (secsAgo === 0) {
          ctx.textAlign = "right";
          ctx.fillText(label, x - 2, axisY + 7);
        }
        // Left edge (60s): align left
        else if (secsAgo === timeWindow) {
          ctx.textAlign = "left";
          ctx.fillText(label, x + 2, axisY + 7);
        }
        // Middle labels: center
        else {
          ctx.textAlign = "center";
          ctx.fillText(label, x, axisY + 7);
        }
      });
    };

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, width, height);
      drawAxis();

      // reset scroll timer when layout changes
      lastTsRef.t = performance.now();
      pxAccumulator = 0;
    };

    const getRMS = (analyser?: AnalyserNode) => {
      if (!analyser) return 0;
      const binCount = analyser.fftSize / 2;
      const data = new Uint8Array(binCount);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128; // -1..1
        sum += v * v;
      }
      return Math.sqrt(sum / data.length); // 0..~1
    };

    // Colors to match legend
  const COLOR_USER = "#9CA3AF";    // gray (You)
  const COLOR_AI = "#FFB347";      // warm orange (AI)
  const COLOR_TOOL = "#FFD700";    // golden (tool)
  const COLOR_SILENCE = "#5D4037"; // warm brown
  let prevToolActive = false;

    const render = () => {
      const now = performance.now();
      const dtMs = now - lastTsRef.t;
      lastTsRef.t = now;

      // pixels per second so that the full width spans timeWindow seconds
      const pxPerSecond = width / timeWindow;
      pxAccumulator += (dtMs / 1000) * pxPerSecond;

      let didDraw = false;

      // Only draw when:
      // 1) we're active (connected), and
      // 2) we have at least 1px worth of elapsed time to scroll.
      if (isActive) {
        const sliceH = contentHeight();

        const wrenchPath =
          typeof Path2D !== "undefined" ? new Path2D(wrenchPathData) : null;
        const axisY = height - axisBottomPad;

        while (pxAccumulator >= 1) {
          // Shift the scrolling region left by 1 px
          if (sliceH > 0 && width > 1) {
            const imageData = ctx.getImageData(1, 0, width - 1, sliceH);
            ctx.putImageData(imageData, 0, 0);
            ctx.clearRect(width - 1, 0, 1, sliceH);
          }

          // Loudness
          const userR = getRMS(userAnalyser);
          const aiR = getRMS(aiAnalyser);

          // State decision: prefer explicit flags, fall back to RMS
          const VOICE_THRESHOLD = 0.04;
          const toolActive = isToolRunningRef.current;
          let state: State = "silence";
          if (toolActive) state = "tool";
          else if (isUserSpeakingRef.current || userR > VOICE_THRESHOLD)
            state = "user";
          else if (isAiSpeakingRef.current || aiR > VOICE_THRESHOLD) state = "ai";

          // Map loudness to visual height (soft curve)
          const loud = Math.max(userR, aiR);
          const normalized = Math.min(1, Math.pow(loud * 1.8, 0.8));
          const maxBarH = Math.max(2, sliceH - 6);
          let barH = 2;
          if (state === "user" || state === "ai") {
            barH = Math.max(2, Math.floor(normalized * maxBarH));
          } else if (state === "tool") {
            barH = Math.max(2, Math.floor(maxBarH * 0.35));
          }

          const isTool = state === "tool";
          const toolStarted = toolActive && !prevToolActive;

          if (isTool) {
            const barX = Math.max(0, width - 1);

            if (toolStarted && wrenchPath) {
              const iconSize = 16;
              const iconPadding = 6;
              const iconX = Math.max(0, width - iconSize - iconPadding);
              const iconY = Math.max(2, sliceH * 0.2);
              const iconCenterX = iconX + iconSize / 2;
              const clearX = Math.max(0, iconX - 1);
              const clearW = Math.min(
                width - clearX,
                iconSize + iconPadding + 2
              );

              ctx.clearRect(clearX, 0, clearW, sliceH);

              ctx.save();
              ctx.translate(iconX, iconY);
              const scale = iconSize / 24;
              ctx.scale(scale, scale);
              ctx.strokeStyle = COLOR_TOOL;
              ctx.lineWidth = 1.8 / scale;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              ctx.stroke(wrenchPath);
              ctx.restore();

              ctx.strokeStyle = COLOR_TOOL;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(iconCenterX, iconY + iconSize + 2);
              ctx.lineTo(iconCenterX, axisY);
              ctx.stroke();
            } else if (toolStarted) {
              ctx.strokeStyle = COLOR_TOOL;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(barX, Math.max(2, sliceH * 0.2));
              ctx.lineTo(barX, axisY);
              ctx.stroke();
            }
            // keep timeline continuity with a subtle column so we don't leave gaps
            ctx.fillStyle = COLOR_SILENCE;
            ctx.fillRect(barX, Math.max(0, sliceH - 2), 1, 2);
          } else {
            let color = COLOR_SILENCE;
            if (state === "user") color = COLOR_USER;
            else if (state === "ai") color = COLOR_AI;

            // Draw new 1px column at the right
            ctx.fillStyle = color;
            const y = Math.max(0, sliceH - barH);
            ctx.fillRect(Math.max(0, width - 1), y, 1, barH);
          }

          pxAccumulator -= 1;
          didDraw = true;
          prevToolActive = toolActive;
        }
      }

      // If we drew new content, refresh the axis so labels stay crisp
      if (didDraw) {
        const axisY = height - axisBottomPad;
        ctx.clearRect(0, axisY, width, axisBottomPad + 2);
        drawAxis();
      }

      rafRef.current = requestAnimationFrame(render);
    };

    setupCanvas();
    rafRef.current = requestAnimationFrame(render);

    const onResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setupCanvas();
      rafRef.current = requestAnimationFrame(render);
    };
    window.addEventListener("resize", onResize);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [
    timeWindow,
    userAnalyser,
    aiAnalyser,
    isUserSpeakingRef,
    isAiSpeakingRef,
    isToolRunningRef,
    isActive,
  ]);

  return <canvas ref={canvasRef} className="h-full w-full" style={{ display: "block" }} />;
}