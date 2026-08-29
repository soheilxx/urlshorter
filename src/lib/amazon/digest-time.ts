/**
 * Reine Zeitzonen-Helfer für die tägliche Zusammenfassung (unit-getestet,
 * bewusst ohne Server-/DB-Abhängigkeiten). Speicherung erfolgt in UTC, die
 * Fälligkeit richtet sich nach der lokalen Zeit (Standard Europe/Berlin).
 */

/** Kalendertag (YYYY-MM-DD) eines Zeitpunkts in einer Zeitzone. */
export function calendarDateInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/** Lokale Uhrzeit "HH:MM" eines Zeitpunkts in einer Zeitzone. */
export function timeInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("de-DE", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date);
}

/** Ist der Digest zum Zeitpunkt `now` fällig (lokale Zeit >= digestTime)? */
export function isDigestTimeReached(now: Date, digestTime: string, timezone: string): boolean {
  return timeInTimezone(now, timezone) >= digestTime;
}
