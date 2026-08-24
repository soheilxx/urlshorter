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

/**
 * Recharts-Diagramme für das Dashboard (Client Components).
 * Die Daten kommen fertig aggregiert vom Server.
 */

const ACCENT = "#18181b";
const GRID = "#e4e4e7";

interface DayPoint {
  day: string;
  clicks: number;
}

function formatDayLabel(day: string): string {
  const parts = day.split("-");
  return `${parts[2]}.${parts[1]}.`;
}

export function ClicksPerDayChart({ data }: { data: DayPoint[] }) {
  const chartData = data.map((d) => ({ ...d, label: formatDayLabel(d.day) }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Diagramm: Klicks pro Tag">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value) => [String(value), "Klicks"]}
            labelFormatter={(label) => `Tag: ${label}`}
            contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke={ACCENT}
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
  return (
    <div className="h-56 w-full" role="img" aria-label={`Diagramm: ${title}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value) => [String(value), "Klicks"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
          />
          <Bar dataKey="clicks" fill={ACCENT} radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
