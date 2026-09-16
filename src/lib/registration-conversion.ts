import "server-only";
import { Prisma } from "@prisma/client";
import { BOOK_SITE_ID, resolveBookSite } from "@/lib/book-conversion-context";
import { BOOK_IDENTIFIER_PATTERN } from "@/lib/book-conversion-events";
import { classifyRequest } from "@/lib/bot-detection";
import {
  type ConsentMode,
  evaluateConsent,
  readCookieValue,
  resolveConsentCookie,
} from "@/lib/consent";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { EntryPath } from "@/lib/gewinnspiel-config";
import { logger } from "@/lib/logger";
import { sendMetaCapiSingle, sendTikTokSingle } from "@/lib/tag-capi";

/**
 * Serverseitiges Registrierungsevent der Gewinnspiel-Teilnahme.
 *
 * Wird ausschließlich nach tatsächlicher Speicherung einer Teilnahme aufgerufen
 * (nie beim Honeypot-Scheinerfolg). Der Browser sendet dasselbe Standardevent
 * "CompleteRegistration" mit derselben Ereignis-ID an Meta- und TikTok-Pixel;
 * die Anbieter deduplizieren Pixel- und Server-Event.
 *
 * Es werden KEINE Formulardaten übermittelt – nur Ereignis-ID, Seiten-URL,
 * transient IP/User-Agent (Match-Qualität) und die First-Party-Cookies der
 * Pixel (_fbp/_fbc/_ttp), sofern vorhanden.
 */

export const REGISTRATION_EVENT_NAME = "sweepstakes_registration";
export const REGISTRATION_STANDARD_EVENT = "CompleteRegistration";

/**
 * Consent-Modus je Teilnahmeweg. /gewinn: Entscheidung des Betreibers
 * (28.08.2026) – Tracking ohne Consent-Gate. /verlosung: nur mit wirksamer
 * Einwilligung über das Consent-Banner der Seite.
 */
export const ENTRY_PATH_CONSENT_MODE: Record<EntryPath, ConsentMode> = {
  "/gewinn": "not-required",
  "/verlosung": "required",
};

export interface RegistrationConversionInput {
  eventId: string;
  landingPath: EntryPath;
  eventTimeMs: number;
  clientIp: string | null;
  userAgent: string | null;
  /** Roher Cookie-Header des Formular-Requests (Consent + Pixel-Cookies). */
  cookieHeader: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  };
}

function identifier(value: string | null): string | null {
  return value && BOOK_IDENTIFIER_PATTERN.test(value) ? value : null;
}

/** Liegt für den Teilnahmeweg eine wirksame Marketing-Einwilligung vor? */
export function hasRegistrationTrackingConsent(
  landingPath: EntryPath,
  cookieHeader: string | null,
): boolean {
  const env = getEnv();
  const cookie = resolveConsentCookie(env);
  return evaluateConsent({
    mode: ENTRY_PATH_CONSENT_MODE[landingPath],
    cookieName: cookie.name,
    acceptedValue: cookie.acceptedValue,
    cookieValue: readCookieValue(cookieHeader, cookie.name),
  }).hasMarketingConsent;
}

/**
 * Speichert das Ereignis (TagEvent, Unique-Key = Idempotenz) und sendet es an
 * Meta CAPI und TikTok Events API. Fehler werden geloggt, nie geworfen – die
 * Teilnahme ist zu diesem Zeitpunkt bereits gespeichert.
 */
export async function sendRegistrationConversion(
  input: RegistrationConversionInput,
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!hasRegistrationTrackingConsent(input.landingPath, input.cookieHeader)) {
      return { sent: false, reason: "no-consent" };
    }
    if (
      classifyRequest({
        method: "POST",
        userAgent: input.userAgent,
        purposeHeader: null,
        secPurposeHeader: null,
      }).isBot
    ) {
      return { sent: false, reason: "bot" };
    }

    const env = getEnv();
    const sourceUrl = new URL(input.landingPath, env.PUBLIC_BASE_URL).toString();
    try {
      await prisma.tagEvent.create({
        data: {
          id: input.eventId,
          siteId: BOOK_SITE_ID,
          eventName: REGISTRATION_EVENT_NAME,
          url: sourceUrl,
          path: input.landingPath,
          createdAt: new Date(input.eventTimeMs),
          utmSource: input.utm.source ?? undefined,
          utmMedium: input.utm.medium ?? undefined,
          utmCampaign: input.utm.campaign ?? undefined,
          utmContent: input.utm.content ?? undefined,
          utmTerm: input.utm.term ?? undefined,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { sent: false, reason: "duplicate" };
      }
      throw error;
    }

    const site = await resolveBookSite();
    if (!site.active) return { sent: false, reason: "site-inactive" };

    const fbp = identifier(readCookieValue(input.cookieHeader, "_fbp"));
    const fbc = identifier(readCookieValue(input.cookieHeader, "_fbc"));
    const ttp = identifier(readCookieValue(input.cookieHeader, "_ttp"));
    let sent = false;

    if (site.metaPixelId && site.metaToken) {
      const ok = await sendMetaCapiSingle(site.metaPixelId, site.metaToken, site.metaTestEventCode, {
        eventId: input.eventId,
        eventName: REGISTRATION_STANDARD_EVENT,
        eventTimeMs: input.eventTimeMs,
        sourceUrl,
        clientIp: input.clientIp,
        clientUserAgent: input.userAgent,
        fbp,
        fbc,
        ttp: null,
        ttclid: null,
        customData: { content_name: "Gewinnspiel-Teilnahme", status: "received" },
      });
      if (ok) {
        sent = true;
        logger.info("registration_capi.meta_sent", { eventId: input.eventId });
        await prisma.tagEvent
          .update({ where: { id: input.eventId }, data: { metaForwardedAt: new Date() } })
          .catch(() => {});
      }
    } else {
      logger.warn("registration_capi.meta_not_configured", { eventId: input.eventId });
    }

    if (site.tiktokPixelId && site.tiktokToken) {
      const ok = await sendTikTokSingle(
        site.tiktokPixelId,
        site.tiktokToken,
        site.tiktokTestEventCode,
        {
          eventId: input.eventId,
          eventName: REGISTRATION_STANDARD_EVENT,
          eventTimeMs: input.eventTimeMs,
          sourceUrl,
          clientIp: input.clientIp,
          clientUserAgent: input.userAgent,
          fbp: null,
          fbc: null,
          ttp,
          ttclid: null,
          properties: { content_name: "Gewinnspiel-Teilnahme" },
        },
      );
      if (ok) {
        sent = true;
        logger.info("registration_capi.tiktok_sent", { eventId: input.eventId });
        await prisma.tagEvent
          .update({ where: { id: input.eventId }, data: { tiktokForwardedAt: new Date() } })
          .catch(() => {});
      }
    }

    // LinkedIn bewusst nicht: Die konfigurierte Conversion-Regel bildet den
    // Händler-Klick (AddToCart-Proxy) ab; eine Registrierung bräuchte eine eigene Regel.
    return { sent };
  } catch (error) {
    logger.error("registration_capi.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { sent: false, reason: "error" };
  }
}
