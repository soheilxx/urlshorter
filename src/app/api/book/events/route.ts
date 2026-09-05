import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BOOK_IDENTIFIER_PATTERN, BOOK_PRODUCT } from "@/lib/book-conversion-events";
import { verifyBookConversionContext } from "@/lib/book-conversion-context";
import { classifyRequest } from "@/lib/bot-detection";
import { evaluateConsent } from "@/lib/consent";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { AMAZON_PRODUCT_URL } from "@/lib/gewinnspiel-config";
import { isValidLiFatId, sendLinkedInCapiEvent } from "@/lib/linkedin-capi";
import { logger } from "@/lib/logger";
import { deriveFbc } from "@/lib/meta-capi";
import { getClientIp } from "@/lib/request-info";
import { sendMetaCapiSingle, sendTikTokSingle } from "@/lib/tag-capi";

/**
 * Empfänger der Buchseiten-Conversions (Muster: /api/reddit/events).
 * Speichert das Ereignis mit der Browser-Event-ID (TagEvent, Unique-Key =
 * Idempotenz) und reicht es nach der Antwort an die Conversion-APIs weiter:
 * - Meta CAPI: PageView + AddToCart (identische event_id wie das Pixel)
 * - TikTok Events API: AddToCart
 * - LinkedIn Conversions API: AddToCart (nur mit li_fat_id)
 * Tokens bleiben serverseitig; IP/UA nur transient, keine Rohdaten im Log.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const optionalId = z.string().regex(BOOK_IDENTIFIER_PATTERN).optional();
const bodySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["PageView", "AddToCart"]),
  timestamp: z.number().int(),
  context: z.string().max(1_024),
  path: z.string().max(100),
  destination: z.string().max(1_000).optional(),
  ctaId: z.string().max(64).optional(),
  fbp: optionalId,
  fbc: optionalId,
  fbclid: optionalId,
  ttp: optionalId,
  ttclid: optionalId,
  liFatId: optionalId,
  utm: z
    .object({
      source: z.string().max(120).optional(),
      medium: z.string().max(120).optional(),
      campaign: z.string().max(120).optional(),
      content: z.string().max(120).optional(),
      term: z.string().max(120).optional(),
    })
    .optional(),
});

function done(status = 204) {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Same-Origin-Prüfung des Beacons. `request.url` trägt hinter Proxys (Vercel)
 * bzw. bei lokalem `next start` nicht immer den vom Browser gesehenen Host,
 * deshalb zählen zusätzlich der Host-Header (inkl. x-forwarded-*) und die
 * kanonische PUBLIC_BASE_URL. Die eigentliche Absicherung ist der signierte Kontext.
 */
function isSameOrigin(request: Request, publicBaseUrl: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const url = new URL(request.url);
  const allowed = new Set<string>([url.origin]);
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  if (host) allowed.add(`${proto}://${host}`);
  try {
    allowed.add(new URL(publicBaseUrl).origin);
  } catch {
    /* ungültige Basis-URL zählt nicht */
  }
  return allowed.has(origin);
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isSameOrigin(request, getEnv().PUBLIC_BASE_URL)) return done(403);
    if (Number(request.headers.get("content-length")) > 8_000) return done(413);
    const text = await request.text();
    if (Buffer.byteLength(text) > 8_000) return done(413);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return done(400);
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return done(400);
    const input = parsed.data;
    const context = verifyBookConversionContext(input.context);
    if (!context || context.path !== input.path) return done(403);
    const age = Date.now() - input.timestamp;
    if (age > 10 * 60 * 1_000 || age < -60_000) return done(400);
    if (
      input.type === "AddToCart" &&
      (input.destination !== AMAZON_PRODUCT_URL || input.path === "/")
    )
      return done(400);

    const env = getEnv();
    const cookieName =
      env.CONSENT_COOKIE_NAME ?? (context.path === "/buch-reddit" ? "lze_reddit_consent" : null);
    const acceptedValue =
      env.CONSENT_COOKIE_ACCEPTED_VALUE ?? (context.path === "/buch-reddit" ? "yes" : null);
    let consentCookie: string | null = null;
    if (cookieName) {
      for (const part of (request.headers.get("cookie") ?? "").split(";")) {
        const [key, ...value] = part.trim().split("=");
        if (key === cookieName) {
          try {
            consentCookie = decodeURIComponent(value.join("="));
          } catch {
            /* denied */
          }
        }
      }
    }
    if (
      !evaluateConsent({
        mode: context.consentMode,
        cookieName,
        acceptedValue,
        cookieValue: consentCookie,
      }).hasMarketingConsent
    )
      return done();
    const userAgent = request.headers.get("user-agent");
    if (
      classifyRequest({
        method: "POST",
        userAgent,
        purposeHeader: request.headers.get("purpose"),
        secPurposeHeader: request.headers.get("sec-purpose"),
      }).isBot
    )
      return done();

    const sourceUrl = new URL(context.path, env.PUBLIC_BASE_URL).toString();
    const eventName = input.type === "PageView" ? "book_page_view" : "book_add_to_cart";
    // Atomarer Unique-Key verhindert doppelte Annahme bei parallelen Transportwiederholungen.
    try {
      await prisma.tagEvent.create({
        data: {
          id: input.id,
          siteId: "lizenzzumerfolg",
          eventName,
          url: sourceUrl,
          path: context.path,
          createdAt: new Date(input.timestamp),
          utmSource: input.utm?.source,
          utmMedium: input.utm?.medium,
          utmCampaign: input.utm?.campaign,
          utmContent: input.utm?.content,
          utmTerm: input.utm?.term,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return done();
      throw error;
    }

    const clientIp = getClientIp(request.headers);
    const isAddToCart = input.type === "AddToCart";
    const customData = isAddToCart
      ? {
          content_name: BOOK_PRODUCT.name,
          content_ids: [BOOK_PRODUCT.id],
          content_type: "product",
          value: BOOK_PRODUCT.value,
          currency: BOOK_PRODUCT.currency,
        }
      : undefined;

    const send = async () => {
      // Meta CAPI: PageView + AddToCart, dedupliziert über event_id (= Pixel eventID)
      if (env.META_PIXEL_ID && env.META_CAPI_ACCESS_TOKEN) {
        const ok = await sendMetaCapiSingle(
          env.META_PIXEL_ID,
          env.META_CAPI_ACCESS_TOKEN,
          env.META_CAPI_TEST_EVENT_CODE ?? null,
          {
            eventId: input.id,
            eventName: input.type,
            eventTimeMs: input.timestamp,
            sourceUrl,
            clientIp,
            clientUserAgent: userAgent,
            fbp: input.fbp ?? null,
            fbc: deriveFbc(input.fbclid ?? null, input.fbc ?? null, input.timestamp),
            ttp: null,
            ttclid: null,
            customData,
          },
        );
        if (ok) {
          logger.info("book_capi.meta_sent", { eventId: input.id, type: input.type });
          await prisma.tagEvent
            .update({ where: { id: input.id }, data: { metaForwardedAt: new Date() } })
            .catch(() => {});
        }
      } else {
        logger.warn("book_capi.meta_not_configured", { eventId: input.id });
      }

      if (!isAddToCart) return;

      // TikTok Events API: AddToCart, dedupliziert über event_id
      if (env.TIKTOK_PIXEL_ID && env.TIKTOK_EVENTS_API_TOKEN) {
        const ok = await sendTikTokSingle(
          env.TIKTOK_PIXEL_ID,
          env.TIKTOK_EVENTS_API_TOKEN,
          env.TIKTOK_TEST_EVENT_CODE ?? null,
          {
            eventId: input.id,
            eventName: "AddToCart",
            eventTimeMs: input.timestamp,
            sourceUrl,
            clientIp,
            clientUserAgent: userAgent,
            fbp: null,
            fbc: null,
            ttp: input.ttp ?? null,
            ttclid: input.ttclid ?? null,
            properties: {
              value: BOOK_PRODUCT.value,
              currency: BOOK_PRODUCT.currency,
              contents: [
                {
                  content_id: BOOK_PRODUCT.id,
                  content_type: "product",
                  content_name: BOOK_PRODUCT.name,
                },
              ],
            },
          },
        );
        if (ok) {
          logger.info("book_capi.tiktok_sent", { eventId: input.id });
          await prisma.tagEvent
            .update({ where: { id: input.id }, data: { tiktokForwardedAt: new Date() } })
            .catch(() => {});
        }
      }

      // LinkedIn Conversions API: nur mit Klick-ID attribuierbar
      if (
        env.LINKEDIN_CONVERSION_RULE_ID &&
        env.LINKEDIN_CAPI_ACCESS_TOKEN &&
        isValidLiFatId(input.liFatId)
      ) {
        await sendLinkedInCapiEvent({
          conversionRuleId: env.LINKEDIN_CONVERSION_RULE_ID,
          accessToken: env.LINKEDIN_CAPI_ACCESS_TOKEN,
          apiVersion: env.LINKEDIN_API_VERSION ?? null,
          eventId: input.id,
          eventTimeMs: input.timestamp,
          liFatId: input.liFatId,
        });
      }
    };
    try {
      after(send);
    } catch {
      await send();
    }
    return done();
  } catch {
    logger.error("book_collect.failed", {});
    return done(503);
  }
}
