import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-Klassen zusammenführen (shadcn-Konvention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** HTML-Escaping für serverseitig generiertes Markup (Bridge-Page, Fehlerseiten). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sicheres Einbetten von JSON in ein Inline-`<script>`:
 * "<" wird escaped, damit "</script>"-Injection unmöglich ist; die
 * Zeilenseparatoren U+2028/U+2029 werden ebenfalls escaped.
 */
export function jsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(new RegExp("\\u2028", "g"), "\\u2028")
    .replace(new RegExp("\\u2029", "g"), "\\u2029");
}

const berlinDateTimeFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const berlinDateFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const berlinTimeFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Datum + Uhrzeit in Europe/Berlin, z. B. "24.08.2026, 14:03:12" */
export function formatBerlinDateTime(date: Date): string {
  return berlinDateTimeFormat.format(date);
}

/** Datum in Europe/Berlin, z. B. "24.08.2026" */
export function formatBerlinDate(date: Date): string {
  return berlinDateFormat.format(date);
}

/** Uhrzeit in Europe/Berlin, z. B. "14:03:12" */
export function formatBerlinTime(date: Date): string {
  return berlinTimeFormat.format(date);
}

/** Zahl im deutschen Format, z. B. 12.345 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

/** Prozentwert, z. B. "87,5 %" */
export function formatPercent(fraction: number): string {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(fraction * 100)} %`;
}
