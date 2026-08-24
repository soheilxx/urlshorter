"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EMPTY_DESTINATION_STATE, type DestinationActionState } from "@/actions/action-states";
import { writeAuditLog } from "@/lib/audit";
import { requireAdminOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { validateDestinationUrl } from "@/lib/url-validation";

const createSchema = z.object({
  name: z.string().trim().min(1, "Bitte eine interne Bezeichnung angeben.").max(200),
  url: z.string().trim().min(1, "Bitte eine Ziel-URL angeben.").max(2000),
});

export async function createDestinationAction(
  _prev: DestinationActionState,
  formData: FormData,
): Promise<DestinationActionState> {
  try {
    const session = await requireAdminOrThrow();
    const parsed = createSchema.safeParse({
      name: formData.get("name"),
      url: formData.get("url"),
    });
    if (!parsed.success) {
      return {
        ...EMPTY_DESTINATION_STATE,
        error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe.",
      };
    }

    const validation = validateDestinationUrl(parsed.data.url, getEnv().allowedDestinationHosts);
    if (!validation.ok) {
      return { ...EMPTY_DESTINATION_STATE, error: validation.error };
    }

    const destination = await prisma.destination.create({
      data: { name: parsed.data.name, url: validation.url, host: validation.host },
    });

    await writeAuditLog({
      actor: session.email,
      action: "destination.create",
      entityType: "Destination",
      entityId: destination.id,
      changes: { name: destination.name, url: destination.url },
    });

    revalidatePath("/admin/destinations");
    return {
      ...EMPTY_DESTINATION_STATE,
      ok: true,
      success: `Ziel "${destination.name}" wurde angelegt.`,
    };
  } catch (error) {
    return {
      ...EMPTY_DESTINATION_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}

const updateSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1, "Bitte eine interne Bezeichnung angeben.").max(200),
  url: z.string().trim().min(1, "Bitte eine Ziel-URL angeben.").max(2000),
  confirm: z.string().optional(),
});

export async function updateDestinationAction(
  _prev: DestinationActionState,
  formData: FormData,
): Promise<DestinationActionState> {
  try {
    const session = await requireAdminOrThrow();
    const parsed = updateSchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      url: formData.get("url"),
      confirm: formData.get("confirm") ?? undefined,
    });
    if (!parsed.success) {
      return {
        ...EMPTY_DESTINATION_STATE,
        error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe.",
      };
    }

    const existing = await prisma.destination.findUnique({
      where: { id: parsed.data.id },
      include: { _count: { select: { shortLinks: true } } },
    });
    if (!existing) {
      return { ...EMPTY_DESTINATION_STATE, error: "Das Ziel wurde nicht gefunden." };
    }

    const validation = validateDestinationUrl(parsed.data.url, getEnv().allowedDestinationHosts);
    if (!validation.ok) {
      return { ...EMPTY_DESTINATION_STATE, error: validation.error };
    }

    const urlChanged = validation.url !== existing.url;
    const linkCount = existing._count.shortLinks;

    // Ausdrückliche Bestätigung nötig, wenn die URL eines Ziels geändert wird,
    // das bereits von Kurzlinks verwendet wird.
    if (urlChanged && linkCount > 0 && parsed.data.confirm !== "true") {
      return {
        ...EMPTY_DESTINATION_STATE,
        needsConfirm: true,
        linkCount,
        error: `Dieses Ziel wird von ${linkCount} Kurzlink(s) verwendet. Bitte bestätige die Änderung der Ziel-URL ausdrücklich.`,
      };
    }

    const updated = await prisma.destination.update({
      where: { id: existing.id },
      data: { name: parsed.data.name, url: validation.url, host: validation.host },
    });

    await writeAuditLog({
      actor: session.email,
      action: "destination.update",
      entityType: "Destination",
      entityId: updated.id,
      changes: {
        name: { from: existing.name, to: updated.name },
        url: { from: existing.url, to: updated.url },
        affectedLinks: linkCount,
      },
    });

    revalidatePath("/admin/destinations");
    revalidatePath("/admin/links");
    return {
      ...EMPTY_DESTINATION_STATE,
      ok: true,
      success: `Ziel "${updated.name}" wurde aktualisiert.`,
    };
  } catch (error) {
    return {
      ...EMPTY_DESTINATION_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}

export async function toggleDestinationActiveAction(formData: FormData): Promise<void> {
  const session = await requireAdminOrThrow();
  const id = z.string().min(1).max(64).parse(formData.get("id"));
  const active = formData.get("active") === "true";

  const updated = await prisma.destination.update({
    where: { id },
    data: { active },
  });

  await writeAuditLog({
    actor: session.email,
    action: active ? "destination.activate" : "destination.deactivate",
    entityType: "Destination",
    entityId: updated.id,
    changes: { active },
  });

  revalidatePath("/admin/destinations");
  revalidatePath("/admin/links");
}
