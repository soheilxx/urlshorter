"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import {
  EMPTY_SWEEPSTAKES_STATE,
  type SweepstakesActionState,
  type UserActionState,
  EMPTY_USER_STATE,
} from "@/actions/action-states";
import { writeAuditLog } from "@/lib/audit";
import { requireRoleOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClientIp } from "@/lib/request-info";
import { logger } from "@/lib/logger";
import { sendRegistrationConversion } from "@/lib/registration-conversion";
import { submitSweepstakesEntry } from "@/lib/sweepstakes";
import {
  CAMPAIGN_IDS,
  campaignPrize,
  DUBAI_CAMPAIGN_ID,
  getCampaign,
} from "@/lib/sweepstakes-campaign";
import { createFormToken } from "@/lib/sweepstakes-crypto";
import { optionalField, readSweepstakesForm } from "@/lib/sweepstakes-form-input";

/**
 * Server Actions des Dubai-Gewinnspiels (/gewinn, /verlosung) und der
 * kampagnenübergreifenden Verwaltung.
 * - Teilnahme (öffentlich, ohne Login) – speichert AUSSCHLIESSLICH in der
 *   Dubai-Kampagne (serverseitig fest; die Cards-Kampagne hat ihre eigene
 *   Action in cards-actions.ts).
 * - Verwaltung (Status/Gewinn/Notiz/Anonymisierung – ausschließlich ADMIN),
 *   immer mit Prüfung der Kombination aus Teilnahme und Kampagne.
 *
 * Es werden keine personenbezogenen Formulardaten geloggt.
 */

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export async function submitSweepstakesAction(
  _prev: SweepstakesActionState,
  formData: FormData,
): Promise<SweepstakesActionState> {
  try {
    const h = await headers();
    const { input, ctx, utm } = readSweepstakesForm(formData, h);
    const result = await submitSweepstakesEntry(input, {
      ...ctx,
      // Fest: Dubai-Lostopf. Der Teilnahmeweg aus dem Formular wird im Service
      // gegen die Dubai-Wege (/gewinn, /verlosung) geprüft – nie gegen /cards.
      campaign: DUBAI_CAMPAIGN_ID,
      landingPath: optionalField(formData, "landingPath"),
    });

    if (!result.ok) {
      return {
        ...EMPTY_SWEEPSTAKES_STATE,
        error: result.error,
        fieldErrors: result.fieldErrors ?? null,
      };
    }

    // Serverseitiges Registrierungsevent (Meta CAPI / TikTok Events API) nur für
    // tatsächlich gespeicherte Teilnahmen mit bekanntem Teilnahmeweg; Consent
    // wird im Modul geprüft. Läuft nach der Antwort, blockiert das Formular nicht.
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

    return {
      ...EMPTY_SWEEPSTAKES_STATE,
      ok: true,
      referenceNumber: result.referenceNumber,
      trackingEventId: result.persisted ? result.trackingEventId : null,
    };
  } catch (error) {
    logger.error("sweepstakes.action_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      ...EMPTY_SWEEPSTAKES_STATE,
      error:
        "Deine Teilnahme konnte gerade nicht gespeichert werden. Bitte versuche es in einem Moment erneut.",
    };
  }
}

/**
 * Frisches Formular-Token für „Weitere Bestellnummer registrieren“ – ein neuer
 * Vorgang mit eigener Mindest-/Höchstdauer, ohne Seiten-Reload.
 */
export async function newFormTokenAction(): Promise<string> {
  return createFormToken();
}

const STATUS_VALUES = [
  "RECEIVED",
  "IN_REVIEW",
  "REVIEWED",
  "INVALID",
  "WINNER",
  "NOT_WON",
] as const;

export async function updateSweepstakesEntryAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const parsed = z
      .object({
        id: z.string().uuid(),
        campaignId: z.enum(CAMPAIGN_IDS),
        status: z.enum(STATUS_VALUES),
        prizeId: z.string().trim().max(80).optional(),
        internalNote: z.string().trim().max(2000, "Die Notiz ist zu lang.").optional(),
      })
      .safeParse({
        id: formData.get("id"),
        campaignId: formData.get("campaignId"),
        status: formData.get("status"),
        prizeId: str(formData, "prizeId") || undefined,
        internalNote: str(formData, "internalNote") || undefined,
      });
    if (!parsed.success) {
      return {
        ...EMPTY_USER_STATE,
        error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe.",
      };
    }

    const entry = await prisma.sweepstakesEntry.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, status: true, referenceNumber: true, campaignId: true, prizeId: true },
    });
    if (!entry) return { ...EMPTY_USER_STATE, error: "Die Teilnahme wurde nicht gefunden." };
    // Objekt + Kampagne müssen zusammenpassen: eine Cards-Teilnahme darf nicht
    // im Dubai-Kontext (und umgekehrt) geändert oder als Gewinn markiert werden.
    if (entry.campaignId !== parsed.data.campaignId) {
      return {
        ...EMPTY_USER_STATE,
        error: "Die Teilnahme gehört zu einer anderen Kampagne. Bitte die Seite neu laden.",
      };
    }
    if (entry.status === "DELETED") {
      return {
        ...EMPTY_USER_STATE,
        error: "Anonymisierte Teilnahmen können nicht geändert werden.",
      };
    }

    // Gewinnzuordnung nur aus dem Katalog GENAU dieser Kampagne, nur bei Status WINNER.
    let prizeId: string | null = null;
    if (parsed.data.status === "WINNER") {
      const prize = campaignPrize(entry.campaignId, parsed.data.prizeId);
      if (!prize) {
        return {
          ...EMPTY_USER_STATE,
          error: `Bitte einen Gewinn aus dem Katalog der Kampagne „${getCampaign(entry.campaignId).shortLabel}“ auswählen.`,
        };
      }
      prizeId = prize.id;
    }

    await prisma.sweepstakesEntry.update({
      where: { id: entry.id, campaignId: entry.campaignId },
      data: {
        status: parsed.data.status,
        prizeId,
        internalNote: parsed.data.internalNote ?? null,
      },
    });

    await writeAuditLog({
      actor: session.email,
      action: "sweepstakes.update",
      entityType: "SweepstakesEntry",
      entityId: entry.id,
      changes: {
        reference: entry.referenceNumber,
        campaign: entry.campaignId,
        status: { from: entry.status, to: parsed.data.status },
        prize: { from: entry.prizeId, to: prizeId },
        noteChanged: parsed.data.internalNote !== undefined,
      },
    });

    return { ...EMPTY_USER_STATE, ok: true, success: "Die Teilnahme wurde aktualisiert." };
  } catch (error) {
    return {
      ...EMPTY_USER_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}

/**
 * Datenschutz-Löschung: personenbezogene Felder werden geleert, Referenz und
 * Bestellnummern-Hash bleiben (verhindert erneute Registrierung derselben
 * Bestellung in dieser Kampagne). Die verschlüsselte Bestellnummer wird
 * ebenfalls entfernt.
 */
export async function anonymizeSweepstakesEntryAction(formData: FormData): Promise<void> {
  const session = await requireRoleOrThrow("ADMIN");
  const id = z.string().uuid().parse(formData.get("id"));
  const campaignId = z.enum(CAMPAIGN_IDS).parse(formData.get("campaignId"));

  const entry = await prisma.sweepstakesEntry.findUnique({
    where: { id },
    select: { id: true, referenceNumber: true, status: true, campaignId: true },
  });
  if (!entry || entry.campaignId !== campaignId) redirect("/admin/gewinnspiel");

  await prisma.sweepstakesEntry.update({
    where: { id: entry.id, campaignId },
    data: {
      status: "DELETED",
      prizeId: null,
      firstName: "",
      lastName: "",
      street: "",
      houseNumber: "",
      postalCode: "",
      city: "",
      country: "",
      email: "",
      phone: "",
      retailerOther: null,
      orderNumberEncrypted: "",
      internalNote: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      referrer: null,
      submissionIdentifier: null,
    },
  });

  await writeAuditLog({
    actor: session.email,
    action: "sweepstakes.anonymize",
    entityType: "SweepstakesEntry",
    entityId: entry.id,
    changes: {
      reference: entry.referenceNumber,
      campaign: entry.campaignId,
      previousStatus: entry.status,
    },
  });

  redirect(`/admin/gewinnspiel?campaign=${campaignId}`);
}
