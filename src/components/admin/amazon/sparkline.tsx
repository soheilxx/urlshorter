/**
 * Kleine Rang-Sparkline (Server-SVG). Y ist invertiert dargestellt:
 * bessere (kleinere) Ränge liegen oben. Lücken (null) werden als gepunktete
 * Verbindung gezeichnet (erkennbar, aber keine frei schwebenden Striche);
 * dezente Fläche unter der Linie verankert sie optisch in der Karte.
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

  const coord = (index: number, rank: number) => ({
    x: index * stepX,
    // kleinerer Rang = besser = oben
    y: 2 + ((rank - min) / span) * (height - 6),
  });

  // Durchgezogene Segmente + gepunktete Brücken über Lücken
  const segments: string[] = [];
  const bridges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  let current: Array<{ x: number; y: number }> = [];
  let lastPoint: { x: number; y: number } | null = null;
  let inGap = false;
  points.forEach((point, index) => {
    if (point.rank === null) {
      if (current.length > 1) {
        segments.push(current.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" "));
      }
      if (current.length > 0) lastPoint = current[current.length - 1]!;
      current = [];
      inGap = true;
      return;
    }
    const c = coord(index, point.rank);
    if (inGap && lastPoint) {
      bridges.push({ x1: lastPoint.x, y1: lastPoint.y, x2: c.x, y2: c.y });
    }
    inGap = false;
    current.push(c);
  });
  if (current.length > 1) {
    segments.push(current.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" "));
  }

  const first = ranks[0]!;
  const last = ranks[ranks.length - 1]!;
  const improving = last < first;
  const color = improving ? "#059669" : "#dc2626";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: Verlauf von Rang ${first.toLocaleString("de-DE")} zu ${last.toLocaleString("de-DE")}`}
    >
      {segments.map((segment, i) => {
        const pts = segment.split(" ");
        const firstPt = pts[0]!.split(",");
        const lastPt = pts[pts.length - 1]!.split(",");
        return (
          <polygon
            key={`a-${i}`}
            points={`${firstPt[0]},${height} ${segment} ${lastPt[0]},${height}`}
            fill={color}
            opacity={0.08}
          />
        );
      })}
      {bridges.map((bridge, i) => (
        <line
          key={`b-${i}`}
          x1={bridge.x1}
          y1={bridge.y1}
          x2={bridge.x2}
          y2={bridge.y2}
          stroke={color}
          strokeWidth="1.25"
          strokeDasharray="2 3"
          strokeLinecap="round"
          opacity={0.55}
        />
      ))}
      {segments.map((segment, i) => (
        <polyline
          key={i}
          points={segment}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
