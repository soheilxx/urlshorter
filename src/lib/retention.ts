import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Datenaufbewahrung:
 * 1. Detaillierte ClickEvents, die älter als EVENT_RETENTION_DAYS sind,
 *    werden zunächst tagesweise (Europe/Berlin) in DailyAggregate verdichtet.
 * 2. Anschließend werden die alten Events gelöscht.
 * 3. LoginAttempts älter als 7 Tage werden ebenfalls entfernt.
 *
 * Die Grenze liegt immer auf einer Berliner Tagesgrenze, sodass ein Tag nie
 * teilweise aggregiert wird. Die Aggregation ist additiv und damit auch bei
 * wiederholten Läufen korrekt.
 */
export async function runRetentionCleanup(retentionDays: number): Promise<{
  aggregatedRows: number;
  deletedClickEvents: number;
  deletedLoginAttempts: number;
}> {
  const days = Math.max(1, Math.floor(retentionDays));

  const [aggregatedRows, deletedClickEvents, deletedLoginAttempts] = await prisma.$transaction(
    async (tx) => {
      // Tagesaggregate für alle zu löschenden Events erzeugen/erhöhen.
      const aggregated = await tx.$executeRaw(Prisma.sql`
        INSERT INTO "DailyAggregate"
          ("id", "date", "shortLinkId", "code", "source", "campaign",
           "humanClicks", "botClicks", "uniqueVisitors", "createdAt")
        SELECT
          gen_random_uuid()::text,
          (ce."ts" AT TIME ZONE 'Europe/Berlin')::date,
          ce."shortLinkId",
          max(ce."code"),
          max(ce."source"),
          max(ce."campaign"),
          count(*) FILTER (WHERE NOT ce."isBot")::int,
          count(*) FILTER (WHERE ce."isBot")::int,
          count(DISTINCT ce."visitorHash") FILTER (WHERE NOT ce."isBot")::int,
          now()
        FROM "ClickEvent" ce
        WHERE ce."ts" < (
          (date_trunc('day', now() AT TIME ZONE 'Europe/Berlin')
            - make_interval(days => ${days}::int)) AT TIME ZONE 'Europe/Berlin'
        )
        GROUP BY 2, 3
        ON CONFLICT ("date", "shortLinkId") DO UPDATE SET
          "humanClicks"    = "DailyAggregate"."humanClicks" + EXCLUDED."humanClicks",
          "botClicks"      = "DailyAggregate"."botClicks" + EXCLUDED."botClicks",
          "uniqueVisitors" = "DailyAggregate"."uniqueVisitors" + EXCLUDED."uniqueVisitors"
      `);

      const deletedEvents = await tx.$executeRaw(Prisma.sql`
        DELETE FROM "ClickEvent"
        WHERE "ts" < (
          (date_trunc('day', now() AT TIME ZONE 'Europe/Berlin')
            - make_interval(days => ${days}::int)) AT TIME ZONE 'Europe/Berlin'
        )
      `);

      const deletedAttempts = await tx.loginAttempt.deleteMany({
        where: { ts: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      });

      return [aggregated, deletedEvents, deletedAttempts.count];
    },
  );

  logger.info("retention.cleanup_done", {
    retentionDays: days,
    aggregatedRows,
    deletedClickEvents,
    deletedLoginAttempts,
  });

  return { aggregatedRows, deletedClickEvents, deletedLoginAttempts };
}
