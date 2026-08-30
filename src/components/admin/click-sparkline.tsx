/**
 * Mini-Trendlinie für StatCards (reines SVG, Server Component):
 * letzte N Tage als Fläche + Linie in Chart-Akzentfarbe.
 */
export function ClickSparkline({
  points,
  label,
  width = 88,
  height = 30,
}: {
  points: number[];
  label: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
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
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <path d={area} fill="var(--chart-accent)" opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke="var(--chart-accent)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={coords[coords.length - 1]!.x}
        cy={coords[coords.length - 1]!.y}
        r={2.4}
        fill="var(--chart-accent)"
      />
    </svg>
  );
}
