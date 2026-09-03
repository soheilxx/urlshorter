import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { todayBerlin } from "@/lib/date-range";
import { prisma } from "@/lib/db";
import { retailerLabel } from "@/lib/gewinnspiel-config";
import { decryptOrderNumber } from "@/lib/sweepstakes-crypto";
import { csvCell } from "@/lib/sweepstakes-validation";
import { formatBerlinDateTime } from "@/lib/utils";

/**
 * CSV-Export der ausgestellten Gutscheine (nur ADMIN).
 * Semikolon-getrennt, UTF-8 mit BOM, CSV-Injection-sicher, batch-weise.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;
const HEADER = [
  "Ausgestellt am",
  "Gutscheincode",
  "Vorname",
  "Nachname",
  "E-Mail",
  "Haendler",
  "Haendler (frei)",
  "Bestellnummer",
  "Bedingungen-Version",
  "UTM Source",
  "UTM Medium",
  "UTM Kampagne",
  "Referrer",
];

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return new Response("Nicht autorisiert.", { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`﻿${HEADER.join(";")}\r\n`));
      let cursor: string | null = null;
      for (;;) {
        const batch: Prisma.VoucherRedemptionGetPayload<{
          include: { voucherCode: { select: { code: true } } };
        }>[] = await prisma.voucherRedemption.findMany({
          include: { voucherCode: { select: { code: true } } },
          orderBy: { createdAt: "desc" },
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        if (batch.length === 0) break;
        let chunk = "";
        for (const r of batch) {
          chunk += [
            csvCell(formatBerlinDateTime(r.createdAt)),
            csvCell(r.voucherCode.code),
            csvCell(r.firstName),
            csvCell(r.lastName),
            csvCell(r.email),
            csvCell(retailerLabel(r.retailer)),
            csvCell(r.retailerOther),
            csvCell(r.orderNumberEncrypted ? (decryptOrderNumber(r.orderNumberEncrypted) ?? "") : ""),
            csvCell(r.termsVersion),
            csvCell(r.utmSource),
            csvCell(r.utmMedium),
            csvCell(r.utmCampaign),
            csvCell(r.referrer),
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
      "Content-Disposition": `attachment; filename="gutscheine-export-${todayBerlin()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
