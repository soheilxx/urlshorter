import "server-only";
import { logger } from "@/lib/logger";

/**
 * Meta Conversions API (serverseitiges Event-Tracking).
 *
 * Für jeden menschlichen Klick werden – parallel zum Browser-Pixel – dieselben
 * Events ("PageView" und "AmazonOutboundClick") mit derselben `event_id` an
 * die Graph API gesendet. Meta dedupliziert Browser- und Server-Events über
 * (event_name, event_id); es wird also nichts doppelt gezählt, aber Klicks
 * mit Adblocker gehen nicht mehr verloren.
 *
 * Datenschutz: IP-Adresse und User-Agent werden ausschließlich transient für
 * den API-Aufruf verwendet (Meta verlangt mindestens einen user_data-
 * Parameter) und in der eigenen Datenbank weiterhin NICHT gespeichert.
 * Fehler werden geloggt und niemals an den Besucher durchgereicht.
 */

const DEFAULT_API_VERSION = "v23.0";
const CAPI_TIMEOUT_MS = 4000;
const MAX_FIELD_LENGTH = 500;

export interface MetaCapiInput {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  apiVersion?: string | null;
  /** Stabile Event-ID des Klicks (identisch mit der eventID des Browser-Pixels). */
  eventId: string;
  /** Klick-Zeitpunkt in Millisekunden (Epoch). */
  eventTimeMs: number;
  /** URL des Kurzlinks, z. B. https://lizenzzumerfolg.com/abcd */
  eventSourceUrl: string;
  clientIp: string | null;
  clientUserAgent: string | null;
  /** Wert des _fbp-Cookies, falls vorhanden. */
  fbp: string | null;
  /** Click-ID: _fbc-Cookie oder aus fbclid abgeleitet. */
  fbc: string | null;
  customData: Record<string, string>;
}

function clip(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_FIELD_LENGTH) : null;
}

/**
 * Leitet den fbc-Parameter ab: vorhandenes _fbc-Cookie hat Vorrang, sonst
 * wird er aus dem fbclid-Query-Parameter im offiziellen Format
 * `fb.1.<timestampMs>.<fbclid>` gebildet.
 */
export function deriveFbc(
  fbclid: string | null,
  fbcCookie: string | null,
  nowMs: number = Date.now(),
): string | null {
  const cookie = clip(fbcCookie);
  if (cookie) return cookie;
  const clickId = clip(fbclid);
  if (clickId && /^[A-Za-z0-9_-]+$/.test(clickId)) {
    return `fb.1.${nowMs}.${clickId}`;
  }
  return null;
}

interface MetaCapiEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url: string;
  user_data: Record<string, string>;
  custom_data?: Record<string, string>;
}

export interface MetaCapiPayload {
  data: MetaCapiEvent[];
  test_event_code?: string;
}

/** Baut den Request-Body (pur und damit testbar). */
export function buildMetaCapiPayload(input: MetaCapiInput): MetaCapiPayload {
  const eventTime = Math.floor(input.eventTimeMs / 1000);

  const userData: Record<string, string> = {};
  const ip = clip(input.clientIp);
  const ua = clip(input.clientUserAgent);
  const fbp = clip(input.fbp);
  const fbc = clip(input.fbc);
  if (ip) userData.client_ip_address = ip;
  if (ua) userData.client_user_agent = ua;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const base = {
    event_time: eventTime,
    event_id: input.eventId,
    action_source: "website" as const,
    event_source_url: input.eventSourceUrl,
    user_data: userData,
  };

  const payload: MetaCapiPayload = {
    data: [
      { event_name: "PageView", ...base },
      { event_name: "AmazonOutboundClick", ...base, custom_data: input.customData },
    ],
  };
  const testEventCode = clip(input.testEventCode);
  if (testEventCode) payload.test_event_code = testEventCode;
  return payload;
}

/**
 * Sendet die Events an die Graph API. Wirft niemals – Fehler werden geloggt
 * (der Versand läuft nach der Response und darf den Besucher nie betreffen).
 */
export async function sendMetaCapiEvents(input: MetaCapiInput): Promise<void> {
  const version = clip(input.apiVersion) ?? DEFAULT_API_VERSION;
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(input.pixelId)}/events`;
  const payload = buildMetaCapiPayload(input);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CAPI_TIMEOUT_MS);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, access_token: input.accessToken }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error("meta_capi.send_failed", {
        eventId: input.eventId,
        status: response.status,
        // Fehlermeldung gekürzt loggen, ohne Token
        body: body.slice(0, 300),
      });
      return;
    }
    logger.info("meta_capi.sent", { eventId: input.eventId });
  } catch (error) {
    logger.error("meta_capi.request_error", {
      eventId: input.eventId,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
