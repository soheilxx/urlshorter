/**
 * Kleine Rang-Sparkline (Server-SVG). Y ist invertiert dargestellt:
 * bessere (kleinere) Ränge liegen oben. Lücken (null) unterbrechen die Linie.
 */
export function RankSparkline({
  points,
  width = 120,
  height = 32,
  label,
}: {
  points: Array<{ rank: number | null }>;
  width?: number;
  height?: number;
  label: string;
}) {
  const ranks = points.map((p) => p.rank).filter((r): r is number => r !== null);
  if (ranks.length < 2) {
    return <span className="text-xs text-zinc-400">zu wenig Daten</span>;
  }
  const min = Math.min(...ranks);
  const max = Math.max(...ranks);
  const span = Math.max(1, max - min);
  const stepX = width / Math.max(1, points.length - 1);

  // Segmente bilden – bei null-Werten wird die Linie unterbrochen (Lücke sichtbar)
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    if (point.rank === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const x = index * stepX;
    // kleinerer Rang = besser = oben
    const y = 2 + ((point.rank - min) / span) * (height - 4);
    current.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  const first = ranks[0]!;
  const last = ranks[ranks.length - 1]!;
  const improving = last < first;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: Verlauf von Rang ${first.toLocaleString("de-DE")} zu ${last.toLocaleString("de-DE")}`}
      className="overflow-visible"
    >
      {segments.map((segment, i) => (
        <polyline
          key={i}
          points={segment}
          fill="none"
          stroke={improving ? "#059669" : "#dc2626"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
