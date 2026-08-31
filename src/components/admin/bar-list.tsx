import { formatNumber } from "@/lib/utils";

/**
 * Kompakte Top-N-Liste mit Proportionalbalken in Primärblau plus
 * Anteils-Prozent (Server Component, kein Client-JavaScript nötig).
 * Ideal für Source/Kampagne/Link/Gerät/Land.
 */
export function BarList({ data }: { data: Array<{ label: string; clicks: number }> }) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-zinc-400">Keine Daten im Zeitraum.</p>;
  }
  const max = Math.max(...data.map((d) => d.clicks), 1);
  const total = data.reduce((s, d) => s + d.clicks, 0);
  return (
    <ul className="space-y-2">
      {data.map((item, index) => {
        const share = total > 0 ? Math.round((item.clicks / total) * 100) : 0;
        return (
          <li key={item.label} className="relative">
            <div
              className={
                index === 0
                  ? "absolute inset-y-0 left-0 rounded-md bg-primary-soft-strong"
                  : "absolute inset-y-0 left-0 rounded-md bg-primary-soft"
              }
              style={{ width: `${Math.max(2, (item.clicks / max) * 100)}%` }}
              aria-hidden="true"
            />
            <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5">
              {/* min-w-0: sonst spreizt ein langes Label die ganze Karte auf */}
              <span className="min-w-0 truncate text-sm text-zinc-800">{item.label}</span>
              <span className="flex shrink-0 items-baseline gap-1.5">
                <span className="text-sm font-semibold tabular-nums text-zinc-700">
                  {formatNumber(item.clicks)}
                </span>
                <span className="w-9 text-right text-[11px] tabular-nums text-zinc-400">
                  {share} %
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
