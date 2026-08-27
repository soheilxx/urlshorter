import { CHANNEL_COLORS, CHANNEL_LABELS, type ChannelId } from "@/lib/channels";
import type { RecentClick } from "@/lib/geo-stats";
import { formatBerlinTime, formatNumber } from "@/lib/utils";
import { countryNameDe } from "@/lib/world-map";

/**
 * Server-Komponenten für das dunkle Analytics-Panel.
 * Farbwerte folgen der Dark-Palette (siehe lib/channels.ts bzw. Seite).
 */

export function DarkStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-[#1a1a19] px-5 py-4 ring-1 ring-white/10">
      <p className="text-[11px] font-medium tracking-wider text-[#898781] uppercase">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[#898781]">{hint}</p> : null}
    </div>
  );
}

export interface DarkBarItem {
  label: string;
  sublabel?: string | null;
  clicks: number;
  /** Feste Entitätsfarbe (z. B. Kanal); ohne Angabe: sequentielles Blau. */
  color?: string;
}

export function DarkBarList({ items }: { items: DarkBarItem[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-[#898781]">Keine Daten im Zeitraum.</p>;
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
              backgroundColor: item.color ?? "#3987e5",
              opacity: item.color ? 0.28 : 0.22,
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
              <span className="truncate text-sm text-white">{item.label}</span>
              {item.sublabel ? (
                <span className="shrink-0 text-xs text-[#898781]">{item.sublabel}</span>
              ) : null}
            </span>
            <span className="text-sm font-medium text-[#c3c2b7] tabular-nums">
              {formatNumber(item.clicks)}
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
      <p className="py-6 text-center text-sm text-[#898781]">
        Noch keine Klicks erfasst – sobald Kurzlinks aufgerufen werden, erscheinen sie hier.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-white/5">
      {clicks.map((click) => (
        <li key={click.id} className="flex items-center gap-2.5 py-2">
          <span className="font-mono text-[11px] text-[#898781] tabular-nums">
            {formatBerlinTime(click.ts)}
          </span>
          <ChannelDot channel={click.channel} />
          <span className="min-w-0 flex-1 truncate text-xs text-white">
            {click.city ?? countryNameDe(click.iso2)}
            {click.city && click.iso2 ? (
              <span className="text-[#898781]"> · {countryNameDe(click.iso2)}</span>
            ) : null}
          </span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-[#c3c2b7]">
            /{click.code}
          </span>
        </li>
      ))}
    </ul>
  );
}
