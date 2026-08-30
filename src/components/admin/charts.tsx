"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCssVar } from "@/components/admin/use-css-var";
import { formatNumber } from "@/lib/utils";

/**
 * Recharts-Diagramme für das Dashboard (Client Components) im
 * TRACK.SITE-Look: Verlaufsflächen, gleitender 7-Tage-Schnitt, eigene
 * Tooltip-Karten mit Anteilen. Farben kommen aus den Theme-Tokens.
 */

function useChartColors() {
  return {
    accent: useCssVar("--chart-accent", "#1f62ff"),
    grid: useCssVar("--chart-grid", "#e4e4e7"),
    tick: useCssVar("--chart-tick", "#71717a"),
  };
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

interface DayPoint {
  day: string;
  clicks: number;
}

function formatDayLabel(day: string): string {
  const parts = day.split("-");
  return `${parts[2]}.${parts[1]}.`;
}

function weekdayOf(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : (WEEKDAYS[date.getUTCDay()] ?? "");
}

/** Gemeinsame Tooltip-Karte (Surface, Schatten, fette Zahl). */
function TooltipCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; accent?: boolean }>;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-surface px-3 py-2 shadow-lg">
      <p className="text-[11px] font-medium text-zinc-400">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="mt-0.5 flex items-baseline justify-between gap-4 text-xs">
          <span className="text-zinc-500">{row.label}</span>
          <span
            className={
              row.accent ? "font-bold tabular-nums text-primary" : "font-semibold tabular-nums text-zinc-800"
            }
          >
            {row.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ClicksPerDayChart({ data }: { data: DayPoint[] }) {
  const colors = useChartColors();
  // Gleitender 7-Tage-Durchschnitt als zweite, gestrichelte Linie
  const chartData = data.map((d, index) => {
    const windowPoints = data.slice(Math.max(0, index - 6), index + 1);
    const avg = windowPoints.reduce((s, p) => s + p.clicks, 0) / windowPoints.length;
    return {
      ...d,
      label: formatDayLabel(d.day),
      weekday: weekdayOf(d.day),
      avg7: Math.round(avg * 10) / 10,
    };
  });
  return (
    <div className="h-64 w-full" role="img" aria-label="Diagramm: Klicks pro Tag">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.accent} stopOpacity={0.28} />
              <stop offset="100%" stopColor={colors.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: colors.tick }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: colors.tick }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as (typeof chartData)[number] | undefined;
              if (!active || !point) return null;
              return (
                <TooltipCard
                  title={`${point.weekday}, ${point.label}`}
                  rows={[
                    { label: "Klicks", value: formatNumber(point.clicks), accent: true },
                    { label: "Ø 7 Tage", value: point.avg7.toLocaleString("de-DE") },
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke={colors.accent}
            strokeWidth={2.5}
            fill="url(#clicksGradient)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-surface)" }}
          />
          <Line
            type="monotone"
            dataKey="avg7"
            stroke={colors.tick}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="-mt-1 text-right text-[10px] text-zinc-400">– – Ø 7 Tage</p>
    </div>
  );
}

interface BucketPoint {
  label: string;
  clicks: number;
}

export function BucketBarChart({ data, title }: { data: BucketPoint[]; title: string }) {
  const colors = useChartColors();
  const total = data.reduce((s, d) => s + d.clicks, 0);
  const max = Math.max(...data.map((d) => d.clicks), 0);
  return (
    <div className="h-56 w-full" role="img" aria-label={`Diagramm: ${title}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: colors.tick }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tick={{ fontSize: 11, fill: colors.tick }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "var(--color-zinc-100)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as BucketPoint | undefined;
              if (!active || !point) return null;
              const share = total > 0 ? Math.round((point.clicks / total) * 100) : 0;
              return (
                <TooltipCard
                  title={point.label}
                  rows={[
                    { label: "Klicks", value: formatNumber(point.clicks), accent: true },
                    { label: "Anteil", value: `${share} %` },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="clicks" radius={[5, 5, 0, 0]} maxBarSize={28}>
            {data.map((entry) => (
              // Spitzenwert voll gesättigt, Rest in hellerem Blau – Maximum
              // ist auf einen Blick erkennbar (fast.site-Muster).
              <Cell
                key={entry.label}
                fill={colors.accent}
                fillOpacity={max > 0 && entry.clicks === max ? 1 : 0.45}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
