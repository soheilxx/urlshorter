import { BUCH_ISBN13, BUCH_TITEL } from "@/lib/buch-config";

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

export interface BookConversionConfig {
  /** Signierter Serverkontext (Route + Consent-Modus + Ablauf). */
  context: string;
  path: string;
  amazonUrl: string;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  /** Numerische LinkedIn-Conversion-Regel für lintrk('track') – optional. */
  linkedInConversionId: string | null;
}
