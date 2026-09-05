import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { BookConversionConfig } from "@/lib/book-conversion-events";
import type { ConsentMode } from "@/lib/consent";
import { getEnv, requireAppSecret } from "@/lib/env";
import { AMAZON_PRODUCT_URL } from "@/lib/gewinnspiel-config";
import { resolveTagSite } from "@/lib/tag-sites";

/** TRACK.SITE-Site der Buchseiten – Pixel-IDs/Tokens aus Dashboard (DB) oder Env. */
export const BOOK_SITE_ID = "lizenzzumerfolg";

/** Pixel-IDs + CAPI-Tokens: Dashboard-Verwaltung zuerst, Env als Fallback; DB-Fehler → Env. */
export async function resolveBookSite() {
  const env = getEnv();
  const site = await resolveTagSite(BOOK_SITE_ID).catch(() => null);
  return {
    metaPixelId: site?.pixels.meta ?? env.META_PIXEL_ID ?? null,
    metaToken: site?.capi.metaToken ?? env.META_CAPI_ACCESS_TOKEN ?? null,
    metaTestEventCode: site?.capi.metaTestEventCode ?? env.META_CAPI_TEST_EVENT_CODE ?? null,
    tiktokPixelId: site?.pixels.tiktok ?? env.TIKTOK_PIXEL_ID ?? null,
    tiktokToken: site?.capi.tiktokToken ?? env.TIKTOK_EVENTS_API_TOKEN ?? null,
    tiktokTestEventCode: site?.capi.tiktokTestEventCode ?? env.TIKTOK_TEST_EVENT_CODE ?? null,
    linkedInPartnerId: site?.pixels.linkedin ?? env.LINKEDIN_PARTNER_ID ?? null,
  };
}

/**
 * Signierte Servervorgabe für das Buch-Conversion-Tracking (Meta/TikTok/
 * LinkedIn): Der Browser kann Route und Consent-Modus nicht verändern, die
 * CAPI-Tokens verlassen den Server nie. Muster: reddit-context.ts.
 */

const contextSchema = z.object({
  path: z.enum(["/", "/das-buch", "/gutschein", "/gewinn", "/buch-reddit"]),
  consentMode: z.enum(["required", "not-required"]),
  expires: z.number().int(),
});

export type BookTrackingPath = z.infer<typeof contextSchema>["path"];

function sign(payload: string): Buffer {
  return createHmac("sha256", requireAppSecret()).update(`book-conversion.v1.${payload}`).digest();
}

/** Numerische Conversion-ID aus Rule-ID oder URN (für das Insight-Tag). */
function linkedInConversionId(ruleId: string | null | undefined): string | null {
  if (!ruleId) return null;
  const digits = ruleId.trim().replace(/^urn:lla:llaPartnerConversion:/, "");
  return /^[0-9]{1,20}$/.test(digits) ? digits : null;
}

export async function createBookConversionConfig(
  path: BookTrackingPath,
  consentMode: ConsentMode,
): Promise<BookConversionConfig | null> {
  const env = getEnv();
  const site = await resolveBookSite();
  const metaPixelId = site.metaPixelId;
  const tiktokPixelId = site.tiktokPixelId;
  const liConversionId = site.linkedInPartnerId
    ? linkedInConversionId(env.LINKEDIN_CONVERSION_RULE_ID)
    : null;
  if (!metaPixelId && !tiktokPixelId && !liConversionId) return null;
  try {
    const payload = Buffer.from(
      JSON.stringify({ path, consentMode, expires: Date.now() + 24 * 60 * 60 * 1000 }),
    ).toString("base64url");
    return {
      context: `${payload}.${sign(payload).toString("base64url")}`,
      path,
      amazonUrl: AMAZON_PRODUCT_URL,
      metaPixelId,
      tiktokPixelId,
      linkedInConversionId: liConversionId,
    };
  } catch {
    return null;
  }
}

export function verifyBookConversionContext(token: string, now = Date.now()) {
  try {
    if (token.length > 1_024) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts as [string, string];
    const actual = Buffer.from(signature, "base64url");
    const expected = sign(payload);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const parsed = contextSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString()),
    );
    if (!parsed.success || parsed.data.expires <= now) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
