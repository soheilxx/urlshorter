import "server-only";
import type { AmazonEdition } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Verknüpfung der Rankingdaten mit der bestehenden Klickerfassung.
 * Es werden ausschließlich AGGREGIERTE Klickzahlen verwendet – keine
 * personenbezogenen Klickdaten dupliziert. Klicks sind keine bestätigten
 * Verkäufe (Pflichthinweis: CLICK_CORRELATION_DISCLAIMER).
 */

export interface EditionClickStats {
  shortLinks: Array<{ id: string; code: string; name: string }>;
  windows: { "1h": number; "6h": number; "24h": number; "7d": number; "30d": number };
  bySource: Array<{ source: string; clicks: number }>;
  byCampaign: Array<{ campaign: string; clicks: number }>;
  byShortLink: Array<{ code: string; name: string; clicks: number }>;
  /** Stündliche Buckets der letzten 7 Tage (UTC-ISO → Klicks). */
  hourly: Array<{ hourIso: string; clicks: number }>;
  /** Stunden mit auffällig vielen Klicks (>= 3× Durchschnitt, min. 5). */
  spikes: Array<{ hourIso: string; clicks: number }>;
}

/**
 * Kurzlinks, die zur Edition gehören: ALLE Links mit Amazon-Ziel
 * (amazon.*, link.amazon, amzn.eu/amzn.to – Betreiber-Vorgabe: jeder
 * Amazon-Link zählt in die Buch-Klickwertung) sowie zusätzlich der
 * hinterlegte Tracking-Code und alle Links mit derselben Ziel-URL.
 */
export async function findEditionShortLinks(
  edition: Pick<AmazonEdition, "asin" | "trackedShortCode">,
): Promise<Array<{ id: string; code: string; name: string }>> {
  const direct = await prisma.shortLink.findMany({
    where: {
      OR: [
        ...(edition.trackedShortCode ? [{ code: edition.trackedShortCode }] : []),
        { destination: { host: { contains: "amazon" } } },
        { destination: { host: { startsWith: "amzn" } } },
      ],
    },
    select: { id: true, code: true, name: true, destination: { select: { url: true } } },
  });

  // Auf alle Links mit identischer Ziel-URL erweitern (auch über mehrere
  // Destination-Einträge mit derselben URL hinweg).
  const targetUrls = [...new Set(direct.map((link) => link.destination.url))];
  const sameTarget =
    targetUrls.length > 0
      ? await prisma.shortLink.findMany({
          where: { destination: { url: { in: targetUrls } } },
          select: { id: true, code: true, name: true },
        })
      : [];

  const byId = new Map<string, { id: string; code: string; name: string }>();
  for (const link of direct) byId.set(link.id, { id: link.id, code: link.code, name: link.name });
  for (const link of sameTarget) byId.set(link.id, link);
  return [...byId.values()];
}

export async function buildEditionClickStats(
  edition: Pick<AmazonEdition, "asin" | "trackedShortCode">,
  now = new Date(),
): Promise<EditionClickStats> {
  const shortLinks = await findEditionShortLinks(edition);
  const linkIds = shortLinks.map((l) => l.id);
  const empty: EditionClickStats = {
    shortLinks,
    windows: { "1h": 0, "6h": 0, "24h": 0, "7d": 0, "30d": 0 },
    bySource: [],
    byCampaign: [],
    byShortLink: [],
    hourly: [],
    spikes: [],
  };
  if (linkIds.length === 0) return empty;

  const windowDefs = [
    { key: "1h" as const, ms: 60 * 60 * 1000 },
    { key: "6h" as const, ms: 6 * 60 * 60 * 1000 },
    { key: "24h" as const, ms: 24 * 60 * 60 * 1000 },
    { key: "7d" as const, ms: 7 * 24 * 60 * 60 * 1000 },
    { key: "30d" as const, ms: 30 * 24 * 60 * 60 * 1000 },
  ];
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [windowCounts, bySource, byCampaign, byLink, hourlyRows] = await Promise.all([
    Promise.all(
      windowDefs.map((w) =>
        prisma.clickEvent.count({
          where: {
            shortLinkId: { in: linkIds },
            isBot: false,
            ts: { gte: new Date(now.getTime() - w.ms) },
          },
        }),
      ),
    ),
    prisma.clickEvent.groupBy({
      by: ["source"],
      _count: { _all: true },
      where: { shortLinkId: { in: linkIds }, isBot: false, ts: { gte: since30d } },
      orderBy: { _count: { source: "desc" } },
      take: 10,
    }),
    prisma.clickEvent.groupBy({
      by: ["campaign"],
      _count: { _all: true },
      where: { shortLinkId: { in: linkIds }, isBot: false, ts: { gte: since30d } },
      orderBy: { _count: { campaign: "desc" } },
      take: 10,
    }),
    prisma.clickEvent.groupBy({
      by: ["code", "linkName"],
      _count: { _all: true },
      where: { shortLinkId: { in: linkIds }, isBot: false, ts: { gte: since30d } },
      orderBy: { _count: { code: "desc" } },
      take: 10,
    }),
    prisma.$queryRaw<Array<{ hour: Date; count: number }>>`
      SELECT date_trunc('hour', ce."ts") AS hour, count(*)::int AS count
      FROM "ClickEvent" ce
      WHERE ce."shortLinkId" = ANY(${linkIds}) AND ce."isBot" = false AND ce."ts" >= ${since7d}
      GROUP BY 1 ORDER BY 1
    `,
  ]);

  const hourly = hourlyRows.map((row) => ({
    hourIso: row.hour.toISOString(),
    clicks: row.count,
  }));
  const average =
    hourly.length > 0 ? hourly.reduce((s, h) => s + h.clicks, 0) / hourly.length : 0;
  const spikes = hourly.filter((h) => h.clicks >= Math.max(5, average * 3));

  return {
    shortLinks,
    windows: {
      "1h": windowCounts[0] ?? 0,
      "6h": windowCounts[1] ?? 0,
      "24h": windowCounts[2] ?? 0,
      "7d": windowCounts[3] ?? 0,
      "30d": windowCounts[4] ?? 0,
    },
    bySource: bySource.map((row) => ({ source: row.source, clicks: row._count._all })),
    byCampaign: byCampaign
      .filter((row) => row.campaign !== null)
      .map((row) => ({ campaign: row.campaign as string, clicks: row._count._all })),
    byShortLink: byLink.map((row) => ({
      code: row.code,
      name: row.linkName,
      clicks: row._count._all,
    })),
    hourly,
    spikes,
  };
}

/**
 * Zeitversetzte Korrelation (Pearson) zwischen stündlichen Klicks und der
 * Rangbewegung. Nur berechnet, wenn genug gepaarte Datenpunkte existieren –
 * Ergebnis ist eine KORRELATION, keine Kausalität/Conversion.
 */
export function lagCorrelation(
  clicksByHour: Map<string, number>,
  movementByHour: Map<string, number>,
  lagHours: number,
): { r: number; sampleSize: number } | null {
  const pairs: Array<[number, number]> = [];
  for (const [hourIso, clicks] of clicksByHour) {
    const target = new Date(new Date(hourIso).getTime() + lagHours * 60 * 60 * 1000).toISOString();
    const move = movementByHour.get(target);
    if (move !== undefined) pairs.push([clicks, move]);
  }
  if (pairs.length < 24) return null;
  const n = pairs.length;
  const meanX = pairs.reduce((s, [x]) => s + x, 0) / n;
  const meanY = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (const [x, y] of pairs) {
    cov += (x - meanX) * (y - meanY);
    varX += (x - meanX) ** 2;
    varY += (y - meanY) ** 2;
  }
  if (varX === 0 || varY === 0) return null;
  return { r: cov / Math.sqrt(varX * varY), sampleSize: n };
}
