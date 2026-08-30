"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCssVar } from "@/components/admin/use-css-var";

/**
 * Recharts-Diagramme für das Dashboard (Client Components).
 * Farben kommen aus den Theme-Tokens (hell/dunkel) via useCssVar.
 */

function useChartColors() {
  return {
    accent: useCssVar("--chart-accent", "#4f46e5"),
    grid: useCssVar("--chart-grid", "#e4e4e7"),
    tick: useCssVar("--chart-tick", "#71717a"),
  };
}

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid var(--color-zinc-200)",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-zinc-900)",
  fontSize: 12,
};

interface DayPoint {
  day: string;
  clicks: number;
}

function formatDayLabel(day: string): string {
  const parts = day.split("-");
  return `${parts[2]}.${parts[1]}.`;
}

export function ClicksPerDayChart({ data }: { data: DayPoint[] }) {
  const colors = useChartColors();
  const chartData = data.map((d) => ({ ...d, label: formatDayLabel(d.day) }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Diagramm: Klicks pro Tag">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.accent} stopOpacity={0.22} />
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
            formatter={(value) => [String(value), "Klicks"]}
            labelFormatter={(label) => `Tag: ${label}`}
            contentStyle={TOOLTIP_STYLE}
          />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke={colors.accent}
            strokeWidth={2}
            fill="url(#clicksGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BucketPoint {
  label: string;
  clicks: number;
}

export function BucketBarChart({ data, title }: { data: BucketPoint[]; title: string }) {
  const colors = useChartColors();
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
            formatter={(value) => [String(value), "Klicks"]}
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--color-zinc-100)", opacity: 0.6 }}
          />
          <Bar dataKey="clicks" fill={colors.accent} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
