"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Einmaliger Konfettistoß der Cards-Bestätigung: von beiden unteren Seiten
 * nach oben in die Mitte, Gold/Cyan/Orange/Violett, Papier- und kleine
 * Kartenformen, ~2 s, ohne Audio. Canvas liegt über der Seite mit
 * pointer-events: none und wird nach dem Ende entfernt. Auf kleinen
 * Displays weniger Partikel. Bei prefers-reduced-motion wird nichts gezeichnet
 * (die Seite zeigt stattdessen ein statisches Erfolgssymbol).
 */

const COLORS = ["#ffd56a", "#51d9ed", "#ff8a32", "#a88bff", "#ffe28f", "#e75c58"];
const DURATION_MS = 2000;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  shape: "paper" | "card" | "dot";
  wobble: number;
}

function spawn(width: number, height: number, count: number): Particle[] {
  const particles: Particle[] = [];
  const centerX = width / 2;
  for (let side = 0; side < 2; side++) {
    const originX = side === 0 ? 0 : width;
    const dir = side === 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      // Richtung Mitte/oben mit Streuung; Geschwindigkeit in px/s
      const angleToCenter = Math.atan2(-(height * 0.65), (centerX - originX) * dir);
      const angle = angleToCenter + (Math.random() - 0.5) * 0.9;
      const speed = 620 + Math.random() * 520;
      const shape = Math.random() < 0.18 ? "card" : Math.random() < 0.3 ? "dot" : "paper";
      particles.push({
        x: originX + (Math.random() - 0.5) * 30,
        y: height + Math.random() * 20,
        vx: Math.cos(angle) * speed * dir,
        vy: Math.sin(angle) * speed,
        w: shape === "card" ? 10 : shape === "dot" ? 5 : 7,
        h: shape === "card" ? 14 : shape === "dot" ? 5 : 11,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#ffd56a",
        shape,
        wobble: Math.random() * Math.PI * 2,
      });
    }
  }
  return particles;
}

export function CardsConfetti({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setFinished(true);
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.scale(dpr, dpr);

    const perSide = width < 640 ? 45 : 90;
    const particles = spawn(width, height, perSide);
    const start = performance.now();
    let last = start;
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);
      const fade = elapsed > DURATION_MS - 500 ? Math.max(0, (DURATION_MS - elapsed) / 500) : 1;
      for (const p of particles) {
        p.vy += 1500 * dt; // Schwerkraft
        p.vx *= 0.985;
        p.x += p.vx * dt + Math.sin(p.wobble + elapsed / 180) * 0.6;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y > height + 40) continue;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "dot") {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          if (p.shape === "card") {
            ctx.strokeStyle = "rgba(8,12,24,0.7)";
            ctx.lineWidth = 1;
            ctx.strokeRect(-p.w / 2 + 1.5, -p.h / 2 + 1.5, p.w - 3, p.h - 3);
          }
        }
        ctx.restore();
      }
      if (elapsed < DURATION_MS) {
        frame = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        setFinished(true);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (finished) onDone?.();
  }, [finished, onDone]);

  if (finished) return null;
  return (
    <canvas
      ref={canvasRef}
      className="cd-confetti"
      aria-hidden="true"
      data-testid="cards-confetti"
    />
  );
}
