/**
 * ZENTRALE Konfiguration des Buch-Gewinnspiels (Landingpages /gewinn und
 * /verlosung – ein gemeinsamer Lostopf). Alle zeitlichen, inhaltlichen und
 * rechtlichen Eckwerte liegen ausschließlich hier – nirgendwo sonst im Code
 * hart verdrahtet. Summen werden aus den Staffeln berechnet, nie getippt.
 *
 * Veranstalter-Daten: Angaben von Soheil (28.08.2026). Registrierungsschluss
 * (ENTRY_DEADLINE) und Gewinnerbekanntgabe (ANNOUNCEMENT_DATE) sind Vorgaben
 * von Soheil (05.09.2026) und stehen identisch in den Teilnahmebedingungen.
 * Erweiterung um Bikinilista- und Amazon-Gutscheine: Kampagnenbriefing
 * (16.09.2026), siehe TERMS_VERSION 1.3.
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

/** Euro-Beträge im deutschen Format, z. B. "34.500 €". */
export function formatEur(value: number): string {
  return `${new Intl.NumberFormat("de-DE").format(value)} €`;
}

/** Gewinnwert der Reise in Euro (Anzeige). */
export const PRIZE_VALUE_EUR = 20000;
export const PRIZE_VALUE_LABEL = formatEur(PRIZE_VALUE_EUR);

/** Reisedauer (Angabe von Soheil, 28.08.2026). Fünf Tage – keine Nächtezahl zugesagt. */
export const TRIP_DURATION_LABEL = "5 Tage";

/**
 * Bestätigte Leistungen der Dubai-Reise (identisch mit den Teilnahmebedingungen §2).
 * Keine Abflughäfen, Reisedaten, Hotelmarken, Transfers oder Verpflegung erfinden.
 */
export const TRIP_INCLUSIONS = [
  "Hin- und Rückflug mit Emirates in der Business Class für zwei Personen",
  "Aufenthalt in einem exklusiven 5-Sterne-Designerhotel in Dubai",
  "Unterbringung in einer Suite",
  "Dinner für zwei Personen in einem der angesagtesten Restaurants Dubais",
  "Auf Wunsch ein persönliches Meet & Greet mit Soheil Hosseini",
] as const;

/* ----------------------------------------------------------------------------
 * Gutschein-Gewinne: drei Marken mit je drei Staffeln (Kampagnenbriefing
 * 16.09.2026). Die Wiresoft-Staffeln sind die bereits seit 05.09.2026
 * konfigurierten Zusatzgewinne – sie bleiben genau einmal enthalten.
 * ------------------------------------------------------------------------- */

export interface VoucherTier {
  count: number;
  valueEur: number;
  valueLabel: string;
}

export type VoucherBrandId = "wiresoft" | "bikinilista" | "amazon";

export interface VoucherBrand {
  id: VoucherBrandId;
  name: string;
  /** Knapper Einsatzzweck für die Gewinnkarte. */
  purpose: string;
  /** Shop-URL nur, wenn belegt vorhanden (sonst null – keine erfundenen Links). */
  shopUrl: string | null;
  tiers: readonly VoucherTier[];
}

function tier(count: number, valueEur: number): VoucherTier {
  return { count, valueEur, valueLabel: formatEur(valueEur) };
}

export const VOUCHER_BRANDS: readonly VoucherBrand[] = [
  {
    id: "wiresoft",
    name: "Wiresoft",
    purpose: "Für deinen nächsten Software-Einkauf.",
    shopUrl: "https://www.wiresoft.com",
    tiers: [tier(10, 500), tier(40, 150), tier(50, 50)],
  },
  {
    id: "bikinilista",
    name: "Bikinilista",
    purpose: "Für deinen nächsten Beach-Look.",
    shopUrl: null,
    tiers: [tier(10, 500), tier(40, 150), tier(50, 50)],
  },
  {
    id: "amazon",
    name: "Amazon",
    purpose: "Für etwas von deiner Wunschliste.",
    shopUrl: null,
    tiers: [tier(10, 250), tier(40, 100), tier(50, 20)],
  },
] as const;

export function voucherBrandCount(brand: VoucherBrand): number {
  return brand.tiers.reduce((sum, t) => sum + t.count, 0);
}

export function voucherBrandTotalEur(brand: VoucherBrand): number {
  return brand.tiers.reduce((sum, t) => sum + t.count * t.valueEur, 0);
}

/** Kompakte Staffel-Darstellung, z. B. "10 × 500 € · 40 × 150 € · 50 × 50 €". */
export function voucherTiersLabel(brand: VoucherBrand, separator = " · "): string {
  return brand.tiers.map((t) => `${t.count} × ${t.valueLabel}`).join(separator);
}

/** Alle Gutscheine zusammen: 300 Stück, 34.500 €. */
export const VOUCHER_TOTAL_COUNT = VOUCHER_BRANDS.reduce((sum, b) => sum + voucherBrandCount(b), 0);
export const VOUCHER_TOTAL_EUR = VOUCHER_BRANDS.reduce(
  (sum, b) => sum + voucherBrandTotalEur(b),
  0,
);
export const VOUCHER_TOTAL_LABEL = formatEur(VOUCHER_TOTAL_EUR);
export const VOUCHER_BRAND_NAMES_LABEL = VOUCHER_BRANDS.map((b) => b.name).join(", ").replace(
  /, ([^,]*)$/,
  " und $1",
);

/** Gesamtgewinnwert: Reise + alle Gutscheine (54.500 €). */
export const TOTAL_PRIZE_VALUE_EUR = PRIZE_VALUE_EUR + VOUCHER_TOTAL_EUR;
export const TOTAL_PRIZE_VALUE_LABEL = formatEur(TOTAL_PRIZE_VALUE_EUR);

/**
 * Kennung des geltenden Gewinnumfangs – wird je Teilnahme gespeichert, damit
 * später nachvollziehbar ist, für welchen Gewinnumfang eine Anmeldung erfolgte.
 */
export const PRIZE_SCOPE = "dubai-reise+300-gutscheine (Bedingungen 1.3)";

/* --------------------------------------------------------------------------
 * Abwärtskompatible Exporte für /gewinn (Wiresoft-Zusatzgewinne).
 * ------------------------------------------------------------------------ */
const WIRESOFT_BRAND = VOUCHER_BRANDS[0] as VoucherBrand;
export const SECONDARY_PRIZES = WIRESOFT_BRAND.tiers;
export const SECONDARY_PRIZES_COUNT = voucherBrandCount(WIRESOFT_BRAND);
export const SECONDARY_PRIZES_TOTAL_EUR = voucherBrandTotalEur(WIRESOFT_BRAND);
export const SECONDARY_PRIZES_TOTAL_LABEL = formatEur(SECONDARY_PRIZES_TOTAL_EUR);
/** Shop-Angaben zentral in gutschein-config (importiert nichts → kein Zyklus). */
export {
  GUTSCHEIN_SHOP_NAME as SECONDARY_PRIZE_SHOP_NAME,
  GUTSCHEIN_SHOP_URL as SECONDARY_PRIZE_SHOP_URL,
} from "@/lib/gutschein-config";
/** Geschütztes Leerzeichen in „z. B.“, damit die Abkürzung nie am Zeilenende bricht. */
export const SECONDARY_PRIZE_EXAMPLES_LABEL = "z. B. Windows 11 Pro oder Microsoft Office";

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

/**
 * Direkte Produktseiten der Händler. Diese Ziele sind identisch mit den
 * Kaufziel-Regeln des Conversion-Trackings (book-conversion-events.ts), ein
 * Klick wird also als Händler-Outbound erfasst. Keine erfundenen Links.
 */
export const RETAILER_LINKS: ReadonlyArray<{
  id: Exclude<RetailerId, "other">;
  label: string;
  url: string;
  primary: boolean;
}> = [
  { id: "amazon", label: "Amazon", url: AMAZON_PRODUCT_URL, primary: true },
  {
    id: "thalia",
    label: "Thalia",
    url: "https://www.thalia.de/shop/home/artikeldetails/A1081265220",
    primary: false,
  },
  {
    id: "hugendubel",
    label: "Hugendubel",
    url: "https://www.hugendubel.de/de/buch_kartoniert/soheil_hosseini-die_lizenz_zum_erfolg-54366155-produkt-details.html",
    primary: false,
  },
  {
    id: "buecher_de",
    label: "bücher.de",
    url: "https://www.buecher.de/shop/home/artikeldetails/A1081265220",
    primary: false,
  },
];

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

/**
 * Version der Teilnahmebedingungen, die Teilnehmende bestätigen.
 * 1.3: Bikinilista- und Amazon-Gutscheine ergänzt, /verlosung als weiterer
 * Teilnahmeweg. Ältere gespeicherte Versionen bleiben unverändert erhalten.
 */
export const TERMS_VERSION = "1.3 (16.09.2026)";

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
/**
 * Serverseitig geprüfte Wohnsitzländer (Eingabe im Formular ist frei; die
 * Prüfung normalisiert Groß-/Kleinschreibung, Akzente und gängige Schreibweisen).
 */
export const ELIGIBLE_COUNTRY_ALIASES: Record<"DE" | "AT" | "CH", readonly string[]> = {
  DE: ["deutschland", "germany", "de", "brd", "bundesrepublik deutschland", "d"],
  AT: ["österreich", "oesterreich", "osterreich", "austria", "at", "a"],
  CH: ["schweiz", "switzerland", "suisse", "svizzera", "ch"],
};

/** Öffentliche URL der ursprünglichen Landingpage (Canonical/OG). */
export const GEWINN_URL = "https://lizenzzumerfolg.com/gewinn";

/** Öffentliche URL der Kampagnen-Landingpage (Canonical/OG/Teilen). */
export const VERLOSUNG_URL = "https://lizenzzumerfolg.com/verlosung";

/** Zulässige Teilnahmewege (werden je Teilnahme serverseitig gespeichert). */
export const ENTRY_PATHS = ["/gewinn", "/verlosung"] as const;
export type EntryPath = (typeof ENTRY_PATHS)[number];
export function isEntryPath(value: unknown): value is EntryPath {
  return typeof value === "string" && (ENTRY_PATHS as readonly string[]).includes(value);
}

/** Teilen-Text (native Teilen-Funktion) – exakt laut Kampagnenbriefing. */
export const VERLOSUNG_SHARE_TEXT = `Dubai für zwei und ${VOUCHER_TOTAL_COUNT} Gutscheine zu gewinnen! Entdecke die Buchaktion zu „Die Lizenz zum Erfolg“. Buch bestellen, Bestellnummer registrieren und teilnehmen. Alle Infos: ${VERLOSUNG_URL}`;
/** Teilen-Text nach Aktionsende – verspricht keine neue Teilnahme mehr. */
export const VERLOSUNG_SHARE_TEXT_CLOSED = `„Die Lizenz zum Erfolg“ von Soheil Hosseini – die Verlosung ist beendet, das Buch gibt es weiterhin. Alle Infos: ${VERLOSUNG_URL}`;

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
