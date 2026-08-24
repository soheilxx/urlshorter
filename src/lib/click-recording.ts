import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Persistiert einen Click-Event. Fehler werden protokolliert, aber nicht
 * weitergeworfen – ein Datenbankfehler darf die Weiterleitung eines echten
 * Besuchers zu Amazon niemals verhindern (bewusste Design-Entscheidung,
 * siehe README "Fehlerbehandlung").
 */
export async function recordClickEvent(data: Prisma.ClickEventUncheckedCreateInput): Promise<void> {
  try {
    await prisma.clickEvent.create({ data });
  } catch (error) {
    logger.error("click.persist_failed", {
      eventId: data.id,
      code: data.code,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
