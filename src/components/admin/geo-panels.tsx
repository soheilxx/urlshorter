import { CHANNEL_COLORS, CHANNEL_LABELS, type ChannelId } from "@/lib/channels";
import type { RecentClick } from "@/lib/geo-stats";
import { formatBerlinTime, formatNumber } from "@/lib/utils";
import { countryNameDe } from "@/lib/world-map";

/**
 * Server-Komponenten des Analytics-Tabs im hellen Dashboard-Design
 * (weiße Cards, Zinc-Palette – wie der Rest des Adminbereichs).
 */

export interface GeoBarItem {
  label: string;
  sublabel?: string | null;
  clicks: number;
  /** Feste Entitätsfarbe (z. B. Kanal); ohne Angabe: Blau. */
  color?: string;
  /** Optionaler Zusatzwert rechts, z. B. Unique Visitors. */
  hint?: string | null;
}

export function GeoBarList({ items }: { items: GeoBarItem[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-zinc-400">Keine Daten im Zeitraum.</p>;
  }
  const max = Math.max(...items.map((d) => d.clicks), 1);
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="relative overflow-hidden rounded-md">
          <div
            className="absolute inset-y-0 left-0 rounded-md"
            style={{
              width: `${Math.max(2, (item.clicks / max) * 100)}%`,
              backgroundColor: item.color ?? "var(--chart-accent)",
              opacity: 0.14,
            }}
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5">
            <span className="flex min-w-0 items-center gap-2">
              {item.color ? (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="truncate text-sm text-zinc-800">{item.label}</span>
              {item.sublabel ? (
                <span className="shrink-0 text-xs text-zinc-400">{item.sublabel}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-sm font-medium text-zinc-700 tabular-nums">
              {formatNumber(item.clicks)}
              {item.hint ? <span className="ml-1 text-xs font-normal text-zinc-400">{item.hint}</span> : null}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ChannelDot({ channel }: { channel: ChannelId }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: CHANNEL_COLORS[channel] }}
      title={CHANNEL_LABELS[channel]}
      aria-hidden="true"
    />
  );
}

export function LiveFeed({ clicks }: { clicks: RecentClick[] }) {
  if (clicks.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-400">
        Noch keine Klicks erfasst – sobald Kurzlinks aufgerufen werden, erscheinen sie hier.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100">
      {clicks.map((click) => (
        <li key={click.id} className="flex items-center gap-2.5 py-2">
          <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
            {formatBerlinTime(click.ts)}
          </span>
          <ChannelDot channel={click.channel} />
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-800">
            {click.city ?? countryNameDe(click.iso2)}
            {click.city && click.iso2 ? (
              <span className="text-zinc-400"> · {countryNameDe(click.iso2)}</span>
            ) : null}
            {click.deviceType ? (
              <span className="text-zinc-400"> · {click.deviceType}</span>
            ) : null}
          </span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600">
            /{click.code}
          </span>
        </li>
      ))}
    </ul>
  );
}
