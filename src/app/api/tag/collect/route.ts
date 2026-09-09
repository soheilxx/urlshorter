import { Prisma } from "@prisma/client";
import { after } from "next/server";
import { classifyRequest } from "@/lib/bot-detection";
import { prisma } from "@/lib/db";
import { requireAppSecret } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getClientIp, getGeoInfo } from "@/lib/request-info";
import { sendMetaCapiSingle, sendTikTokSingle, type TagCapiEvent } from "@/lib/tag-capi";
import { extractSiteId, originAllowed, parseTagCollectPayload } from "@/lib/tag-collect";
import { resolveTagSite } from "@/lib/tag-sites";
import { parseUserAgent } from "@/lib/ua-parser";
import { computeVisitorHash } from "@/lib/visitor-hash";
import { createHmac } from "node:crypto";

/**
 * Collect-Endpoint des Tracking-Snippets (t.js).
 *
 * - nimmt sendBeacon-POSTs (text/plain, kein Preflight) entgegen,
 * - validiert Payload + Domain-Allowlist + Origin,
 * - speichert das Event datensparsam (TagEvent),
 * - leitet es nach der Response an die Conversion-APIs weiter
 *   (Meta CAPI / TikTok Events API) – mit derselben event_id wie das
 *   Browser-Pixel, sodass die Anbieter deduplizieren.
 *
 * Antwortet bewusst fast immer 204 (auch bei Ablehnung) – ein Tracking-
 * Endpoint gibt Angreifern keine Diagnose-Hinweise.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MAX_BODY_BYTES = 8_000;

/** after() gibt es nur im Next-Request-Kontext; in Tests direkt ausführen. */
function scheduleAfterResponse(fn: () => Promise<void>): Promise<void> | void {
  try {
    after(fn);
  } catch {
    return fn();
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const done = () => new Response(null, { status: 204, headers: corsHeaders(origin) });

  try {
    const rawText = await request.text();
    if (Buffer.byteLength(rawText) > MAX_BODY_BYTES) return done();

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawText);
    } catch {
      return done();
    }

    // Site auflösen (Dashboard-DB zuerst, Code-Bootstrap als Fallback)
    const siteId = extractSiteId(rawJson);
    if (!siteId) return done();
    const site = await resolveTagSite(siteId);
    if (!site || !site.active) return done();

    const parsed = parseTagCollectPayload(rawJson, { id: site.id, domains: site.domains });
    if (!parsed.ok) return done();
    const data = parsed.data;

    if (!originAllowed({ id: site.id, domains: site.domains }, origin)) return done();

    const headers = request.headers;
    const userAgent = headers.get("user-agent");
    const bot = classifyRequest({
      method: "POST",
      userAgent,
      purposeHeader: headers.get("purpose"),
      secPurposeHeader: headers.get("sec-purpose"),
    });
    if (bot.isBot) return done();

    const appSecret = requireAppSecret();
    const geo = getGeoInfo(headers);
    const ua = parseUserAgent(userAgent);
    const clientIp = getClientIp(headers);

    const visitorHash = computeVisitorHash({
      secret: appSecret,
      ip: clientIp,
      userAgent,
      acceptLanguage: headers.get("accept-language"),
    });
    const cookieHash = data.cookieId
      ? createHmac("sha256", appSecret).update(`lze-cookie.${data.cookieId}`).digest("hex")
      : null;

    // Doppelte Beacons (Retry/Back-Forward-Cache) über die Event-ID abfangen
    const eventId = data.eventId;
    try {
      await prisma.tagEvent.create({
        data: {
          id: eventId,
          siteId: data.siteId,
          eventName: data.eventName,
          url: data.url,
          path: data.path,
          referrer: data.referrer,
          utmSource: data.utm.source,
          utmMedium: data.utm.medium,
          utmCampaign: data.utm.campaign,
          utmContent: data.utm.content,
          utmTerm: data.utm.term,
          country: geo.country,
          region: geo.region,
          city: geo.city,
          deviceType: ua.deviceType,
          browser: ua.browser,
          os: ua.os,
          visitorHash,
          cookieHash,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return done();
      throw error;
    }

    // Conversion-APIs nach der Response – mit den Tokens der jeweiligen Site
    const capiEvent: TagCapiEvent = {
      eventId,
      eventName: data.eventName,
      eventTimeMs: Date.now(),
      sourceUrl: data.url,
      clientIp,
      clientUserAgent: userAgent,
      fbp: data.fbp,
      fbc: data.fbc,
      ttp: data.ttp,
      ttclid: data.ttclid,
      customData: data.productParams,
      properties: data.productParams
        ? {
            value: data.productParams.value,
            currency: data.productParams.currency,
            contents: data.productParams.content_ids?.map((id) => ({
              content_id: id,
              content_name: data.productParams?.content_name,
              content_type: data.productParams?.content_type,
            })),
          }
        : undefined,
    };
    await scheduleAfterResponse(async () => {
      if (site.pixels.meta && site.capi.metaToken) {
        const sent = await sendMetaCapiSingle(
          site.pixels.meta,
          site.capi.metaToken,
          site.capi.metaTestEventCode,
          capiEvent,
        );
        if (sent) {
          await prisma.tagEvent
            .update({ where: { id: eventId }, data: { metaForwardedAt: new Date() } })
            .catch(() => {});
        }
      }
      if (site.pixels.tiktok && site.capi.tiktokToken) {
        const sent = await sendTikTokSingle(
          site.pixels.tiktok,
          site.capi.tiktokToken,
          site.capi.tiktokTestEventCode,
          capiEvent,
        );
        if (sent) {
          await prisma.tagEvent
            .update({ where: { id: eventId }, data: { tiktokForwardedAt: new Date() } })
            .catch(() => {});
        }
      }
    });

    return done();
  } catch (error) {
    logger.error("tag_collect.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return done();
  }
}
