import { formatNumber } from "@/lib/utils";

/**
 * Kompakte Top-N-Liste mit Proportionalbalken (Server Component, kein
 * Client-JavaScript nötig). Ideal für Source/Kampagne/Link/Gerät/Land.
 */
export function BarList({ data }: { data: Array<{ label: string; clicks: number }> }) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-zinc-400">Keine Daten im Zeitraum.</p>;
  }
  const max = Math.max(...data.map((d) => d.clicks), 1);
  return (
    <ul className="space-y-2">
      {data.map((item) => (
        <li key={item.label} className="relative">
          <div
            className="absolute inset-y-0 left-0 rounded-md bg-zinc-100"
            style={{ width: `${Math.max(2, (item.clicks / max) * 100)}%` }}
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5">
            <span className="truncate text-sm text-zinc-800">{item.label}</span>
            <span className="text-sm font-medium tabular-nums text-zinc-600">
              {formatNumber(item.clicks)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
