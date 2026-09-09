import { BUCH_ISBN13, BUCH_TITEL } from "@/lib/buch-config";
import { AMAZON_PRODUCT_URL } from "@/lib/gewinnspiel-config";

/**
 * Gemeinsamer Vertrag (Browser + Server) für das Conversion-Tracking der
 * Buchseiten über Meta, TikTok und LinkedIn – Gegenstück zu reddit-events.ts.
 *
 * Standardevents (kein Custom-Event mehr für Amazon-Klicks):
 * - "PageView"  → Meta PageView (Pixel + CAPI, gleiche event_id)
 * - "AddToCart" → Meta AddToCart, TikTok AddToCart, LinkedIn Conversion,
 *                 GA4 add_to_cart – ausgelöst durch einen Klick auf einen
 *                 Amazon-CTA (ausdrücklich gewünschter Kauf-Proxy, kein Umsatz).
 */
export const BOOK_CONVERSION_TYPES = ["PageView", "AddToCart"] as const;
export type BookConversionType = (typeof BOOK_CONVERSION_TYPES)[number];

/** Produktdaten für custom_data / properties / GA4-items (öffentliche Fakten). */
export const BOOK_PRODUCT = {
  name: BUCH_TITEL,
  id: BUCH_ISBN13,
  value: 18,
  currency: "EUR",
} as const;

export const BOOK_IDENTIFIER_PATTERN = /^[a-zA-Z0-9._:-]{1,200}$/;

function exactPattern(value: string) {
  return `^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
}
const affiliate = new URL(AMAZON_PRODUCT_URL);
/** Öffentliche Produktidentitäten; dieselben Regeln werden auch in t.js eingebettet. */
export const BOOK_PURCHASE_URL_RULES = [
  { host: exactPattern(affiliate.hostname), path: exactPattern(affiliate.pathname) },
  {
    host: "^(?:www\\.|smile\\.|m\\.)?amazon\\.(?:de|com|co\\.uk|fr|it|es|nl|pl|se|com\\.be)$",
    // ISBN-10 / ASIN der deutschen Taschenbuch-Ausgabe (gewinnspiel-config.ts).
    path: "\\/(?:dp|gp\\/product|exec\\/obidos\\/ASIN)\\/3690662508(?:\\/|$)",
    flags: "i",
  },
  {
    host: "^(?:www\\.)?(?:thalia|buecher)\\.de$",
    path: "^/shop/home/artikeldetails/A1081265220/?$",
  },
  {
    host: "^(?:www\\.)?hugendubel\\.de$",
    path: exactPattern(
      "/de/buch_kartoniert/soheil_hosseini-die_lizenz_zum_erfolg-54366155-produkt-details.html",
    ),
  },
];

/** Nur bekannte Produktziele dieses Buchs, niemals Händler-Homepages oder Buch-Infoseiten. */
export function isBookPurchaseUrl(destination: string): boolean {
  try {
    const url = new URL(destination);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    return BOOK_PURCHASE_URL_RULES.some(
      ({ host, path, flags }) =>
        new RegExp(host, flags).test(url.hostname) && new RegExp(path, flags).test(url.pathname),
    );
  } catch {
    return false;
  }
}

export interface BookConversionConfig {
  /** Eine im Dashboard deaktivierte Site darf keine Env-Fallback-Pixel starten. */
  enabled?: boolean;
  /** Signierter Serverkontext (Route + Consent-Modus + Ablauf). */
  context: string;
  path: string;
  amazonUrl: string;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  /** Numerische LinkedIn-Conversion-Regel für lintrk('track') – optional. */
  linkedInConversionId: string | null;
  /** Aufgelöste Dashboard-Konfiguration; ältere Aufrufer nutzen die Env-Props. */
  linkedInPartnerId?: string | null;
  ga4MeasurementId?: string | null;
  gtmContainerId?: string | null;
}
