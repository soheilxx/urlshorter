/**
 * Mini-Trendlinie für StatCards (reines SVG, Server Component): rendert in
 * voller Kachelbreite (preserveAspectRatio none + non-scaling-stroke, damit
 * die Linienstärke beim Strecken konstant bleibt).
 */
export function ClickSparkline({
  points,
  label,
  height = 30,
}: {
  points: number[];
  label: string;
  height?: number;
}) {
  if (points.length < 2) return null;
  const width = 100;
  const max = Math.max(...points, 1);
  const stepX = width / (points.length - 1);
  const coords = points.map((value, index) => ({
    x: index * stepX,
    y: height - 3 - (value / max) * (height - 6),
  }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="block w-full"
      style={{ height }}
    >
      <path d={area} fill="var(--chart-accent)" opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke="var(--chart-accent)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
