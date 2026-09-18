"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { EMPTY_SWEEPSTAKES_STATE, type SweepstakesActionState } from "@/actions/action-states";
import {
  CARDS_CAMPAIGN_ID,
  CARDS_ENTRY_PATH,
  CARDS_THANKS_PATH,
} from "@/lib/cards-giveaway-config";
import {
  CARDS_RECEIPT_COOKIE,
  cardsReceiptCookieOptions,
  createCardsReceipt,
} from "@/lib/cards-receipt";
import { getClientIp } from "@/lib/request-info";
import { logger } from "@/lib/logger";
import { sendRegistrationConversion } from "@/lib/registration-conversion";
import { submitSweepstakesEntry } from "@/lib/sweepstakes";
import { readSweepstakesForm } from "@/lib/sweepstakes-form-input";

/**
 * Server Action des Cards-Gewinnspiels (/cards).
 *
 * Kampagne und Teilnahmeweg werden HIER serverseitig festgelegt
 * ("cards_2026", "/cards") – kein Hidden Field, Query-Parameter, Referrer oder
 * UTM kann in einen anderen Lostopf schreiben. Der gemeinsame, sichere
 * Teilnahme-Service (Validierung, Anti-Bot, Duplikate je Kampagne) bleibt.
 *
 * Nach dem Speichervorgang wird ein kurzlebiges, signiertes Receipt als
 * httpOnly-Cookie gesetzt und auf /cards/danke weitergeleitet. Nur eine
 * tatsächlich gespeicherte Teilnahme erhält eine Ereignis-ID (Konfetti +
 * Registrierungsevent); der Honeypot-Scheinerfolg erhält keine.
 */
export async function submitCardsEntryAction(
  _prev: SweepstakesActionState,
  formData: FormData,
): Promise<SweepstakesActionState> {
  try {
    const h = await headers();
    const { input, ctx, utm } = readSweepstakesForm(formData, h);
    const result = await submitSweepstakesEntry(input, {
      ...ctx,
      campaign: CARDS_CAMPAIGN_ID,
      landingPath: CARDS_ENTRY_PATH,
    });

    if (!result.ok) {
      return {
        ...EMPTY_SWEEPSTAKES_STATE,
        error: result.error,
        fieldErrors: result.fieldErrors ?? null,
      };
    }

    const jar = await cookies();
    jar.set(
      CARDS_RECEIPT_COOKIE,
      createCardsReceipt({
        referenceNumber: result.referenceNumber,
        trackingEventId: result.persisted ? result.trackingEventId : null,
        persisted: result.persisted,
      }),
      cardsReceiptCookieOptions(),
    );

    if (result.persisted && result.trackingEventId && result.landingPath) {
      const conversion = {
        eventId: result.trackingEventId,
        campaign: result.campaign,
        landingPath: result.landingPath,
        eventTimeMs: Date.now(),
        clientIp: getClientIp(h),
        userAgent: h.get("user-agent"),
        cookieHeader: h.get("cookie"),
        utm,
      };
      const send = () => sendRegistrationConversion(conversion).then(() => undefined);
      try {
        after(send);
      } catch {
        await send();
      }
    }
  } catch (error) {
    logger.error("cards.action_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      ...EMPTY_SWEEPSTAKES_STATE,
      error:
        "Deine Teilnahme konnte gerade nicht gespeichert werden. Bitte versuche es in einem Moment erneut.",
    };
  }

  // Außerhalb von try/catch: redirect() arbeitet über eine interne Exception.
  redirect(CARDS_THANKS_PATH);
}
