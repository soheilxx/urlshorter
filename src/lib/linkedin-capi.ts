import "server-only";
import { logger } from "@/lib/logger";

/**
 * LinkedIn Conversions API (serverseitiges Conversion-Tracking).
 *
 * LinkedIn verlangt pro Event mindestens eine Nutzer-Kennung. Ohne E-Mails
 * bleibt für anonymen Website-Traffic nur die LinkedIn-Klick-ID
 * (`li_fat_id`), die LinkedIn an die Ziel-URLs von Anzeigen anhängt bzw.
 * die das Insight Tag als First-Party-Cookie ablegt. Events werden daher
 * NUR gesendet, wenn eine li_fat_id vorliegt – also für Klicks, die aus
 * LinkedIn-Anzeigen kommen (organische Klicks kann LinkedIn ohnehin nicht
 * zuordnen).
 *
 * Die eventId entspricht der Event-ID des Klicks (Deduplication, falls
 * dieselbe Conversion zusätzlich über das Insight Tag gemeldet würde).
 * Datenschutz: IP/UA werden hier nicht übertragen; die li_fat_id ist eine
 * von LinkedIn selbst vergebene Werbe-Kennung.
 */

const LINKEDIN_EVENTS_URL = "https://api.linkedin.com/rest/conversionEvents";
const DEFAULT_API_VERSION = "202510";
const REQUEST_TIMEOUT_MS = 4000;

export interface LinkedInCapiInput {
  /** Conversion-Regel: numerische ID oder vollständige URN. */
  conversionRuleId: string;
  accessToken: string;
  apiVersion?: string | null;
  /** Stabile Event-ID des Klicks. */
  eventId: string;
  /** Klick-Zeitpunkt in Millisekunden (Epoch). */
  eventTimeMs: number;
  /** LinkedIn-Klick-ID (li_fat_id aus Query-Parameter oder Cookie). */
  liFatId: string;
}

/** Baut die Conversion-URN aus einer numerischen ID oder reicht eine URN durch. */
export function toConversionUrn(conversionRuleId: string): string {
  const trimmed = conversionRuleId.trim();
  if (trimmed.startsWith("urn:")) return trimmed;
  return `urn:lla:llaPartnerConversion:${trimmed}`;
}

/** Prüft, ob eine li_fat_id syntaktisch plausibel ist. */
export function isValidLiFatId(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 8 &&
    value.trim().length <= 200 &&
    /^[A-Za-z0-9._-]+$/.test(value.trim())
  );
}

export interface LinkedInCapiPayload {
  conversion: string;
  conversionHappenedAt: number;
  eventId: string;
  user: {
    userIds: Array<{ idType: string; idValue: string }>;
  };
}

/** Baut den Request-Body (pur und damit testbar). */
export function buildLinkedInCapiPayload(input: LinkedInCapiInput): LinkedInCapiPayload {
  return {
    conversion: toConversionUrn(input.conversionRuleId),
    conversionHappenedAt: Math.floor(input.eventTimeMs),
    eventId: input.eventId,
    user: {
      userIds: [
        {
          idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID",
          idValue: input.liFatId.trim(),
        },
      ],
    },
  };
}

/**
 * Sendet das Conversion-Event an LinkedIn. Wirft niemals – Fehler werden
 * geloggt (der Versand läuft nach der Response).
 */
export async function sendLinkedInCapiEvent(input: LinkedInCapiInput): Promise<void> {
  const payload = buildLinkedInCapiPayload(input);
  const version = input.apiVersion?.trim() || DEFAULT_API_VERSION;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(LINKEDIN_EVENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.accessToken}`,
        "LinkedIn-Version": version,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error("linkedin_capi.send_failed", {
        eventId: input.eventId,
        status: response.status,
        body: body.slice(0, 300),
      });
      return;
    }
    logger.info("linkedin_capi.sent", { eventId: input.eventId });
  } catch (error) {
    logger.error("linkedin_capi.request_error", {
      eventId: input.eventId,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
