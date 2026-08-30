"use client";

import { useMemo, useState } from "react";
import { useCssVar } from "@/components/admin/use-css-var";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Ranking-Chart (Recharts):
 * - Y-Achse INVERTIERT: Rang 1 immer oben
 * - Lücken bleiben sichtbar (connectNulls=false, keine Interpolation)
 * - Tooltip mit Zeit, Rang, Provider und Freshness
 * - Kategorien ein-/ausblendbar, Zeiträume umschaltbar
 * - Gesamtrang und kleine Kategorienränge NICHT auf einer gemeinsamen Skala:
 *   Kategorien mit stark unterschiedlicher Größenordnung werden in getrennten
 *   Paneelen gerendert (automatische Gruppierung nach Wertebereich).
 */

export interface RankChartSeries {
  key: string;
  label: string;
  color: string;
  points: Array<{
    t: number; // Unix ms
    rank: number | null;
    provider: string | null;
    stale: boolean;
  }>;
}

export interface RankChartAnnotation {
  t: number;
  title: string;
}

const RANGES = [
  { key: "24h", label: "24 h", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "7 Tage", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", label: "30 Tage", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "90d", label: "90 Tage", ms: 90 * 24 * 60 * 60 * 1000 },
  { key: "all", label: "Gesamt", ms: Number.POSITIVE_INFINITY },
] as const;

function formatTime(t: number): string {
  return new Date(t).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ChartDatum {
  t: number;
  [seriesKey: string]: number | null;
}

function buildChartData(series: RankChartSeries[], cutoff: number): ChartDatum[] {
  const byTime = new Map<number, ChartDatum>();
  for (const s of series) {
    for (const point of s.points) {
      if (point.t < cutoff) continue;
      const datum = byTime.get(point.t) ?? { t: point.t };
      datum[s.key] = point.rank;
      byTime.set(point.t, datum);
    }
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

function Panel({
  series,
  annotations,
  cutoff,
  metaByKey,
}: {
  series: RankChartSeries[];
  annotations: RankChartAnnotation[];
  cutoff: number;
  metaByKey: Map<string, Map<number, { provider: string | null; stale: boolean }>>;
}) {
  const data = useMemo(() => buildChartData(series, cutoff), [series, cutoff]);
  const grid = useCssVar("--chart-grid", "#e4e4e7");
  const tick = useCssVar("--chart-tick", "#71717a");
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-400">Keine Messungen im Zeitraum.</p>;
  }
  return (
    <div className="h-64 w-full" role="img" aria-label="Ranking-Verlauf (Rang 1 oben)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTime}
            tick={{ fontSize: 10, fill: tick }}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
          />
          <YAxis
            reversed
            allowDecimals={false}
            domain={["auto", "auto"]}
            tick={{ fontSize: 11, fill: tick }}
            tickFormatter={(v: number) => v.toLocaleString("de-DE")}
            tickLine={false}
            axisLine={false}
            width={72}
            label={{
              value: "Rang (1 = oben)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 10, fill: tick },
            }}
          />
          <Tooltip
            labelFormatter={(t) => formatTime(Number(t))}
            formatter={(value, name, item) => {
              const key = String(item.dataKey);
              const meta = metaByKey.get(key)?.get(Number(item.payload?.t));
              const extra = meta
                ? ` · ${meta.provider ?? "?"}${meta.stale ? " · STALE" : ""}`
                : "";
              return [`Rang ${Number(value).toLocaleString("de-DE")}${extra}`, name];
            }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--color-zinc-200)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-zinc-900)",
              fontSize: 12,
            }}
          />
          {annotations
            .filter((a) => a.t >= cutoff)
            .map((a) => (
              <ReferenceLine
                key={`${a.t}-${a.title}`}
                x={a.t}
                stroke={tick}
                strokeDasharray="4 4"
                label={{ value: a.title, fontSize: 9, fill: tick, position: "top" }}
              />
            ))}
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              type="monotone"
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RankChart({
  series,
  annotations = [],
}: {
  series: RankChartSeries[];
  annotations?: RankChartAnnotation[];
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("7d");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const cutoff =
    range === "all"
      ? 0
      : Date.now() - (RANGES.find((r) => r.key === range)?.ms ?? Number.POSITIVE_INFINITY);

  const visible = series.filter((s) => !hidden.has(s.key));

  // Gruppierung nach Größenordnung: Serien, deren Maximalrang sich um mehr als
  // Faktor 50 unterscheidet, bekommen getrennte Paneele (keine irreführende Skala).
  const panels = useMemo(() => {
    const withMax = visible.map((s) => ({
      series: s,
      max: Math.max(1, ...s.points.filter((p) => p.rank !== null).map((p) => p.rank as number)),
    }));
    const sorted = [...withMax].sort((a, b) => a.max - b.max);
    const groups: RankChartSeries[][] = [];
    let currentGroup: typeof sorted = [];
    for (const item of sorted) {
      if (
        currentGroup.length > 0 &&
        item.max / Math.max(1, currentGroup[0]!.max) > 50
      ) {
        groups.push(currentGroup.map((g) => g.series));
        currentGroup = [];
      }
      currentGroup.push(item);
    }
    if (currentGroup.length > 0) groups.push(currentGroup.map((g) => g.series));
    return groups;
  }, [visible]);

  const metaByKey = useMemo(() => {
    const map = new Map<string, Map<number, { provider: string | null; stale: boolean }>>();
    for (const s of series) {
      const inner = new Map<number, { provider: string | null; stale: boolean }>();
      for (const p of s.points) inner.set(p.t, { provider: p.provider, stale: p.stale });
      map.set(s.key, inner);
    }
    return map;
  }, [series]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Zeitraum wählen">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={
                range === r.key
                  ? "rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-white"
                  : "rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Kategorien ein-/ausblenden">
          {series.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={!hidden.has(s.key)}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.key)) next.delete(s.key);
                  else next.add(s.key);
                  return next;
                })
              }
              className={
                hidden.has(s.key)
                  ? "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-zinc-400 line-through hover:bg-zinc-100"
                  : "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              }
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {panels.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">Keine Kategorie ausgewählt.</p>
      ) : (
        panels.map((panelSeries, index) => (
          <Panel
            key={panelSeries.map((s) => s.key).join("|") || index}
            series={panelSeries}
            annotations={annotations}
            cutoff={cutoff}
            metaByKey={metaByKey}
          />
        ))
      )}
      <p className="text-xs text-zinc-400">
        Rang 1 wird oben dargestellt. Unterbrochene Linien sind Datenlücken – fehlende Messungen
        werden nicht interpoliert. Kategorien unterschiedlicher Größenordnung erscheinen in
        getrennten Paneelen.
      </p>
    </div>
  );
}
