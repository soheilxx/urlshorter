import type { SweepstakesEntry } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { retailerLabel, SWEEPSTAKES_STATUS_LABELS } from "@/lib/gewinnspiel-config";
import { decryptOrderNumber } from "@/lib/sweepstakes-crypto";
import {
  buildSweepstakesWhere,
  parseSweepstakesFilters,
} from "@/lib/sweepstakes-admin";
import { csvCell } from "@/lib/sweepstakes-validation";
import { todayBerlin } from "@/lib/date-range";
import { formatBerlinDateTime } from "@/lib/utils";

/**
 * CSV-Export der Gewinnspiel-Teilnahmen (nur ADMIN).
 * - Semikolon-getrennt, UTF-8 mit BOM (deutsches Excel)
 * - Schutz vor CSV-Injection (Formel-Präfixe werden neutralisiert)
 * - Batch-weise per Cursor (speicherschonend)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;

const HEADER = [
  "Referenz",
  "Status",
  "Eingegangen",
  "Haendler",
  "Haendler (frei)",
  "Bestellnummer",
  "Vorname",
  "Nachname",
  "Strasse",
  "Hausnummer",
  "PLZ",
  "Ort",
  "Land",
  "E-Mail",
  "Telefon",
  "AGB-Version",
  "AGB akzeptiert am",
  "Datenschutz-Version",
  "Datenschutz bestaetigt am",
  "UTM Source",
  "UTM Medium",
  "UTM Kampagne",
  "Referrer",
  "Interne Notiz",
];

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return new Response("Nicht autorisiert.", { status: 401 });
  }

  const url = new URL(request.url);
  const params: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) params[key] = value;
  const where = buildSweepstakesWhere(parseSweepstakesFilters(params));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`﻿${HEADER.join(";")}\r\n`));
      let cursor: string | null = null;
      for (;;) {
        const batch: SweepstakesEntry[] = await prisma.sweepstakesEntry.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        if (batch.length === 0) break;
        let chunk = "";
        for (const e of batch) {
          const orderNumber =
            e.status === "DELETED" ? "" : (decryptOrderNumber(e.orderNumberEncrypted) ?? "");
          chunk += [
            csvCell(e.referenceNumber),
            csvCell(SWEEPSTAKES_STATUS_LABELS[e.status] ?? e.status),
            csvCell(formatBerlinDateTime(e.createdAt)),
            csvCell(retailerLabel(e.retailer)),
            csvCell(e.retailerOther),
            csvCell(orderNumber),
            csvCell(e.firstName),
            csvCell(e.lastName),
            csvCell(e.street),
            csvCell(e.houseNumber),
            csvCell(e.postalCode),
            csvCell(e.city),
            csvCell(e.country),
            csvCell(e.email),
            csvCell(e.phone),
            csvCell(e.termsVersion),
            csvCell(formatBerlinDateTime(e.acceptedTermsAt)),
            csvCell(e.privacyVersion),
            csvCell(formatBerlinDateTime(e.acknowledgedPrivacyAt)),
            csvCell(e.utmSource),
            csvCell(e.utmMedium),
            csvCell(e.utmCampaign),
            csvCell(e.referrer),
            csvCell(e.internalNote),
          ].join(";");
          chunk += "\r\n";
        }
        controller.enqueue(encoder.encode(chunk));
        cursor = batch[batch.length - 1]?.id ?? null;
        if (batch.length < BATCH_SIZE) break;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gewinnspiel-export-${todayBerlin()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
