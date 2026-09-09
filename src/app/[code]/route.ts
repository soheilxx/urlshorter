import { randomUUID } from "node:crypto";
import { after } from "next/server";
import {
  buildBridgeCsp,
  getLinkErrorStatus,
  renderBridgePage,
  renderLinkErrorPage,
  type LinkErrorKind,
} from "@/lib/bridge-html";
import { classifyRequest } from "@/lib/bot-detection";
import { BOOK_PRODUCT, isBookPurchaseUrl } from "@/lib/book-conversion-events";
import { resolveBookSite } from "@/lib/book-conversion-context";
import { recordClickEvent } from "@/lib/click-recording";
import { evaluateConsent } from "@/lib/consent";
import { prisma } from "@/lib/db";
import { getEnv, requireAppSecret } from "@/lib/env";
import { createEventToken } from "@/lib/event-token";
import { logger } from "@/lib/logger";
import { extractUtmParams, getClientIp, getGeoInfo, getReferrer } from "@/lib/request-info";
import { isValidLiFatId, sendLinkedInCapiEvent, type LinkedInCapiInput } from "@/lib/linkedin-capi";
import { deriveFbc, sendMetaCapiEvents, type MetaCapiInput } from "@/lib/meta-capi";
import { sendTikTokEvents, type TikTokEventsInput } from "@/lib/tiktok-events";
import { sendRedditCapiEvents, type RedditCapiInput } from "@/lib/reddit-capi";
import { getRedirectDelayMs } from "@/lib/settings";
import { isValidShortCode } from "@/lib/shortcode";
import { parseUserAgent } from "@/lib/ua-parser";
import { computeVisitorHash } from "@/lib/visitor-hash";

/**
 * Redirect- und Tracking-Route: GET /{code}
 *
 * - Menschliche Besucher erhalten eine minimale HTML-Bridge-Page (Status 200),
 *   die die Tracking-Events anstößt und anschließend clientseitig zur
 *   Amazon-URL weiterleitet.
 * - Bots/Crawler/Link-Previews werden getrennt erfasst und direkt per 302
 *   weitergeleitet (keine Pixel nötig).
 * - Die Route wird niemals gecacht (Cache-Control: no-store).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Vercel-CDN-Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

/** after() steht nur im Next-Request-Kontext zur Verfügung; in Tests wird direkt ausgeführt. */
function scheduleAfterResponse(fn: () => Promise<void>): Promise<void> | void {
  try {
    after(fn);
  } catch {
    return fn();
  }
}

function errorResponse(kind: LinkErrorKind): Response {
  const env = getEnv();
  const html = renderLinkErrorPage(kind, {
    privacyUrl: env.PRIVACY_URL,
    imprintUrl: env.IMPRINT_URL,
  });
  return new Response(html, {
    status: getLinkErrorStatus(kind),
    headers: {
      ...NO_CACHE_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function parseCookies(header: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      const name = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (name) {
        try {
          map.set(name, decodeURIComponent(value));
        } catch {
          /* Ignore malformed cookies. */
        }
      }
    }
  }
  return map;
}

async function handle(request: Request, code: string): Promise<Response> {
  if (!isValidShortCode(code)) {
    return errorResponse("not_found");
  }

  let link: Awaited<ReturnType<typeof loadLink>>;
  try {
    link = await loadLink(code);
  } catch (error) {
    logger.error("redirect.db_error", {
      code,
      message: error instanceof Error ? error.message : "unknown",
    });
    return errorResponse("server_error");
  }

  if (!link) return errorResponse("not_found");
  if (!link.active || !link.destination.active) return errorResponse("inactive");
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
    return errorResponse("expired");
  }

  const destinationUrl = link.destination.url;

  // Ab hier gilt: Der Besucher MUSS Amazon erreichen. Jeder weitere Fehler
  // (Tracking, Einstellungen, Token) führt höchstens zum direkten Redirect.
  try {
    const env = getEnv();
    const headers = request.headers;
    const url = new URL(request.url);
    const userAgent = headers.get("user-agent");

    const bot = classifyRequest({
      method: request.method,
      userAgent,
      purposeHeader: headers.get("purpose"),
      secPurposeHeader: headers.get("sec-purpose"),
    });

    const ua = parseUserAgent(userAgent);
    const geo = getGeoInfo(headers);
    const utm = extractUtmParams(url.searchParams);

    const cookies = parseCookies(headers.get("cookie"));
    const consent = evaluateConsent({
      mode: env.TRACKING_CONSENT_MODE,
      cookieName: env.CONSENT_COOKIE_NAME,
      acceptedValue: env.CONSENT_COOKIE_ACCEPTED_VALUE,
      cookieValue: env.CONSENT_COOKIE_NAME ? (cookies.get(env.CONSENT_COOKIE_NAME) ?? null) : null,
    });

    const appSecret = requireAppSecret();
    const eventId = randomUUID();
    const isBook = isBookPurchaseUrl(destinationUrl);
    // The dashboard configuration must target the same pixel on landing pages and shortlinks.
    const bookSite = isBook ? await resolveBookSite() : null;
    const metaPixelId = bookSite ? bookSite.metaPixelId : env.META_PIXEL_ID;
    const metaToken = bookSite ? bookSite.metaToken : env.META_CAPI_ACCESS_TOKEN;
    const tiktokPixelId = bookSite ? bookSite.tiktokPixelId : env.TIKTOK_PIXEL_ID;
    const tiktokToken = bookSite ? bookSite.tiktokToken : env.TIKTOK_EVENTS_API_TOKEN;

    const visitorHash = bot.isBot
      ? null
      : computeVisitorHash({
          secret: appSecret,
          ip: getClientIp(headers),
          userAgent,
          acceptLanguage: headers.get("accept-language"),
        });

    const clickData = {
      id: eventId,
      shortLinkId: link.id,
      code: link.code,
      destinationId: link.destinationId,
      linkName: link.name,
      source: link.source,
      medium: link.medium,
      campaign: link.campaign,
      content: link.content,
      referrer: getReferrer(headers),
      ...utm,
      deviceType: ua.deviceType,
      browser: ua.browser,
      os: ua.os,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      latitude: geo.latitude,
      longitude: geo.longitude,
      isBot: bot.isBot,
      botReason: bot.reason,
      visitorHash,
      consent: consent.hasMarketingConsent,
    };

    // Meta Conversions API: serverseitige Events mit derselben event_id wie
    // das Browser-Pixel (Deduplication). Nur für Menschen und nur, wenn
    // Marketing-Tracking erlaubt ist. IP/UA werden ausschließlich transient
    // für diesen Aufruf verwendet, nicht gespeichert.
    let metaCapiInput: MetaCapiInput | null = null;
    if (!bot.isBot && consent.hasMarketingConsent && metaPixelId && metaToken) {
      metaCapiInput = {
        pixelId: metaPixelId,
        accessToken: metaToken,
        testEventCode: bookSite ? bookSite.metaTestEventCode : env.META_CAPI_TEST_EVENT_CODE,
        outboundEventName: isBook ? "AddToCart" : "AmazonOutboundClick",
        eventId,
        eventTimeMs: Date.now(),
        eventSourceUrl: `${env.PUBLIC_BASE_URL}/${link.code}`,
        clientIp: getClientIp(headers),
        clientUserAgent: userAgent,
        fbp: cookies.get("_fbp") ?? null,
        fbc: deriveFbc(url.searchParams.get("fbclid"), cookies.get("_fbc") ?? null),
        customData: {
          short_code: link.code,
          link_name: link.name,
          source: link.source,
          medium: link.medium ?? "",
          campaign: link.campaign ?? "",
          content: link.content ?? "",
          destination_host: link.destination.host,
          ...(isBook
            ? {
                content_name: BOOK_PRODUCT.name,
                content_ids: [BOOK_PRODUCT.id],
                content_type: "product",
                value: BOOK_PRODUCT.value,
                currency: BOOK_PRODUCT.currency,
              }
            : {}),
        },
      };
    }

    // TikTok Events API: analoges Muster (ClickButton mit derselben event_id
    // wie das Browser-Pixel; TikTok dedupliziert).
    let tiktokInput: TikTokEventsInput | null = null;
    if (!bot.isBot && consent.hasMarketingConsent && tiktokPixelId && tiktokToken) {
      tiktokInput = {
        pixelId: tiktokPixelId,
        accessToken: tiktokToken,
        testEventCode: bookSite ? bookSite.tiktokTestEventCode : env.TIKTOK_TEST_EVENT_CODE,
        eventName: isBook ? "AddToCart" : "ClickButton",
        eventId,
        eventTimeMs: Date.now(),
        pageUrl: `${env.PUBLIC_BASE_URL}/${link.code}`,
        clientIp: getClientIp(headers),
        clientUserAgent: userAgent,
        ttclid: url.searchParams.get("ttclid"),
        ttp: cookies.get("_ttp") ?? null,
        properties: {
          content_name: link.name,
          content_category: link.source,
          short_code: link.code,
          campaign: link.campaign ?? "",
          destination_host: link.destination.host,
          ...(isBook
            ? {
                value: BOOK_PRODUCT.value,
                currency: BOOK_PRODUCT.currency,
                contents: [
                  {
                    content_id: BOOK_PRODUCT.id,
                    content_type: "product",
                    content_name: BOOK_PRODUCT.name,
                  },
                ],
              }
            : {}),
        },
      };
    }

    // Buch-Kurzlinks: derselbe AddToCart wie im Reddit-Pixel, ohne Testmodus.
    let redditInput: RedditCapiInput | null = null;
    if (
      isBook &&
      !bot.isBot &&
      consent.hasMarketingConsent &&
      bookSite?.active !== false &&
      env.REDDIT_PIXEL_ID &&
      env.REDDIT_CAPI_ACCESS_TOKEN
    ) {
      redditInput = {
        pixelId: env.REDDIT_PIXEL_ID,
        accessToken: env.REDDIT_CAPI_ACCESS_TOKEN,
        events: [{ id: eventId, type: "AddToCart", timestamp: Date.now() }],
        sourceUrl: `${env.PUBLIC_BASE_URL}/${link.code}`,
        clickId: url.searchParams.get("rdt_cid") ?? cookies.get("_rdt_cid") ?? null,
        uuid: cookies.get("_rdt_uuid") ?? null,
        clientIp: getClientIp(headers),
        clientUserAgent: userAgent,
      };
    }

    // LinkedIn Conversions API: nur für Klicks aus LinkedIn-Anzeigen
    // (li_fat_id aus Query-Parameter oder Insight-Tag-Cookie) – LinkedIn
    // verlangt zwingend eine Nutzer-Kennung.
    let linkedInInput: LinkedInCapiInput | null = null;
    if (
      !bot.isBot &&
      consent.hasMarketingConsent &&
      bookSite?.active !== false &&
      env.LINKEDIN_CONVERSION_RULE_ID &&
      env.LINKEDIN_CAPI_ACCESS_TOKEN
    ) {
      const liFatId = url.searchParams.get("li_fat_id") ?? cookies.get("li_fat_id") ?? null;
      if (isValidLiFatId(liFatId)) {
        linkedInInput = {
          conversionRuleId: env.LINKEDIN_CONVERSION_RULE_ID,
          accessToken: env.LINKEDIN_CAPI_ACCESS_TOKEN,
          apiVersion: env.LINKEDIN_API_VERSION,
          eventId,
          eventTimeMs: Date.now(),
          liFatId,
        };
      }
    }

    // In Produktion registriert after() die Verarbeitung für nach der
    // Response (kein Await-Overhead); außerhalb des Next-Request-Kontexts
    // (Tests) wird direkt und vollständig awaited ausgeführt.
    await scheduleAfterResponse(async () => {
      await Promise.allSettled([
        recordClickEvent(clickData),
        ...(metaCapiInput ? [sendMetaCapiEvents(metaCapiInput)] : []),
        ...(tiktokInput ? [sendTikTokEvents(tiktokInput)] : []),
        ...(redditInput ? [sendRedditCapiEvents(redditInput)] : []),
        ...(linkedInInput ? [sendLinkedInCapiEvent(linkedInInput)] : []),
      ]);
    });

    // HEAD-Anfragen: keine Weiterleitung, kein Body – nur Status + Header.
    if (request.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { ...NO_CACHE_HEADERS, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Bots/Crawler/Previews: direkter 302-Redirect ohne Bridge-Page.
    if (bot.isBot) {
      return new Response(null, {
        status: 302,
        headers: { ...NO_CACHE_HEADERS, Location: destinationUrl },
      });
    }

    const [eventToken, delayMs] = await Promise.all([
      createEventToken(eventId, appSecret),
      getRedirectDelayMs(),
    ]);

    const html = renderBridgePage({
      destinationUrl,
      delayMs,
      eventToken,
      hasMarketingConsent: consent.hasMarketingConsent,
      tracking: {
        gtmContainerId: bookSite ? bookSite.gtmContainerId : env.GTM_CONTAINER_ID,
        ga4MeasurementId: bookSite ? bookSite.ga4MeasurementId : env.GA4_MEASUREMENT_ID,
        metaPixelId,
        redditPixelId: bookSite?.active === false ? null : env.REDDIT_PIXEL_ID,
        tiktokPixelId,
        linkedInPartnerId: bookSite ? bookSite.linkedInPartnerId : env.LINKEDIN_PARTNER_ID,
      },
      eventParams: {
        event_id: eventId,
        short_code: link.code,
        link_name: link.name,
        source: link.source,
        medium: link.medium ?? "",
        campaign: link.campaign ?? "",
        content: link.content ?? "",
        destination_host: link.destination.host,
      },
      privacyUrl: env.PRIVACY_URL,
      imprintUrl: env.IMPRINT_URL,
    });

    return new Response(html, {
      status: 200,
      headers: {
        ...NO_CACHE_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": buildBridgeCsp(env.bridgeExtraCspHosts),
      },
    });
  } catch (error) {
    // Bewusste Entscheidung: Tracking-Fehler dürfen den Besucher nicht
    // aufhalten – direkter Redirect zur Amazon-URL als Fallback.
    logger.error("redirect.bridge_failed_fallback", {
      code,
      message: error instanceof Error ? error.message : "unknown",
    });
    return new Response(null, {
      status: 302,
      headers: { ...NO_CACHE_HEADERS, Location: destinationUrl },
    });
  }
}

function loadLink(code: string) {
  return prisma.shortLink.findUnique({
    where: { code },
    include: { destination: true },
  });
}

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { code } = await context.params;
  return handle(request, code.toLowerCase());
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  const { code } = await context.params;
  return handle(request, code.toLowerCase());
}
