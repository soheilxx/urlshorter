import { Card } from "@/components/ui/card";

/**
 * Kennzahlen-Kachel (Vorbild fast.site): Label klein, Wert groß und fett,
 * optionaler Delta-Chip (grün ↗ / rot ↘) und rechter Slot für Sparklines.
 * Auf Mobil kompakter, damit 2 Kacheln nebeneinander auf 360 px lesbar bleiben.
 */
export function StatCard({
  label,
  value,
  hint,
  trend,
  trendLabel,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Prozentuale Veränderung, z. B. +10.2 → grüner Chip „↗ +10,2 %“. */
  trend?: number | null;
  /** Optionaler Zusatz hinter dem Chip, z. B. "vs. gestern". */
  trendLabel?: string;
  children?: React.ReactNode;
}) {
  const showTrend = trend !== undefined && trend !== null && Number.isFinite(trend);
  return (
    <Card className="px-3.5 py-3 md:px-5 md:py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase md:text-xs">
            {label}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 md:mt-1.5">
            <span className="text-xl font-bold tabular-nums tracking-tight text-zinc-900 md:text-2xl">
              {value}
            </span>
            {showTrend ? (
              <span
                className={
                  trend >= 0
                    ? "inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700"
                    : "inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700"
                }
              >
                {trend >= 0 ? "↗" : "↘"} {trend > 0 ? "+" : ""}
                {trend.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %
                {trendLabel ? <span className="sr-only"> {trendLabel}</span> : null}
              </span>
            ) : null}
          </p>
          {hint ? <p className="mt-0.5 text-xs text-zinc-400">{hint}</p> : null}
        </div>
        {children ? <div className="shrink-0 pt-1">{children}</div> : null}
      </div>
    </Card>
  );
}
