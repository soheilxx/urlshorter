/**
 * Kanal-Klassifizierung nach dem Vorbild der Google-Analytics-Channel-Groups.
 * Signal-Priorität: UTM-Parameter (tatsächliche Kampagnen-Kennzeichnung)
 * > konfigurierte Link-Metadaten (source/medium) > Referrer-Host > Direct.
 *
 * Bewusst ohne Server-Abhängigkeiten (reine Funktionen, unit-testbar).
 */

export const CHANNEL_IDS = [
  "paid",
  "organic_social",
  "search",
  "email",
  "referral",
  "direct",
  "other",
] as const;

export type ChannelId = (typeof CHANNEL_IDS)[number];

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  paid: "Paid Ads",
  organic_social: "Organic Social",
  search: "Suche",
  email: "E-Mail",
  referral: "Referral",
  direct: "Direct",
  other: "Sonstiges",
};

/**
 * Feste Farbzuordnung pro Kanal (kategoriale Slots der Dark-Palette).
 * Farbe folgt dem Kanal, nie der Rangfolge – Filter dürfen nicht umfärben.
 */
export const CHANNEL_COLORS: Record<ChannelId, string> = {
  organic_social: "#3987e5", // Slot 1 Blau
  paid: "#d95926", // Slot 2 Orange
  search: "#199e70", // Slot 3 Aqua
  email: "#c98500", // Slot 4 Gelb
  direct: "#d55181", // Slot 5 Magenta
  referral: "#9085e9", // Slot 7 Violett
  other: "#898781", // neutral
};

const SOCIAL_KEYS = [
  "facebook",
  "fb",
  "instagram",
  "tiktok",
  "linkedin",
  "twitter",
  "x.com",
  "t.co",
  "reddit",
  "pinterest",
  "youtube",
  "youtu.be",
  "threads",
  "snapchat",
  "telegram",
  "whatsapp",
  "xing",
  "mastodon",
  "bsky",
  "bluesky",
];

const SEARCH_KEYS = [
  "google",
  "bing",
  "duckduckgo",
  "ecosia",
  "yahoo",
  "startpage",
  "qwant",
  "brave",
  "seznam",
  "baidu",
  "yandex",
];

const PAID_PATTERN = /\b(cpc|ppc|paid|paidsocial|paid_social|ads?|cpm|display|retargeting|remarketing|performance|sponsored)\b/;
const MAIL_PATTERN = /(mail|newsletter)/;

export interface ChannelInput {
  source: string | null;
  medium: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  referrer: string | null;
}

/** Hostname eines Referrers ("www." entfernt), oder null. */
export function referrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

function matchesAny(value: string | null, keys: string[]): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return keys.some((key) => v === key || v.includes(key));
}

export function classifyChannel(input: ChannelInput, ownHost?: string | null): ChannelId {
  const medium = (input.utmMedium ?? input.medium ?? "").toLowerCase();
  const source = (input.utmSource ?? input.source ?? "").toLowerCase();
  const host = referrerHost(input.referrer);

  if (PAID_PATTERN.test(medium)) return "paid";
  if (MAIL_PATTERN.test(medium) || MAIL_PATTERN.test(source)) return "email";
  if (matchesAny(source, SOCIAL_KEYS) || matchesAny(host, SOCIAL_KEYS)) return "organic_social";
  if (matchesAny(source, SEARCH_KEYS) || matchesAny(host, SEARCH_KEYS)) return "search";
  if (host && host !== (ownHost ?? "").toLowerCase()) return "referral";
  if (!host && !source) return "direct";
  if (!host) return "other";
  return "direct";
}
