import { getSession } from "@/lib/auth";
import { formatBerlinDateTime } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { todayBerlin } from "@/lib/date-range";

/**
 * Export der Amazon-Rankingdaten (CSV oder JSON) für angemeldete Benutzer.
 *
 *   ?type=ranks       – kanonische Rang-Snapshots (Standard)
 *   ?type=observations– Provider-Beobachtungen (beide Provider getrennt)
 *   ?type=leaderboard – Einträge eines Leaderboard-Snapshots (&snapshotId=…)
 *   ?format=csv|json  – Standard csv
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 20_000;

function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[";\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(header: string[], rows: Array<Array<string | number | null>>): string {
  // UTF-8 BOM für deutsches Excel
  return (
    "﻿" +
    header.join(";") +
    "\r\n" +
    rows.map((row) => row.map(csvField).join(";")).join("\r\n") +
    "\r\n"
  );
}

function respond(
  format: string,
  baseName: string,
  header: string[],
  rows: Array<Array<string | number | null>>,
  jsonRows: unknown[],
): Response {
  if (format === "json") {
    return Response.json(
      { exportedAt: new Date().toISOString(), rows: jsonRows },
      {
        headers: {
          "Content-Disposition": `attachment; filename="${baseName}-${todayBerlin()}.json"`,
          "Cache-Control": "no-store",
        },
      },
    );
  }
  return new Response(toCsv(header, rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}-${todayBerlin()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Nicht autorisiert.", { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "ranks";
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";

  if (type === "leaderboard") {
    const snapshotId = url.searchParams.get("snapshotId");
    if (!snapshotId || !/^[a-z0-9]+$/i.test(snapshotId)) {
      return new Response("snapshotId fehlt oder ist ungültig.", { status: 400 });
    }
    const entries = await prisma.amazonLeaderboardEntry.findMany({
      where: { snapshotId },
      orderBy: { position: "asc" },
      include: { snapshot: { include: { category: { select: { canonicalName: true } } } } },
    });
    return respond(
      format,
      "amazon-top25",
      ["Kategorie", "Snapshot", "Position", "Rang", "ASIN", "Titel", "Autor", "Preis", "Waehrung", "Bewertung", "Bewertungen"],
      entries.map((e) => [
        e.snapshot.category.canonicalName,
        formatBerlinDateTime(e.snapshot.observedAt),
        e.position,
        e.bestsellerRank,
        e.asin,
        e.titleSnapshot,
        e.authorSnapshot,
        e.priceSnapshot !== null ? Number(e.priceSnapshot) : null,
        e.currencySnapshot,
        e.ratingSnapshot,
        e.reviewCountSnapshot,
      ]),
      entries.map((e) => ({
        category: e.snapshot.category.canonicalName,
        observedAt: e.snapshot.observedAt.toISOString(),
        position: e.position,
        bestsellerRank: e.bestsellerRank,
        asin: e.asin,
        title: e.titleSnapshot,
        author: e.authorSnapshot,
        price: e.priceSnapshot !== null ? Number(e.priceSnapshot) : null,
        currency: e.currencySnapshot,
        rating: e.ratingSnapshot,
        reviewCount: e.reviewCountSnapshot,
      })),
    );
  }

  if (type === "observations") {
    const observations = await prisma.amazonRankObservation.findMany({
      orderBy: { observedAt: "desc" },
      take: MAX_ROWS,
      include: {
        category: { select: { canonicalName: true } },
        edition: { select: { asin: true } },
      },
    });
    return respond(
      format,
      "amazon-beobachtungen",
      ["Zeitpunkt (Berlin)", "ASIN", "Kategorie", "Rang", "Provider", "Status", "Kanonisch", "Abweichung", "Abgerufen"],
      observations.map((o) => [
        formatBerlinDateTime(o.observedAt),
        o.edition.asin,
        o.category.canonicalName,
        o.rank,
        o.provider,
        o.sourceStatus,
        o.canonical ? "ja" : "nein",
        o.providerDifference,
        formatBerlinDateTime(o.fetchedAt),
      ]),
      observations.map((o) => ({
        observedAt: o.observedAt.toISOString(),
        asin: o.edition.asin,
        category: o.category.canonicalName,
        rank: o.rank,
        provider: o.provider,
        sourceStatus: o.sourceStatus,
        canonical: o.canonical,
        providerDifference: o.providerDifference,
        fetchedAt: o.fetchedAt.toISOString(),
      })),
    );
  }

  const snapshots = await prisma.amazonCanonicalRankSnapshot.findMany({
    orderBy: { observedAt: "desc" },
    take: MAX_ROWS,
    include: {
      category: { select: { canonicalName: true } },
      edition: { select: { asin: true } },
    },
  });
  return respond(
    format,
    "amazon-rankings",
    ["Zeitpunkt (Berlin)", "ASIN", "Kategorie", "Kanonischer Rang", "Provider", "Auswahlgrund", "Stale", "Datenluecke"],
    snapshots.map((s) => [
      formatBerlinDateTime(s.observedAt),
      s.edition.asin,
      s.category.canonicalName,
      s.canonicalRank,
      s.selectedProvider,
      s.selectionReason,
      s.stale ? "ja" : "nein",
      s.dataGap ? "ja" : "nein",
    ]),
    snapshots.map((s) => ({
      observedAt: s.observedAt.toISOString(),
      asin: s.edition.asin,
      category: s.category.canonicalName,
      canonicalRank: s.canonicalRank,
      selectedProvider: s.selectedProvider,
      selectionReason: s.selectionReason,
      stale: s.stale,
      dataGap: s.dataGap,
    })),
  );
}
