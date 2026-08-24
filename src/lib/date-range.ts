/**
 * Datums-Helfer für die Zeitzone Europe/Berlin.
 * Alle Zeitstempel werden in UTC gespeichert; Auswertungen und Filter
 * beziehen sich auf Berliner Kalendertage (inkl. korrekter DST-Behandlung).
 */

const berlinProbe = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

export const DATE_STRING_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** UTC-Zeitpunkt der Berliner Mitternacht des angegebenen Kalendertags. */
export function berlinDayStartUtc(dateStr: string): Date {
  if (!DATE_STRING_PATTERN.test(dateStr)) {
    throw new Error(`Ungültiges Datum: ${dateStr}`);
  }
  // Berlin ist entweder UTC+1 (CET) oder UTC+2 (CEST). Beide Kandidaten
  // prüfen und den nehmen, der in Berlin exakt 00 Uhr des Tages ergibt.
  for (const offset of ["+02:00", "+01:00"]) {
    const candidate = new Date(`${dateStr}T00:00:00${offset}`);
    const parts = berlinProbe.formatToParts(candidate);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const formattedDate = `${get("year")}-${get("month")}-${get("day")}`;
    if (formattedDate === dateStr && get("hour") === "00") {
      return candidate;
    }
  }
  // Fallback (theoretisch nur bei exotischen DST-Umstellungen um Mitternacht)
  return new Date(`${dateStr}T00:00:00+01:00`);
}

/** Heutiges Datum in Berlin als YYYY-MM-DD. */
export function todayBerlin(now: Date = new Date()): string {
  const parts = berlinProbe.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Verschiebt ein YYYY-MM-DD-Datum um n Kalendertage. */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => Number.parseInt(v, 10)) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "90d" | "all";

export interface ResolvedRange {
  key: RangeKey;
  /** UTC-Startzeitpunkt (inklusive) */
  from: Date;
  /** UTC-Endzeitpunkt (exklusive) */
  to: Date;
  /** Berliner Kalendertage für Aggregat-Abfragen und Lückenfüllung */
  fromDay: string;
  toDay: string;
  label: string;
}

const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Heute",
  yesterday: "Gestern",
  "7d": "Letzte 7 Tage",
  "30d": "Letzte 30 Tage",
  "90d": "Letzte 90 Tage",
  all: "Gesamter Zeitraum",
};

export function resolveRange(rangeRaw: string | undefined, now: Date = new Date()): ResolvedRange {
  const key: RangeKey = (["today", "yesterday", "7d", "30d", "90d", "all"] as RangeKey[]).includes(
    rangeRaw as RangeKey,
  )
    ? (rangeRaw as RangeKey)
    : "30d";

  const today = todayBerlin(now);
  const tomorrow = addDays(today, 1);

  let fromDay: string;
  let toDay: string;
  switch (key) {
    case "today":
      fromDay = today;
      toDay = tomorrow;
      break;
    case "yesterday":
      fromDay = addDays(today, -1);
      toDay = today;
      break;
    case "7d":
      fromDay = addDays(today, -6);
      toDay = tomorrow;
      break;
    case "90d":
      fromDay = addDays(today, -89);
      toDay = tomorrow;
      break;
    case "all":
      fromDay = "2020-01-01";
      toDay = tomorrow;
      break;
    case "30d":
    default:
      fromDay = addDays(today, -29);
      toDay = tomorrow;
      break;
  }

  return {
    key,
    from: berlinDayStartUtc(fromDay),
    to: berlinDayStartUtc(toDay),
    fromDay,
    toDay,
    label: RANGE_LABELS[key],
  };
}
