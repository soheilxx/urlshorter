import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Audit-Log für Admin-Aktionen. Fehler beim Schreiben des Logs dürfen die
 * eigentliche Aktion nicht scheitern lassen, werden aber protokolliert.
 */
export async function writeAuditLog(entry: {
  actor: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        changes: (entry.changes ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    logger.error("audit.write_failed", {
      action: entry.action,
      entityType: entry.entityType,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
