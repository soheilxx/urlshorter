import "server-only";
import type { ClickEvent } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildClickWhere, type ClickFilters } from "@/lib/click-filters";
import { formatBerlinDate, formatBerlinTime } from "@/lib/utils";

/**
 * Speicherschonender CSV-Export: Die Daten werden in Batches per Cursor
 * gelesen und gestreamt – die Gesamttabelle wird nie in den Speicher geladen.
 * Trennzeichen ist Semikolon (deutsches Excel), Encoding UTF-8 mit BOM.
 */

const BATCH_SIZE = 1000;

const CSV_HEADER = [
  "Datum",
  "Uhrzeit",
  "Kurzcode",
  "Linkname",
  "Source",
  "Medium",
  "Kampagne",
  "Content",
  "Referrer",
  "UTM Source",
  "UTM Medium",
  "UTM Kampagne",
  "UTM Content",
  "UTM Term",
  "Geraet",
  "Browser",
  "Betriebssystem",
  "Land",
  "Region",
  "Stadt",
  "Bot",
  "Bot-Grund",
  "Consent",
  "Bridge geladen",
  "Tracking angestossen",
  "Redirect gestartet",
  "Manueller Klick",
  "Event-ID",
];

function csvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[";\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function boolField(value: boolean): string {
  return value ? "ja" : "nein";
}

function rowToCsv(event: ClickEvent): string {
  return [
    formatBerlinDate(event.ts),
    formatBerlinTime(event.ts),
    csvField(event.code),
    csvField(event.linkName),
    csvField(event.source),
    csvField(event.medium),
    csvField(event.campaign),
    csvField(event.content),
    csvField(event.referrer),
    csvField(event.utmSource),
    csvField(event.utmMedium),
    csvField(event.utmCampaign),
    csvField(event.utmContent),
    csvField(event.utmTerm),
    csvField(event.deviceType),
    csvField(event.browser),
    csvField(event.os),
    csvField(event.country),
    csvField(event.region),
    csvField(event.city),
    boolField(event.isBot),
    csvField(event.botReason),
    boolField(event.consent),
    boolField(event.bridgeLoaded),
    boolField(event.trackingFired),
    boolField(event.redirectStarted),
    boolField(event.manualClick),
    csvField(event.id),
  ].join(";");
}

/** Erzeugt einen ReadableStream mit den gefilterten Klickdaten als CSV. */
export function streamClicksCsv(filters: ClickFilters): ReadableStream<Uint8Array> {
  const where = buildClickWhere(filters);
  const encoder = new TextEncoder();
  let cursor: { ts: Date; id: string } | null = null;
  let headerSent = false;
  let done = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (done) return;
      if (!headerSent) {
        controller.enqueue(encoder.encode("\uFEFF" + CSV_HEADER.join(";") + "\r\n"));
        headerSent = true;
      }

      const batch: ClickEvent[] = await prisma.clickEvent.findMany({
        where: cursor
          ? {
              AND: [
                where,
                {
                  OR: [{ ts: { lt: cursor.ts } }, { ts: cursor.ts, id: { lt: cursor.id } }],
                },
              ],
            }
          : where,
        orderBy: [{ ts: "desc" }, { id: "desc" }],
        take: BATCH_SIZE,
      });

      if (batch.length === 0) {
        done = true;
        controller.close();
        return;
      }

      const chunk = batch.map(rowToCsv).join("\r\n") + "\r\n";
      controller.enqueue(encoder.encode(chunk));

      const last = batch[batch.length - 1];
      if (last) cursor = { ts: last.ts, id: last.id };
      if (batch.length < BATCH_SIZE) {
        done = true;
        controller.close();
      }
    },
  });
}
