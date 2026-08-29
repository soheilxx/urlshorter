import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleAlert, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Rangbewegung mit Pfeil + Klartext + Screenreader-Text.
 * Farben sind nie das einzige Signal (Icons + Text zusätzlich).
 * movement > 0 = Verbesserung (kleinerer Rang = besser).
 */
export function MovementBadge({
  movement,
  percent,
  className,
}: {
  movement: number | null;
  percent?: number | null;
  className?: string;
}) {
  if (movement === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20",
          className,
        )}
      >
        <CircleAlert className="h-3 w-3" aria-hidden="true" />
        Datenlücke
        <span className="sr-only">Keine Vergleichsmessung vorhanden</span>
      </span>
    );
  }
  const pctText =
    percent !== null && percent !== undefined
      ? ` (${percent > 0 ? "+" : ""}${percent.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %)`
      : "";
  if (movement > 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
          className,
        )}
      >
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        +{movement.toLocaleString("de-DE")}
        {pctText}
        <span className="sr-only">Verbesserung um {movement.toLocaleString("de-DE")} Plätze</span>
      </span>
    );
  }
  if (movement < 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20",
          className,
        )}
      >
        <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
        {movement.toLocaleString("de-DE")}
        {pctText}
        <span className="sr-only">
          Verschlechterung um {Math.abs(movement).toLocaleString("de-DE")} Plätze
        </span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/20",
        className,
      )}
    >
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
      unverändert
    </span>
  );
}

/** Badge für veraltete Werte (letzter bekannter Stand). */
export function StaleBadge({ ageLabel }: { ageLabel?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
      <Clock className="h-3 w-3" aria-hidden="true" />
      Letzter bekannter Stand{ageLabel ? ` · ${ageLabel}` : ""}
    </span>
  );
}

/** Rang formatiert oder Datenlücken-Kennzeichnung. */
export function RankValue({ rank }: { rank: number | null }) {
  if (rank === null) {
    return <span className="text-amber-600">– (Lücke)</span>;
  }
  return <span className="tabular-nums">{rank.toLocaleString("de-DE")}</span>;
}
