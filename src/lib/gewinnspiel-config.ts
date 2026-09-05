/**
 * ZENTRALE Konfiguration des Buch-Gewinnspiels (Landingpage /gewinn).
 * Alle zeitlichen, inhaltlichen und rechtlichen Eckwerte liegen ausschließlich
 * hier – nirgendwo sonst im Code hart verdrahtet.
 *
 * Veranstalter-Daten stammen aus dem veröffentlichten Impressum von
 * soheil-hosseini.de (Wiresoft AG). Registrierungsschluss (ENTRY_DEADLINE) und
 * Gewinnerbekanntgabe (ANNOUNCEMENT_DATE) sind Vorgaben von Soheil (05.09.2026)
 * und stehen identisch in den Teilnahmebedingungen.
 */

export type SweepstakesPhase = "scheduled" | "open" | "closed" | "announced";

/** Manueller Status: "auto" folgt den Zeitfenstern unten; alles andere erzwingt eine Phase. */
export const SWEEPSTAKES_MODE: "auto" | SweepstakesPhase = "auto";

/** Teilnahmebeginn (null = sofort offen). Zeitzone: Europe/Berlin. */
export const ENTRY_START: Date | null = null;

/**
 * Registrierungsschluss (Europe/Berlin). Danach ist die Seite in Phase "closed",
 * bis zur Gewinnerbekanntgabe. null = Registrierung bis zur Bekanntgabe möglich.
 */
export const ENTRY_DEADLINE: Date | null = new Date("2026-10-11T23:59:59+02:00");
export const ENTRY_DEADLINE_LABEL = "11.10.2026, 23:59 Uhr";

/** Gewinnerbekanntgabe (fix vorgegeben): 12.10.2026 um 12 Uhr. */
export const ANNOUNCEMENT_DATE = new Date("2026-10-12T12:00:00+02:00");
export const ANNOUNCEMENT_DATE_LABEL = "12.10.2026";
export const ANNOUNCEMENT_TIME_LABEL = "12 Uhr";
export const ANNOUNCEMENT_DATETIME_LABEL = `${ANNOUNCEMENT_DATE_LABEL} um ${ANNOUNCEMENT_TIME_LABEL}`;

export const TIMEZONE = "Europe/Berlin";

/** Gewinnwert in Euro (Anzeige). */
export const PRIZE_VALUE_EUR = 20000;
export const PRIZE_VALUE_LABEL = "20.000 €";

/** Reisedauer (Angabe von Soheil, 28.08.2026). */
export const TRIP_DURATION_LABEL = "5 Tage";

/**
 * Weitere Gewinne neben dem Hauptgewinn (Vorgabe von Soheil, 05.09.2026):
 * Wertgutscheine für den Wiresoft Software Shop, einlösbar auf das gesamte
 * Sortiment (z. B. Windows 11 Pro, Microsoft Office). Hauptgewinn bleibt die Reise.
 */
export const SECONDARY_PRIZES = [
  { count: 10, valueEur: 500, valueLabel: "500 €" },
  { count: 40, valueEur: 150, valueLabel: "150 €" },
  { count: 50, valueEur: 50, valueLabel: "50 €" },
] as const;
export const SECONDARY_PRIZES_COUNT = SECONDARY_PRIZES.reduce((sum, p) => sum + p.count, 0);
export const SECONDARY_PRIZES_TOTAL_EUR = SECONDARY_PRIZES.reduce(
  (sum, p) => sum + p.count * p.valueEur,
  0,
);
export const SECONDARY_PRIZES_TOTAL_LABEL = `${new Intl.NumberFormat("de-DE").format(SECONDARY_PRIZES_TOTAL_EUR)} €`;
/** Shop-Angaben zentral in gutschein-config (importiert nichts → kein Zyklus). */
export {
  GUTSCHEIN_SHOP_NAME as SECONDARY_PRIZE_SHOP_NAME,
  GUTSCHEIN_SHOP_URL as SECONDARY_PRIZE_SHOP_URL,
} from "@/lib/gutschein-config";
/** Geschütztes Leerzeichen in „z. B.“, damit die Abkürzung nie am Zeilenende bricht. */
export const SECONDARY_PRIZE_EXAMPLES_LABEL = "z. B. Windows 11 Pro oder Microsoft Office";

/**
 * Amazon-Produktlink: eigener Affiliate-Redirect der Wiresoft AG
 * (tag=wiresoft0c-21; Ziel: amazon.de/dp/3690662508).
 */
export const AMAZON_PRODUCT_URL = "https://link.amazon/B0eyhvaQw";

/** Zulässige Händler für die Registrierung. */
export const RETAILERS = [
  { id: "amazon", label: "Amazon" },
  { id: "thalia", label: "Thalia" },
  { id: "hugendubel", label: "Hugendubel" },
  { id: "buecher_de", label: "bücher.de" },
  { id: "other", label: "Anderer Händler" },
] as const;

export type RetailerId = (typeof RETAILERS)[number]["id"];

export function isRetailerId(value: unknown): value is RetailerId {
  return typeof value === "string" && RETAILERS.some((r) => r.id === value);
}

export function retailerLabel(id: string, other?: string | null): string {
  if (id === "other" && other) return other;
  return RETAILERS.find((r) => r.id === id)?.label ?? id;
}

/** Maximale Registrierungen pro Bestellnummer (per Unique-Index erzwungen). */
export const MAX_ENTRIES_PER_ORDER_NUMBER = 1;

/** Mehrfachteilnahme mit VERSCHIEDENEN Bestellnummern erlaubt? (FAQ-Text) */
export const MULTIPLE_ORDERS_ALLOWED = true;

/** Rate Limiting der Einreichungen pro Client-Kennung. */
export const SUBMISSION_RATE_LIMIT = { maxPerWindow: 5, windowMinutes: 60 };

/** Mindestdauer zwischen Seitenaufruf und Absenden (Bot-Indikator, Sekunden). */
export const MIN_FORM_SECONDS = 3;
/** Maximale Gültigkeit des Formular-Tokens (Stunden). */
export const MAX_FORM_HOURS = 24;

/** Version der Teilnahmebedingungen, die Teilnehmende bestätigen. */
export const TERMS_VERSION = "1.2 (05.09.2026)";

/** Version/Stand der Datenschutzhinweise (extern gepflegt). */
export const PRIVACY_VERSION = "extern-2026-08";

/** Veranstalter (Angaben von Soheil, 28.08.2026). */
export const ORGANIZER_NAME = "Wiresoft Portal Ltd.";
export const ORGANIZER_ADDRESS =
  "Gate Avenue, Dubai International Financial Centre, Dubai, Vereinigte Arabische Emirate";
export const CONTACT_EMAIL = "info@wiresoft.com";

/** Teilnahmevoraussetzungen (Teilnahmebedingungen §4). */
export const MIN_AGE = 18;
export const ELIGIBLE_COUNTRIES_LABEL = "Deutschland, Österreich oder der Schweiz";

/** Öffentliche URL der Landingpage (Canonical/OG). */
export const GEWINN_URL = "https://lizenzzumerfolg.com/gewinn";

/** Deutsche Anzeige-Labels der Teilnahme-Status. */
export const SWEEPSTAKES_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Eingegangen",
  IN_REVIEW: "In Prüfung",
  REVIEWED: "Geprüft",
  INVALID: "Ungültig",
  WINNER: "Gewinner",
  NOT_WON: "Nicht gewonnen",
  DELETED: "Gelöscht",
};

/** Aktuelle Phase des Gewinnspiels (zeit- bzw. moduspgesteuert). */
export function getSweepstakesPhase(now: Date = new Date()): SweepstakesPhase {
  if (SWEEPSTAKES_MODE !== "auto") return SWEEPSTAKES_MODE;
  if (ENTRY_START && now < ENTRY_START) return "scheduled";
  if (now >= ANNOUNCEMENT_DATE) return "announced";
  if (ENTRY_DEADLINE && now > ENTRY_DEADLINE) return "closed";
  return "open";
}
