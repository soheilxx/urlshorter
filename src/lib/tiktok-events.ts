import "server-only";
import { logger } from "@/lib/logger";

/**
 * TikTok Events API (serverseitiges Event-Tracking).
 *
 * Für jeden menschlichen Klick wird – parallel zum Browser-Pixel – das Event
 * "ClickButton" mit derselben `event_id` an die TikTok Business API gesendet.
 * TikTok dedupliziert Browser- und Server-Events über (event, event_id).
 * Das Browser-Pixel sendet zusätzlich `Pageview` (nur browserseitig, daher
 * keine Dedup-Kollision).
 *
 * Datenschutz: IP-Adresse und User-Agent werden ausschließlich transient für
 * den API-Aufruf verwendet und in der eigenen Datenbank NICHT gespeichert.
 * Fehler werden geloggt und niemals an den Besucher durchgereicht.
 */

const TIKTOK_EVENTS_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
const REQUEST_TIMEOUT_MS = 4000;
const MAX_FIELD_LENGTH = 500;

export interface TikTokEventsInput {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  /** Stabile Event-ID des Klicks (identisch mit der event_id des Browser-Pixels). */
  eventId: string;
  /** Klick-Zeitpunkt in Millisekunden (Epoch). */
  eventTimeMs: number;
  /** URL des Kurzlinks, z. B. https://lizenzzumerfolg.com/abcd */
  pageUrl: string;
  clientIp: string | null;
  clientUserAgent: string | null;
  /** TikTok Click-ID aus dem ttclid-Query-Parameter (Ads-Attribution). */
  ttclid: string | null;
  /** Wert des _ttp-Cookies, falls vorhanden. */
  ttp: string | null;
  properties: Record<string, string>;
}

function clip(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_FIELD_LENGTH) : null;
}

export interface TikTokEventsPayload {
  event_source: "web";
  event_source_id: string;
  data: Array<{
    event: string;
    event_time: number;
    event_id: string;
    user: Record<string, string>;
    page: { url: string };
    properties?: Record<string, string>;
  }>;
  test_event_code?: string;
}

/** Baut den Request-Body (pur und damit testbar). */
export function buildTikTokEventsPayload(input: TikTokEventsInput): TikTokEventsPayload {
  const user: Record<string, string> = {};
  const ip = clip(input.clientIp);
  const ua = clip(input.clientUserAgent);
  const ttclid = clip(input.ttclid);
  const ttp = clip(input.ttp);
  if (ip) user.ip = ip;
  if (ua) user.user_agent = ua;
  if (ttclid && /^[A-Za-z0-9._-]+$/.test(ttclid)) user.ttclid = ttclid;
  if (ttp) user.ttp = ttp;

  const payload: TikTokEventsPayload = {
    event_source: "web",
    event_source_id: input.pixelId,
    data: [
      {
        event: "ClickButton",
        event_time: Math.floor(input.eventTimeMs / 1000),
        event_id: input.eventId,
        user,
        page: { url: input.pageUrl },
        properties: input.properties,
      },
    ],
  };
  const testEventCode = clip(input.testEventCode);
  if (testEventCode) payload.test_event_code = testEventCode;
  return payload;
}

/**
 * Sendet das Event an die TikTok Business API. Wirft niemals – Fehler werden
 * geloggt (der Versand läuft nach der Response).
 */
export async function sendTikTokEvents(input: TikTokEventsInput): Promise<void> {
  const payload = buildTikTokEventsPayload(input);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(TIKTOK_EVENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": input.accessToken,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const bodyText = await response.text().catch(() => "");
    let apiCode: number | null = null;
    try {
      apiCode = (JSON.parse(bodyText) as { code?: number }).code ?? null;
    } catch {
      // Antwort war kein JSON – Status entscheidet
    }

    if (!response.ok || (apiCode !== null && apiCode !== 0)) {
      logger.error("tiktok_events.send_failed", {
        eventId: input.eventId,
        status: response.status,
        apiCode,
        body: bodyText.slice(0, 300),
      });
      return;
    }
    logger.info("tiktok_events.sent", { eventId: input.eventId });
  } catch (error) {
    logger.error("tiktok_events.request_error", {
      eventId: input.eventId,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
