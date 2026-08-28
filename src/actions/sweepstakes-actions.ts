"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
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
import { requireAppSecret } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/request-info";
import { submitSweepstakesEntry } from "@/lib/sweepstakes";
import { computeRateLimitIdentifier } from "@/lib/visitor-hash";

/**
 * Server Actions des Gewinnspiels.
 * - Teilnahme (öffentlich, ohne Login)
 * - Verwaltung (Status/Notiz/Anonymisierung – ausschließlich ADMIN)
 *
 * Es werden keine personenbezogenen Formulardaten geloggt.
 */

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function optional(formData: FormData, name: string): string | null {
  const v = str(formData, name).trim();
  return v.length > 0 ? v : null;
}

export async function submitSweepstakesAction(
  _prev: SweepstakesActionState,
  formData: FormData,
): Promise<SweepstakesActionState> {
  try {
    const h = await headers();
    const submissionIdentifier = computeRateLimitIdentifier({
      secret: requireAppSecret(),
      ip: getClientIp(h),
      userAgent: h.get("user-agent"),
    });

    const result = await submitSweepstakesEntry(
      {
        retailer: str(formData, "retailer"),
        retailerOther: str(formData, "retailerOther") || undefined,
        orderNumber: str(formData, "orderNumber"),
        firstName: str(formData, "firstName"),
        lastName: str(formData, "lastName"),
        street: str(formData, "street"),
        houseNumber: str(formData, "houseNumber"),
        postalCode: str(formData, "postalCode"),
        city: str(formData, "city"),
        country: str(formData, "country"),
        email: str(formData, "email"),
        phone: str(formData, "phone"),
        consent: formData.get("consent") === "on",
      },
      {
        submissionIdentifier,
        honeypot: optional(formData, "website"),
        formToken: optional(formData, "formToken"),
        utm: {
          source: optional(formData, "utm_source"),
          medium: optional(formData, "utm_medium"),
          campaign: optional(formData, "utm_campaign"),
          content: optional(formData, "utm_content"),
          term: optional(formData, "utm_term"),
        },
        referrer: optional(formData, "clientReferrer"),
        landingHost: h.get("host"),
      },
    );

    if (!result.ok) {
      return {
        ...EMPTY_SWEEPSTAKES_STATE,
        error: result.error,
        fieldErrors: result.fieldErrors ?? null,
      };
    }
    return { ...EMPTY_SWEEPSTAKES_STATE, ok: true, referenceNumber: result.referenceNumber };
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
        status: z.enum(STATUS_VALUES),
        internalNote: z.string().trim().max(2000, "Die Notiz ist zu lang.").optional(),
      })
      .safeParse({
        id: formData.get("id"),
        status: formData.get("status"),
        internalNote: str(formData, "internalNote") || undefined,
      });
    if (!parsed.success) {
      return { ...EMPTY_USER_STATE, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
    }

    const entry = await prisma.sweepstakesEntry.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, status: true, referenceNumber: true },
    });
    if (!entry) return { ...EMPTY_USER_STATE, error: "Die Teilnahme wurde nicht gefunden." };
    if (entry.status === "DELETED") {
      return { ...EMPTY_USER_STATE, error: "Anonymisierte Teilnahmen können nicht geändert werden." };
    }

    await prisma.sweepstakesEntry.update({
      where: { id: entry.id },
      data: {
        status: parsed.data.status,
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
        status: { from: entry.status, to: parsed.data.status },
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
 * Bestellung). Die verschlüsselte Bestellnummer wird ebenfalls entfernt.
 */
export async function anonymizeSweepstakesEntryAction(formData: FormData): Promise<void> {
  const session = await requireRoleOrThrow("ADMIN");
  const id = z.string().uuid().parse(formData.get("id"));

  const entry = await prisma.sweepstakesEntry.findUnique({
    where: { id },
    select: { id: true, referenceNumber: true, status: true },
  });
  if (!entry) redirect("/admin/gewinnspiel");

  await prisma.sweepstakesEntry.update({
    where: { id: entry.id },
    data: {
      status: "DELETED",
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
    changes: { reference: entry.referenceNumber, previousStatus: entry.status },
  });

  redirect("/admin/gewinnspiel");
}
