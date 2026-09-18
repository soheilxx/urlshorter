import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CARDS_CAMPAIGN_ID, CARDS_THANKS_PATH } from "@/lib/cards-giveaway-config";
import { getEnv, requireAppSecret } from "@/lib/env";

/**
 * Kurzlebiger, signierter Nachweis („Receipt“) einer Cards-Registrierung für
 * die Bestätigungsseite /cards/danke.
 *
 * - Wird ausschließlich von der Cards-Server-Action nach dem Speichervorgang
 *   ausgestellt und als httpOnly-Cookie (Pfad /cards/danke) gesetzt – nie im
 *   Querystring, nie mit personenbezogenen Daten (nur Referenz, Ereignis-ID,
 *   Vorgangs-Nonce).
 * - `persisted: false` kennzeichnet den Honeypot-Scheinerfolg: die Seite zeigt
 *   dann eine neutrale Bestätigung ohne Konfetti und ohne Registrierungsevent.
 * - Die Nonce ist die undurchsichtige Vorgangskennung, mit der der Browser die
 *   einmalige Feier (Konfetti + Browser-Registrierungsevent) markiert.
 */

export const CARDS_RECEIPT_COOKIE = "lze_cards_receipt";
export const CARDS_RECEIPT_TTL_SECONDS = 20 * 60;

const VERSION = "cards-receipt.v1";

const receiptSchema = z.object({
  v: z.literal(1),
  campaign: z.literal(CARDS_CAMPAIGN_ID),
  ref: z.string().regex(/^[2-9A-HJKMNP-Z]{8}$/),
  eid: z.string().uuid().nullable(),
  persisted: z.boolean(),
  nonce: z.string().regex(/^[a-f0-9]{32}$/),
  iat: z.number().int(),
  exp: z.number().int(),
});

export interface CardsReceipt {
  campaign: typeof CARDS_CAMPAIGN_ID;
  referenceNumber: string;
  trackingEventId: string | null;
  persisted: boolean;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

function sign(payload: string): Buffer {
  return createHmac("sha256", requireAppSecret()).update(`${VERSION}.${payload}`).digest();
}

export function createCardsReceipt(
  input: { referenceNumber: string; trackingEventId: string | null; persisted: boolean },
  now: number = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      campaign: CARDS_CAMPAIGN_ID,
      ref: input.referenceNumber,
      eid: input.persisted ? input.trackingEventId : null,
      persisted: input.persisted,
      nonce: randomBytes(16).toString("hex"),
      iat: now,
      exp: now + CARDS_RECEIPT_TTL_SECONDS * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload).toString("base64url")}`;
}

export function verifyCardsReceipt(
  token: string | null | undefined,
  now: number = Date.now(),
): CardsReceipt | null {
  try {
    if (!token || token.length > 1_024) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts as [string, string];
    const actual = Buffer.from(signature, "base64url");
    const expected = sign(payload);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const parsed = receiptSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString()),
    );
    if (!parsed.success) return null;
    const data = parsed.data;
    if (data.exp <= now || data.iat > now + 60_000) return null;
    return {
      campaign: data.campaign,
      referenceNumber: data.ref,
      trackingEventId: data.persisted ? data.eid : null,
      persisted: data.persisted,
      nonce: data.nonce,
      issuedAt: data.iat,
      expiresAt: data.exp,
    };
  } catch {
    return null;
  }
}

/** Cookie-Attribute des Receipts (httpOnly, nur für /cards/danke, kurzlebig). */
export function cardsReceiptCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getEnv().PUBLIC_BASE_URL.startsWith("https://"),
    path: CARDS_THANKS_PATH,
    maxAge: CARDS_RECEIPT_TTL_SECONDS,
  };
}
