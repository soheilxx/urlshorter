import "server-only";
import { Prisma, type SweepstakesEntryStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isRetailerId } from "@/lib/gewinnspiel-config";
import { hashOrderNumber } from "@/lib/sweepstakes-crypto";
import { normalizeOrderNumber } from "@/lib/sweepstakes-validation";

/**
 * Verwaltungs-Abfragen für den Admin-Bereich „Gewinnspiel“.
 * Filter werden aus den Query-Parametern gebaut; personenbezogene Daten
 * verlassen diese Schicht nur Richtung Admin-UI/CSV (nie in Logs).
 */

export const SWEEPSTAKES_PAGE_SIZE = 25;

export interface SweepstakesFilters {
  q?: string;
  ref?: string;
  order?: string;
  retailer?: string;
  status?: string;
  from?: string;
  to?: string;
  utm?: string;
  page: number;
}

const STATUS_VALUES: SweepstakesEntryStatus[] = [
  "RECEIVED",
  "IN_REVIEW",
  "REVIEWED",
  "INVALID",
  "WINNER",
  "NOT_WON",
  "DELETED",
];

function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00+02:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseSweepstakesFilters(
  params: Record<string, string | string[] | undefined>,
): SweepstakesFilters {
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string).trim() : "");
  const pageRaw = Number.parseInt(str("page") || "1", 10);
  return {
    q: str("q") || undefined,
    ref: str("ref") || undefined,
    order: str("order") || undefined,
    retailer: str("retailer") || undefined,
    status: str("status") || undefined,
    from: str("from") || undefined,
    to: str("to") || undefined,
    utm: str("utm") || undefined,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 10_000) : 1,
  };
}

export function buildSweepstakesWhere(
  filters: SweepstakesFilters,
): Prisma.SweepstakesEntryWhereInput {
  const where: Prisma.SweepstakesEntryWhereInput = {};
  const and: Prisma.SweepstakesEntryWhereInput[] = [];

  if (filters.q) {
    and.push({
      OR: [
        { firstName: { contains: filters.q, mode: "insensitive" } },
        { lastName: { contains: filters.q, mode: "insensitive" } },
        { email: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.ref) {
    and.push({ referenceNumber: { contains: filters.ref.toUpperCase() } });
  }
  if (filters.order) {
    // Exakte Suche über den Hash der normalisierten Bestellnummer
    const normalized = normalizeOrderNumber(filters.order);
    and.push({ orderNumberHash: hashOrderNumber(normalized.value) });
  }
  if (filters.retailer && isRetailerId(filters.retailer)) {
    and.push({ retailer: filters.retailer });
  }
  if (filters.status && (STATUS_VALUES as string[]).includes(filters.status)) {
    and.push({ status: filters.status as SweepstakesEntryStatus });
  }
  const from = parseDay(filters.from);
  if (from) and.push({ createdAt: { gte: from } });
  const to = parseDay(filters.to);
  if (to) and.push({ createdAt: { lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) } });
  if (filters.utm) {
    and.push({
      OR: [
        { utmSource: { contains: filters.utm, mode: "insensitive" } },
        { utmMedium: { contains: filters.utm, mode: "insensitive" } },
        { utmCampaign: { contains: filters.utm, mode: "insensitive" } },
      ],
    });
  }
  if (and.length > 0) where.AND = and;
  return where;
}

export interface SweepstakesStats {
  total: number;
  today: number;
  byRetailer: Array<{ retailer: string; count: number }>;
  byDay: Array<{ day: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  duplicateEmails: Array<{ email: string; count: number }>;
  suspiciousIdentifiers: Array<{ identifier: string; count: number }>;
}

export async function getSweepstakesStats(): Promise<SweepstakesStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, today, retailerGroups, dayRows, sourceGroups, emailGroups, identifierGroups] =
    await Promise.all([
      prisma.sweepstakesEntry.count(),
      prisma.sweepstakesEntry.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.sweepstakesEntry.groupBy({
        by: ["retailer"],
        _count: { _all: true },
        orderBy: { _count: { retailer: "desc" } },
      }),
      prisma.$queryRaw<Array<{ day: string; count: number }>>(Prisma.sql`
        SELECT to_char((se."createdAt" AT TIME ZONE 'Europe/Berlin')::date, 'YYYY-MM-DD') AS day,
               count(*)::int AS count
        FROM "SweepstakesEntry" se
        WHERE se."createdAt" >= now() - interval '14 days'
        GROUP BY 1
        ORDER BY 1 DESC
      `),
      prisma.$queryRaw<Array<{ source: string | null; count: number }>>(Prisma.sql`
        SELECT coalesce(nullif(se."utmSource", ''), nullif(se."utmCampaign", '')) AS source,
               count(*)::int AS count
        FROM "SweepstakesEntry" se
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 8
      `),
      prisma.$queryRaw<Array<{ email: string; count: number }>>(Prisma.sql`
        SELECT se."email" AS email, count(*)::int AS count
        FROM "SweepstakesEntry" se
        WHERE se."email" <> ''
        GROUP BY 1
        HAVING count(*) > 1
        ORDER BY 2 DESC
        LIMIT 8
      `),
      prisma.$queryRaw<Array<{ identifier: string; count: number }>>(Prisma.sql`
        SELECT se."submissionIdentifier" AS identifier, count(*)::int AS count
        FROM "SweepstakesEntry" se
        WHERE se."submissionIdentifier" IS NOT NULL
        GROUP BY 1
        HAVING count(*) >= 3
        ORDER BY 2 DESC
        LIMIT 8
      `),
    ]);

  return {
    total,
    today,
    byRetailer: retailerGroups.map((g) => ({ retailer: g.retailer, count: g._count._all })),
    byDay: dayRows,
    bySource: sourceGroups.map((g) => ({ source: g.source ?? "(direkt)", count: g.count })),
    duplicateEmails: emailGroups,
    suspiciousIdentifiers: identifierGroups.map((g) => ({
      identifier: `${g.identifier.slice(0, 10)}…`,
      count: g.count,
    })),
  };
}
