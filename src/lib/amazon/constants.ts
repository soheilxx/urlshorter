/**
 * Zentrale Konstanten des Amazon-Ranking-Moduls.
 * Bewusst ohne Server-Abhängigkeiten (auch in Client-Komponenten nutzbar).
 */

export const AMAZON_MARKETPLACE_DEFAULT = "www.amazon.de";

/** Fähigkeiten eines Datenproviders (Capability-basierte Abstraktion). */
export const AMAZON_CAPABILITIES = [
  "PRODUCT_RESOLUTION",
  "PRODUCT_METADATA",
  "PRODUCT_COVER",
  "PRODUCT_FORMATS",
  "WEBSITE_SALES_RANK",
  "CATEGORY_SALES_RANKS",
  "CATEGORY_HIERARCHY",
  "CATEGORY_SEARCH",
  "CATEGORY_LEADERBOARD",
  "PRICE",
  "AVAILABILITY",
  "PREORDER_STATUS",
  "RATING",
  "REVIEW_COUNT",
  "SALES_ESTIMATION",
  "PROVIDER_TIMESTAMP",
  "QUOTA_STATUS",
] as const;

export type AmazonCapability = (typeof AMAZON_CAPABILITIES)[number];

export const CREATORS_CAPABILITIES: AmazonCapability[] = [
  "PRODUCT_RESOLUTION",
  "PRODUCT_METADATA",
  "PRODUCT_COVER",
  "PRODUCT_FORMATS",
  "WEBSITE_SALES_RANK",
  "CATEGORY_SALES_RANKS",
  "CATEGORY_HIERARCHY",
  "PRICE",
  "AVAILABILITY",
  "PREORDER_STATUS",
];

export const RAINFOREST_CAPABILITIES: AmazonCapability[] = [
  "PRODUCT_RESOLUTION",
  "PRODUCT_METADATA",
  "PRODUCT_COVER",
  "WEBSITE_SALES_RANK",
  "CATEGORY_SALES_RANKS",
  "CATEGORY_SEARCH",
  "CATEGORY_LEADERBOARD",
  "PRICE",
  "AVAILABILITY",
  "PREORDER_STATUS",
  "RATING",
  "REVIEW_COUNT",
  "SALES_ESTIMATION",
  "PROVIDER_TIMESTAMP",
  "QUOTA_STATUS",
];

/** Hintergrundjobs des Moduls (Registry in lib/amazon/jobs.ts). */
export const AMAZON_JOB_TYPES = [
  "refresh-primary-book-ranks",
  "refresh-category-leaderboards",
  "refresh-product-metadata",
  "resolve-amazon-categories",
  "refresh-provider-health",
  "refresh-rainforest-account-status",
  "send-daily-ranking-digest",
  "cleanup-provider-payloads",
] as const;

export type AmazonJobType = (typeof AMAZON_JOB_TYPES)[number];

/** Intervall-Presets in Minuten (Adminbereich). */
export const INTERVAL_PRESETS_MINUTES = [15, 30, 60, 180, 360, 720, 1440] as const;

/** Absolute Untergrenze für Abrufintervalle (Providerschonung + Credits). */
export const MIN_INTERVAL_MINUTES = 15;
export const MAX_INTERVAL_MINUTES = 10_080; // 7 Tage

/** Schwellen für den Gesamtbuchrang (kleiner = besser). */
export const WEBSITE_RANK_THRESHOLDS = [
  100_000, 50_000, 25_000, 10_000, 5_000, 1_000, 500, 100,
] as const;

/** Schwellen für Kategorienränge. */
export const CATEGORY_RANK_THRESHOLDS = [100, 50, 25, 10, 5, 1] as const;

/** Kategorie-Typen (AmazonCategory.categoryType). */
export const CATEGORY_TYPE_WEBSITE = "WEBSITE";
export const CATEGORY_TYPE_BROWSE_NODE = "BROWSE_NODE";
export const CATEGORY_TYPE_BESTSELLERS = "BESTSELLERS";

/** Rainforest-Credit-Warnstufen (Anteil verbleibender Credits). */
export const CREDIT_WARN_LEVELS = {
  hint: 0.3,
  warning: 0.2,
  critical: 0.1,
} as const;

/** Erlaubte externe Hosts (SSRF-Allowlist) – ausschließlich diese werden kontaktiert. */
export const PROVIDER_HOST_ALLOWLIST = [
  "api.rainforestapi.com",
  "creatorsapi.amazon",
  "api.amazon.com",
  "api.amazon.co.uk",
  "api.amazon.co.jp",
  "api.amazon.de",
] as const;

/** Erlaubte Amazon-Bildhosts (Cover werden nur verlinkt, nie kopiert). */
export const AMAZON_IMAGE_HOSTS = [
  "m.media-amazon.com",
  "images-eu.ssl-images-amazon.com",
  "images-na.ssl-images-amazon.com",
] as const;

/** Anzeige-Labels der Provider. */
export const PROVIDER_LABELS: Record<string, string> = {
  CREATORS: "Amazon Creators API",
  RAINFOREST: "Rainforest API",
  MANUAL: "Manuell (Baseline)",
};

/** Ab wann ein kanonischer Wert ohne frische Messung als stale gilt (Minuten). */
export const DEFAULT_STALE_AFTER_MINUTES = 180;

/** Zeitfenster der KPI-Berechnung (Label → Millisekunden). */
export const KPI_WINDOWS = [
  { key: "1h", label: "1 Stunde", ms: 60 * 60 * 1000 },
  { key: "3h", label: "3 Stunden", ms: 3 * 60 * 60 * 1000 },
  { key: "6h", label: "6 Stunden", ms: 6 * 60 * 60 * 1000 },
  { key: "12h", label: "12 Stunden", ms: 12 * 60 * 60 * 1000 },
  { key: "24h", label: "24 Stunden", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "7 Tage", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", label: "30 Tage", ms: 30 * 24 * 60 * 60 * 1000 },
] as const;

export type KpiWindowKey = (typeof KPI_WINDOWS)[number]["key"];

/** Pflichthinweis für Verkaufsschätzungen (niemals ohne diesen anzeigen). */
export const SALES_ESTIMATE_DISCLAIMER =
  "Diese Angabe ist eine externe Schätzung auf Grundlage öffentlich sichtbarer " +
  "Amazon-Daten und keine bestätigte Verkaufszahl von Amazon, dem Verlag oder dem Händler.";

/** Pflichthinweis für Klick-/Rang-Zusammenhänge. */
export const CLICK_CORRELATION_DISCLAIMER =
  "Klicks sind keine bestätigten Verkäufe. Zeitliche Zusammenhänge zwischen " +
  "Klicks und Rangbewegungen sind Korrelationen – keine Kausalität und keine " +
  "bestätigte Amazon-Conversion.";
