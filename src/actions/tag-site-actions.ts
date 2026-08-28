"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { EMPTY_USER_STATE, type UserActionState } from "@/actions/action-states";
import { writeAuditLog } from "@/lib/audit";
import { requireRoleOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/secrets";
import { parseDomainList } from "@/lib/tag-config";

/**
 * Verwaltung der TRACK.SITE-Websites (nur ADMIN).
 * Conversion-API-Tokens werden verschlüsselt gespeichert; leere Token-Felder
 * lassen den gespeicherten Wert unverändert. Tokens erscheinen niemals in
 * Audit-Logs oder Fehlermeldungen.
 */

const DOMAIN_PATTERN = /^(localhost|127\.0\.0\.1|[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+)$/;

const siteSchema = z.object({
  id: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,50}$/, "Site-ID: 2–50 Zeichen, nur a-z, 0-9 und Bindestrich."),
  label: z.string().trim().min(1, "Bitte einen Namen angeben.").max(100),
  domains: z.string().trim().min(1, "Bitte mindestens eine Domain angeben."),
  active: z.boolean(),
  ga4MeasurementId: z.string().trim().max(40).optional(),
  gtmContainerId: z.string().trim().max(40).optional(),
  metaPixelId: z.string().trim().max(40).optional(),
  metaCapiToken: z.string().trim().max(500).optional(),
  tiktokPixelId: z.string().trim().max(40).optional(),
  tiktokToken: z.string().trim().max(500).optional(),
  redditPixelId: z.string().trim().max(40).optional(),
  linkedinPartnerId: z.string().trim().max(40).optional(),
});

function str(formData: FormData, name: string): string | undefined {
  const v = formData.get(name);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function orNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

export async function saveTagSiteAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const parsed = siteSchema.safeParse({
      id: formData.get("id"),
      label: formData.get("label"),
      domains: formData.get("domains"),
      active: formData.get("active") === "on" || formData.get("active") === "true",
      ga4MeasurementId: str(formData, "ga4MeasurementId"),
      gtmContainerId: str(formData, "gtmContainerId"),
      metaPixelId: str(formData, "metaPixelId"),
      metaCapiToken: str(formData, "metaCapiToken"),
      tiktokPixelId: str(formData, "tiktokPixelId"),
      tiktokToken: str(formData, "tiktokToken"),
      redditPixelId: str(formData, "redditPixelId"),
      linkedinPartnerId: str(formData, "linkedinPartnerId"),
    });
    if (!parsed.success) {
      return { ...EMPTY_USER_STATE, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
    }
    const input = parsed.data;

    const domains = parseDomainList(input.domains);
    if (domains.length === 0 || !domains.every((d) => DOMAIN_PATTERN.test(d))) {
      return {
        ...EMPTY_USER_STATE,
        error: "Bitte gültige Domains angeben (komma-separiert, z. B. beispiel.de, shop.beispiel.de).",
      };
    }

    const existing = await prisma.tagSiteConfig.findUnique({ where: { id: input.id } });

    const data = {
      label: input.label,
      domains: domains.join(", "),
      active: input.active,
      ga4MeasurementId: orNull(input.ga4MeasurementId),
      gtmContainerId: orNull(input.gtmContainerId),
      metaPixelId: orNull(input.metaPixelId),
      tiktokPixelId: orNull(input.tiktokPixelId),
      redditPixelId: orNull(input.redditPixelId),
      linkedinPartnerId: orNull(input.linkedinPartnerId),
      // Tokens: leer = unverändert lassen
      ...(input.metaCapiToken ? { metaCapiTokenEncrypted: encryptSecret(input.metaCapiToken) } : {}),
      ...(input.tiktokToken ? { tiktokTokenEncrypted: encryptSecret(input.tiktokToken) } : {}),
    };

    await prisma.tagSiteConfig.upsert({
      where: { id: input.id },
      create: { id: input.id, ...data },
      update: data,
    });

    await writeAuditLog({
      actor: session.email,
      action: existing ? "tagsite.update" : "tagsite.create",
      entityType: "TagSiteConfig",
      entityId: input.id,
      changes: {
        label: input.label,
        domains,
        active: input.active,
        metaTokenChanged: Boolean(input.metaCapiToken),
        tiktokTokenChanged: Boolean(input.tiktokToken),
      },
    });

    return {
      ...EMPTY_USER_STATE,
      ok: true,
      success: existing
        ? `Website „${input.label}“ wurde aktualisiert.`
        : `Website „${input.label}“ wurde angelegt.`,
    };
  } catch (error) {
    return {
      ...EMPTY_USER_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}

export async function deleteTagSiteAction(formData: FormData): Promise<void> {
  const session = await requireRoleOrThrow("ADMIN");
  const id = z
    .string()
    .regex(/^[a-z0-9-]{2,50}$/)
    .parse(formData.get("id"));

  const existing = await prisma.tagSiteConfig.findUnique({ where: { id } });
  if (!existing) redirect("/admin/websites");

  await prisma.tagSiteConfig.delete({ where: { id } });

  await writeAuditLog({
    actor: session.email,
    action: "tagsite.delete",
    entityType: "TagSiteConfig",
    entityId: id,
    changes: { label: existing.label },
  });

  redirect("/admin/websites");
}
