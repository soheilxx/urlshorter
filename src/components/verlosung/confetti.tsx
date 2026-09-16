import { cn } from "@/lib/utils";

/**
 * Wenige statische Konfetti-Formen (CSS-Elemente, rein dekorativ, aria-hidden).
 * - "edges" (Standard): nur an den Seitenrändern – nie über Text.
 * - "spread": über die Fläche verteilt (dunkle Bildfläche im Hero).
 * Mit `burst` läuft einmalig eine kurze Fallanimation (Erfolgsansicht);
 * prefers-reduced-motion schaltet sie in globals.css ab.
 */
type Piece = { x: number; y: number; r: number; c: string; s?: "round" | "bar" };

const EDGES: Piece[] = [
  { x: 1.5, y: 14, r: 18, c: "var(--vl-yellow)" },
  { x: 4, y: 48, r: -24, c: "var(--vl-petrol)", s: "round" },
  { x: 2, y: 78, r: 40, c: "var(--vl-coral)", s: "bar" },
  { x: 6.5, y: 30, r: -12, c: "var(--vl-sky)", s: "round" },
  { x: 95, y: 10, r: 65, c: "var(--vl-sky)", s: "round" },
  { x: 97, y: 40, r: -35, c: "var(--vl-petrol)", s: "bar" },
  { x: 93.5, y: 62, r: 22, c: "var(--vl-yellow)" },
  { x: 96, y: 86, r: -50, c: "var(--vl-coral)" },
];

const SPREAD: Piece[] = [
  { x: 4, y: 12, r: 18, c: "var(--vl-yellow)" },
  { x: 12, y: 58, r: -24, c: "var(--vl-sky)", s: "round" },
  { x: 22, y: 28, r: 40, c: "var(--vl-coral)", s: "bar" },
  { x: 31, y: 8, r: -12, c: "var(--vl-yellow)" },
  { x: 43, y: 18, r: 65, c: "var(--vl-sky)", s: "round" },
  { x: 55, y: 6, r: -35, c: "var(--vl-coral)", s: "bar" },
  { x: 63, y: 24, r: 22, c: "var(--vl-yellow)", s: "round" },
  { x: 84, y: 30, r: 12, c: "var(--vl-sky)", s: "bar" },
  { x: 93, y: 56, r: -20, c: "var(--vl-yellow)" },
];

export function Confetti({
  className,
  burst = false,
  variant = "edges",
  count,
}: {
  className?: string;
  burst?: boolean;
  variant?: "edges" | "spread";
  count?: number;
}) {
  const pieces = variant === "spread" ? SPREAD : EDGES;
  return (
    <div className={cn("vl-confetti", burst && "burst", className)} aria-hidden="true">
      {pieces.slice(0, count ?? pieces.length).map((p, i) => (
        <i
          key={i}
          className={p.s}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: p.c,
            transform: `rotate(${p.r}deg)`,
          }}
        />
      ))}
    </div>
  );
}
