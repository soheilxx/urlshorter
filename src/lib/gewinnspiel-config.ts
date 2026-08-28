/**
 * ZENTRALE Konfiguration des Buch-Gewinnspiels (Landingpage /gewinn).
 * Alle zeitlichen, inhaltlichen und rechtlichen Eckwerte liegen ausschließlich
 * hier – nirgendwo sonst im Code hart verdrahtet.
 *
 * Veranstalter-Daten stammen aus dem veröffentlichten Impressum von
 * soheil-hosseini.de (Wiresoft AG). Ohne gesetzten ENTRY_DEADLINE ist die
 * Teilnahme bis zur Gewinnerbekanntgabe möglich – so auch in den
 * Teilnahmebedingungen formuliert.
 */

export type SweepstakesPhase = "scheduled" | "open" | "closed" | "announced";

/** Manueller Status: "auto" folgt den Zeitfenstern unten; alles andere erzwingt eine Phase. */
export const SWEEPSTAKES_MODE: "auto" | SweepstakesPhase = "auto";

/** Teilnahmebeginn (null = sofort offen). Zeitzone: Europe/Berlin. */
export const ENTRY_START: Date | null = null;

/**
 * Optionaler früherer Teilnahmeschluss. Solange null, ist die Teilnahme bis
 * zur Gewinnerbekanntgabe (ANNOUNCEMENT_DATE) möglich – exakt so in den
 * Teilnahmebedingungen geregelt. Bei Bedarf setzen, z. B.:
 * new Date("2026-10-01T23:59:59+02:00")
 */
export const ENTRY_DEADLINE: Date | null = null;

/** Gewinnerbekanntgabe (fix vorgegeben). */
export const ANNOUNCEMENT_DATE = new Date("2026-10-06T00:00:00+02:00");
export const ANNOUNCEMENT_DATE_LABEL = "06.10.2026";

export const TIMEZONE = "Europe/Berlin";

/** Gewinnwert in Euro (Anzeige). */
export const PRIZE_VALUE_EUR = 20000;
export const PRIZE_VALUE_LABEL = "20.000 €";

/** Reisedauer (Angabe von Soheil, 28.08.2026). */
export const TRIP_DURATION_LABEL = "5 Tage";

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
export const TERMS_VERSION = "1.1 (28.08.2026)";

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
