import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { classifyRequest } from "@/lib/bot-detection";
import { evaluateConsent } from "@/lib/consent";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { AMAZON_PRODUCT_URL } from "@/lib/gewinnspiel-config";
import { logger } from "@/lib/logger";
import { sendRedditCapiEvents } from "@/lib/reddit-capi";
import { verifyRedditContext } from "@/lib/reddit-context";
import { REDDIT_IDENTIFIER_PATTERN } from "@/lib/reddit-events";
import { getClientIp } from "@/lib/request-info";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
const optionalId = z.string().regex(REDDIT_IDENTIFIER_PATTERN).optional();
const bodySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["PageVisit", "AddToCart"]),
  timestamp: z.number().int(),
  context: z.string().max(1_024),
  path: z.string().max(100),
  destination: z.string().max(1_000).optional(),
  ctaId: z.string().max(64).optional(),
  clickId: optionalId,
  uuid: optionalId,
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

export async function POST(request: Request): Promise<Response> {
  try {
    const origin = new URL(request.url).origin;
    if (request.headers.get("origin") !== origin) return done(403);
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
    const context = verifyRedditContext(input.context);
    if (!context || context.path !== input.path) return done(403);
    const age = Date.now() - input.timestamp;
    if (age > 10 * 60 * 1_000 || age < -60_000) return done(400);
    if (
      input.type === "AddToCart" &&
      (input.destination !== AMAZON_PRODUCT_URL || input.path === "/")
    )
      return done(400);
    const env = getEnv();
    let consentCookie: string | null = null;
    if (env.CONSENT_COOKIE_NAME) {
      for (const part of (request.headers.get("cookie") ?? "").split(";")) {
        const [key, ...value] = part.trim().split("=");
        if (key === env.CONSENT_COOKIE_NAME) {
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
        cookieName: env.CONSENT_COOKIE_NAME,
        acceptedValue: env.CONSENT_COOKIE_ACCEPTED_VALUE,
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
    // Atomarer Unique-Key verhindert doppelte Annahme bei parallelen Transportwiederholungen.
    try {
      await prisma.tagEvent.create({
        data: {
          id: input.id,
          siteId: "lizenzzumerfolg",
          eventName:
            input.type === "PageVisit"
              ? "reddit_landing_page_view"
              : "reddit_amazon_outbound_click",
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
    if (!env.REDDIT_CAPI_ACCESS_TOKEN) {
      logger.warn("reddit_capi.not_configured", { eventId: input.id });
      return done();
    }
    const accessToken = env.REDDIT_CAPI_ACCESS_TOKEN;
    const send = async () => {
      await sendRedditCapiEvents({
        pixelId: context.pixelId,
        accessToken,
        // Ein aktiver Prüflauf darf regulären Anzeigen-Traffic nicht in Testevents umwandeln.
        testId:
          input.utm?.source === "reddit_capi_verification" ? env.REDDIT_CAPI_TEST_ID : null,
        events: [{ id: input.id, type: input.type, timestamp: input.timestamp }],
        sourceUrl,
        clickId: input.clickId,
        uuid: input.uuid,
        clientIp: getClientIp(request.headers),
        clientUserAgent: userAgent,
      });
    };
    try {
      after(send);
    } catch {
      await send();
    }
    return done();
  } catch {
    logger.error("reddit_collect.failed", {});
    return done(503);
  }
}
