"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  EMPTY_VOUCHER_IMPORT_STATE,
  EMPTY_VOUCHER_STATE,
  type VoucherActionState,
  type VoucherImportState,
} from "@/actions/action-states";
import { writeAuditLog } from "@/lib/audit";
import { requireRoleOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAppSecret } from "@/lib/env";
import { importVoucherCodes, redeemVoucher } from "@/lib/gutschein";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/request-info";
import { computeRateLimitIdentifier } from "@/lib/visitor-hash";

/**
 * Server Actions der Gutscheinaktion:
 * - Ausstellung (öffentlich, ohne Login) – gibt den Code direkt zurück
 * - Import + Anonymisierung (ausschließlich ADMIN)
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

export async function redeemVoucherAction(
  _prev: VoucherActionState,
  formData: FormData,
): Promise<VoucherActionState> {
  try {
    const h = await headers();
    const submissionIdentifier = computeRateLimitIdentifier({
      secret: requireAppSecret(),
      ip: getClientIp(h),
      userAgent: h.get("user-agent"),
    });

    const result = await redeemVoucher(
      {
        retailer: str(formData, "retailer"),
        retailerOther: str(formData, "retailerOther") || undefined,
        orderNumber: str(formData, "orderNumber"),
        firstName: str(formData, "firstName"),
        lastName: str(formData, "lastName"),
        email: str(formData, "email"),
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
      return { ...EMPTY_VOUCHER_STATE, error: result.error, fieldErrors: result.fieldErrors ?? null };
    }
    return { ...EMPTY_VOUCHER_STATE, ok: true, code: result.code, alreadyIssued: result.alreadyIssued };
  } catch (error) {
    logger.error("voucher.action_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      ...EMPTY_VOUCHER_STATE,
      error:
        "Dein Gutschein konnte gerade nicht ausgestellt werden. Bitte versuche es in einem Moment erneut.",
    };
  }
}

/** Codes importieren: Textfeld (Einfügen) ODER hochgeladene CSV/TXT-Datei. */
export async function importVoucherCodesAction(
  _prev: VoucherImportState,
  formData: FormData,
): Promise<VoucherImportState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");

    let text = str(formData, "codes");
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        return { ...EMPTY_VOUCHER_IMPORT_STATE, error: "Die Datei ist größer als 5 MB." };
      }
      text = `${text}\n${await file.text()}`;
    }
    if (text.trim().length === 0) {
      return {
        ...EMPTY_VOUCHER_IMPORT_STATE,
        error: "Bitte Codes einfügen oder eine CSV-/TXT-Datei auswählen.",
      };
    }
    const batch = z.string().trim().max(120).parse(str(formData, "batch")) || null;

    const result = await importVoucherCodes(text, batch);
    if (result.imported === 0) {
      return {
        ...EMPTY_VOUCHER_IMPORT_STATE,
        error:
          result.duplicates > 0
            ? `Keine neuen Codes – alle ${result.duplicates} Codes sind bereits vorhanden.`
            : "Es wurden keine gültigen Codes gefunden (erwartet: Spalte „code“ oder ein Code pro Zeile).",
      };
    }

    await writeAuditLog({
      actor: session.email,
      action: "voucher.import",
      entityType: "VoucherCode",
      entityId: null,
      changes: { imported: result.imported, duplicates: result.duplicates, invalid: result.invalid, batch },
    });

    const parts = [`${result.imported} Codes importiert`];
    if (result.duplicates > 0) parts.push(`${result.duplicates} bereits vorhanden`);
    if (result.invalid > 0) parts.push(`${result.invalid} ungültige Zeilen übersprungen`);
    return { ...EMPTY_VOUCHER_IMPORT_STATE, ok: true, success: `${parts.join(" · ")}.` };
  } catch (error) {
    return {
      ...EMPTY_VOUCHER_IMPORT_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}

/**
 * Datenschutz-Löschung: personenbezogene Felder leeren; Hashes bleiben, damit
 * dieselbe Bestellung nicht erneut einen Code erhält.
 */
export async function anonymizeVoucherRedemptionAction(formData: FormData): Promise<void> {
  const session = await requireRoleOrThrow("ADMIN");
  const id = z.string().uuid().parse(formData.get("id"));

  const redemption = await prisma.voucherRedemption.findUnique({ where: { id }, select: { id: true } });
  if (!redemption) redirect("/admin/gutscheine");

  await prisma.voucherRedemption.update({
    where: { id },
    data: {
      firstName: "",
      lastName: "",
      email: "",
      retailerOther: null,
      orderNumberEncrypted: "",
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
    action: "voucher.anonymize",
    entityType: "VoucherRedemption",
    entityId: id,
    changes: {},
  });

  redirect("/admin/gutscheine");
}
