import "server-only";
import { logger } from "@/lib/logger";

/**
 * Generische Einzel-Event-Sender für die Conversion-APIs (Meta, TikTok),
 * genutzt vom zentralen Tracking-Snippet (t.js → /api/tag/collect).
 *
 * Spiegelt bewusst die Muster der Bridge-Module (meta-capi.ts /
 * tiktok-events.ts): identische event_id wie das Browser-Pixel
 * (Deduplication), IP/UA nur transient, Fehler werden geloggt und
 * niemals geworfen.
 */

const META_API_VERSION = "v23.0";
const TIKTOK_EVENTS_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
const TIMEOUT_MS = 4000;
const MAX_FIELD_LENGTH = 500;

function clip(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_FIELD_LENGTH) : null;
}

export interface TagCapiEvent {
  eventId: string;
  /** page_view → PageView/Pageview; alles andere als Custom-Event-Name. */
  eventName: string;
  eventTimeMs: number;
  sourceUrl: string;
  clientIp: string | null;
  clientUserAgent: string | null;
  fbp: string | null;
  fbc: string | null;
  ttp: string | null;
  ttclid: string | null;
  /** Meta custom_data (z. B. value/currency/content_ids bei AddToCart). */
  customData?: Record<string, unknown>;
  /** TikTok properties (z. B. value/currency/contents bei AddToCart). */
  properties?: Record<string, unknown>;
}

/** Meta-Event-Name (Standardevent für Seitenaufrufe, sonst Custom). */
function metaEventName(name: string): string {
  return name === "page_view" ? "PageView" : name;
}

/** TikTok-Event-Name (Standardevent "Pageview", sonst Custom). */
function tiktokEventName(name: string): string {
  return name === "page_view" ? "Pageview" : name;
}

export async function sendMetaCapiSingle(
  pixelId: string,
  accessToken: string,
  testEventCode: string | null,
  event: TagCapiEvent,
): Promise<boolean> {
  const userData: Record<string, string> = {};
  const ip = clip(event.clientIp);
  const ua = clip(event.clientUserAgent);
  const fbp = clip(event.fbp);
  const fbc = clip(event.fbc);
  if (ip) userData.client_ip_address = ip;
  if (ua) userData.client_user_agent = ua;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: metaEventName(event.eventName),
        event_time: Math.floor(event.eventTimeMs / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: event.sourceUrl,
        user_data: userData,
        ...(event.customData ? { custom_data: event.customData } : {}),
      },
    ],
  };
  const test = clip(testEventCode);
  if (test) payload.test_event_code = test;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(pixelId)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, access_token: accessToken }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error("tag_capi.meta_failed", {
        eventId: event.eventId,
        status: response.status,
        body: body.slice(0, 300),
      });
      return false;
    }
    return true;
  } catch (error) {
    logger.error("tag_capi.meta_error", {
      eventId: event.eventId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

export async function sendTikTokSingle(
  pixelId: string,
  accessToken: string,
  testEventCode: string | null,
  event: TagCapiEvent,
): Promise<boolean> {
  const user: Record<string, string> = {};
  const ip = clip(event.clientIp);
  const ua = clip(event.clientUserAgent);
  const ttp = clip(event.ttp);
  const ttclid = clip(event.ttclid);
  if (ip) user.ip = ip;
  if (ua) user.user_agent = ua;
  if (ttp) user.ttp = ttp;
  if (ttclid && /^[A-Za-z0-9._-]+$/.test(ttclid)) user.ttclid = ttclid;

  const payload: Record<string, unknown> = {
    event_source: "web",
    event_source_id: pixelId,
    data: [
      {
        event: tiktokEventName(event.eventName),
        event_time: Math.floor(event.eventTimeMs / 1000),
        event_id: event.eventId,
        user,
        page: { url: event.sourceUrl },
        ...(event.properties ? { properties: event.properties } : {}),
      },
    ],
  };
  const test = clip(testEventCode);
  if (test) payload.test_event_code = test;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(TIKTOK_EVENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": accessToken,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error("tag_capi.tiktok_failed", {
        eventId: event.eventId,
        status: response.status,
        body: body.slice(0, 300),
      });
      return false;
    }
    return true;
  } catch (error) {
    logger.error("tag_capi.tiktok_error", {
      eventId: event.eventId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}
