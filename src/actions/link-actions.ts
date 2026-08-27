"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EMPTY_LINK_STATE, type LinkActionState } from "@/actions/action-states";
import { writeAuditLog } from "@/lib/audit";
import { requireRoleOrThrow } from "@/lib/auth";
import { berlinDayStartUtc, addDays, DATE_STRING_PATTERN } from "@/lib/date-range";
import { prisma } from "@/lib/db";
import { generateUniqueShortCode } from "@/lib/shortcode";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const linkFieldsSchema = z.object({
  destinationId: z.string().min(1, "Bitte ein Ziel auswählen.").max(64),
  name: z.string().trim().min(1, "Bitte einen internen Linknamen angeben.").max(200),
  source: z.string().trim().min(1, "Bitte eine Source angeben.").max(200),
  medium: optionalText(200),
  campaign: optionalText(200),
  content: optionalText(200),
  note: optionalText(1000),
  expiresAt: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || DATE_STRING_PATTERN.test(v), "Ungültiges Ablaufdatum."),
});

/** Ablauf: Ende des angegebenen Berliner Kalendertags. */
function expiryToDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  return berlinDayStartUtc(addDays(dateStr, 1));
}

async function isCodeTaken(code: string): Promise<boolean> {
  const count = await prisma.shortLink.count({ where: { code } });
  return count > 0;
}

/**
 * Erstellt einen Kurzlink mit kollisionssicherem Zufallscode.
 * Der Unique Constraint der Datenbank ist die letzte Instanz – bei einer
 * Race-Condition (P2002) wird mit neuem Code erneut versucht.
 */
async function createLinkWithUniqueCode(data: {
  destinationId: string;
  name: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  note: string | null;
  expiresAt: Date | null;
}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await generateUniqueShortCode(isCodeTaken);
    try {
      return await prisma.shortLink.create({ data: { ...data, code } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue; // Kollision durch parallele Erstellung – neuer Versuch
      }
      throw error;
    }
  }
  throw new Error("Es konnte kein eindeutiger Kurzcode erzeugt werden. Bitte erneut versuchen.");
}

export async function createShortLinkAction(
  _prev: LinkActionState,
  formData: FormData,
): Promise<LinkActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN", "MARKETER");
    const parsed = linkFieldsSchema.safeParse({
      destinationId: formData.get("destinationId"),
      name: formData.get("name"),
      source: formData.get("source"),
      medium: formData.get("medium") ?? undefined,
      campaign: formData.get("campaign") ?? undefined,
      content: formData.get("content") ?? undefined,
      note: formData.get("note") ?? undefined,
      expiresAt: formData.get("expiresAt") ?? undefined,
    });
    if (!parsed.success) {
      return {
        ...EMPTY_LINK_STATE,
        error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe.",
      };
    }

    const destination = await prisma.destination.findUnique({
      where: { id: parsed.data.destinationId },
    });
    if (!destination) {
      return { ...EMPTY_LINK_STATE, error: "Das ausgewählte Ziel existiert nicht." };
    }

    const link = await createLinkWithUniqueCode({
      destinationId: destination.id,
      name: parsed.data.name,
      source: parsed.data.source,
      medium: parsed.data.medium,
      campaign: parsed.data.campaign,
      content: parsed.data.content,
      note: parsed.data.note,
      expiresAt: expiryToDate(parsed.data.expiresAt),
    });

    await writeAuditLog({
      actor: session.email,
      action: "shortlink.create",
      entityType: "ShortLink",
      entityId: link.id,
      changes: {
        code: link.code,
        name: link.name,
        source: link.source,
        destinationId: destination.id,
      },
    });

    // Kein revalidatePath in useActionState-Actions (Race im Client-Router,
    // siehe README → Fehlerbehebung); das Formular ruft router.refresh() auf.
    return {
      ...EMPTY_LINK_STATE,
      ok: true,
      success: `Kurzlink /${link.code} wurde erstellt.`,
      createdCodes: [link.code],
    };
  } catch (error) {
    return {
      ...EMPTY_LINK_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}

const bulkSchema = z.object({
  destinationId: z.string().min(1, "Bitte ein Ziel auswählen.").max(64),
  namePrefix: z.string().trim().min(1, "Bitte einen Namens-Präfix angeben.").max(150),
  sources: z.string().trim().min(1, "Bitte mindestens eine Source angeben (eine pro Zeile)."),
  medium: optionalText(200),
  campaign: optionalText(200),
  expiresAt: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || DATE_STRING_PATTERN.test(v), "Ungültiges Ablaufdatum."),
});

export async function createBulkLinksAction(
  _prev: LinkActionState,
  formData: FormData,
): Promise<LinkActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN", "MARKETER");
    const parsed = bulkSchema.safeParse({
      destinationId: formData.get("destinationId"),
      namePrefix: formData.get("namePrefix"),
      sources: formData.get("sources"),
      medium: formData.get("medium") ?? undefined,
      campaign: formData.get("campaign") ?? undefined,
      expiresAt: formData.get("expiresAt") ?? undefined,
    });
    if (!parsed.success) {
      return {
        ...EMPTY_LINK_STATE,
        error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe.",
      };
    }

    const sources = Array.from(
      new Set(
        parsed.data.sources
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      ),
    );
    if (sources.length === 0) {
      return { ...EMPTY_LINK_STATE, error: "Bitte mindestens eine Source angeben." };
    }
    if (sources.length > 50) {
      return { ...EMPTY_LINK_STATE, error: "Maximal 50 Sources pro Vorgang." };
    }

    const destination = await prisma.destination.findUnique({
      where: { id: parsed.data.destinationId },
    });
    if (!destination) {
      return { ...EMPTY_LINK_STATE, error: "Das ausgewählte Ziel existiert nicht." };
    }

    const expiresAt = expiryToDate(parsed.data.expiresAt);
    const createdCodes: string[] = [];
    for (const source of sources) {
      const link = await createLinkWithUniqueCode({
        destinationId: destination.id,
        name: `${parsed.data.namePrefix} – ${source}`.slice(0, 200),
        source: source.slice(0, 200),
        medium: parsed.data.medium,
        campaign: parsed.data.campaign,
        content: null,
        note: null,
        expiresAt,
      });
      createdCodes.push(link.code);
    }

    await writeAuditLog({
      actor: session.email,
      action: "shortlink.bulk_create",
      entityType: "ShortLink",
      entityId: null,
      changes: { destinationId: destination.id, codes: createdCodes, sources },
    });

    return {
      ...EMPTY_LINK_STATE,
      ok: true,
      success: `${createdCodes.length} Kurzlinks wurden erstellt: ${createdCodes.map((c) => `/${c}`).join(", ")}`,
      createdCodes,
    };
  } catch (error) {
    return {
      ...EMPTY_LINK_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}

const updateSchema = linkFieldsSchema.extend({
  id: z.string().min(1).max(64),
});

export async function updateShortLinkAction(
  _prev: LinkActionState,
  formData: FormData,
): Promise<LinkActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN", "MARKETER");
    const parsed = updateSchema.safeParse({
      id: formData.get("id"),
      destinationId: formData.get("destinationId"),
      name: formData.get("name"),
      source: formData.get("source"),
      medium: formData.get("medium") ?? undefined,
      campaign: formData.get("campaign") ?? undefined,
      content: formData.get("content") ?? undefined,
      note: formData.get("note") ?? undefined,
      expiresAt: formData.get("expiresAt") ?? undefined,
    });
    if (!parsed.success) {
      return {
        ...EMPTY_LINK_STATE,
        error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe.",
      };
    }

    const existing = await prisma.shortLink.findUnique({ where: { id: parsed.data.id } });
    if (!existing) {
      return { ...EMPTY_LINK_STATE, error: "Der Kurzlink wurde nicht gefunden." };
    }

    const destination = await prisma.destination.findUnique({
      where: { id: parsed.data.destinationId },
    });
    if (!destination) {
      return { ...EMPTY_LINK_STATE, error: "Das ausgewählte Ziel existiert nicht." };
    }

    // Der Kurzcode ist unveränderlich – er wird hier bewusst NIE angefasst.
    const updated = await prisma.shortLink.update({
      where: { id: existing.id },
      data: {
        destinationId: destination.id,
        name: parsed.data.name,
        source: parsed.data.source,
        medium: parsed.data.medium,
        campaign: parsed.data.campaign,
        content: parsed.data.content,
        note: parsed.data.note,
        expiresAt: expiryToDate(parsed.data.expiresAt),
      },
    });

    await writeAuditLog({
      actor: session.email,
      action: "shortlink.update",
      entityType: "ShortLink",
      entityId: updated.id,
      changes: {
        code: updated.code,
        name: { from: existing.name, to: updated.name },
        source: { from: existing.source, to: updated.source },
        destinationId: { from: existing.destinationId, to: updated.destinationId },
      },
    });

    return {
      ...EMPTY_LINK_STATE,
      ok: true,
      success: `Kurzlink /${updated.code} wurde aktualisiert.`,
    };
  } catch (error) {
    return {
      ...EMPTY_LINK_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}

export async function toggleShortLinkActiveAction(formData: FormData): Promise<void> {
  const session = await requireRoleOrThrow("ADMIN", "MARKETER");
  const id = z.string().min(1).max(64).parse(formData.get("id"));
  const active = formData.get("active") === "true";

  const updated = await prisma.shortLink.update({
    where: { id },
    data: { active },
  });

  await writeAuditLog({
    actor: session.email,
    action: active ? "shortlink.activate" : "shortlink.deactivate",
    entityType: "ShortLink",
    entityId: updated.id,
    changes: { code: updated.code, active },
  });

  revalidatePath("/admin/links");
  revalidatePath(`/admin/links/${updated.id}`);
}
