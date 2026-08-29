import "server-only";
import { Prisma } from "@prisma/client";
import { improvementPercent, movement } from "@/lib/amazon/rank-math";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Tägliche Zusammenfassung: erster erfolgreicher Lauf ab der konfigurierten
 * Uhrzeit (Standard 08:00 Europe/Berlin), höchstens einmal pro Kalendertag,
 * Zeitzone und Empfänger (Unique-Constraint AmazonDigestRun).
 */

import { calendarDateInTimezone, isDigestTimeReached } from "@/lib/amazon/digest-time";

export { calendarDateInTimezone, isDigestTimeReached };

export interface DigestCategorySummary {
  categoryName: string;
  fromRank: number | null;
  toRank: number | null;
  movement: number | null;
  improvementPercent: number | null;
  bestRank: number | null;
  bestRankAt: string | null;
  worstRank: number | null;
  dataGaps: number;
  staleCount: number;
}

export interface DigestSummary {
  categories: DigestCategorySummary[];
  biggestImprovement: { category: string; movement: number } | null;
  biggestDecline: { category: string; movement: number } | null;
  newCategories: string[];
  leaderboardEntries: string[];
  leaderboardExits: string[];
  clicks24h: number;
  clicksPrevious24h: number;
  dataCompleteness: number | null;
  discrepancyCount: number;
  fallbackRuns: number;
  creditsRemaining: number | null;
}

/** Baut die Kennzahlen der letzten 24 Stunden zusammen. */
export async function buildDigestSummary(
  editionId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<DigestSummary> {
  const snapshots = await prisma.amazonCanonicalRankSnapshot.findMany({
    where: { editionId, observedAt: { gte: periodStart, lte: periodEnd } },
    include: { category: { select: { canonicalName: true } } },
    orderBy: { observedAt: "asc" },
  });

  const byCategory = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const list = byCategory.get(snapshot.categoryId) ?? [];
    list.push(snapshot);
    byCategory.set(snapshot.categoryId, list);
  }

  const categories: DigestCategorySummary[] = [];
  let biggestImprovement: { category: string; movement: number } | null = null;
  let biggestDecline: { category: string; movement: number } | null = null;

  for (const list of byCategory.values()) {
    const name = list[0]!.category.canonicalName;
    const withRank = list.filter((s) => s.canonicalRank !== null);
    const from = withRank[0]?.canonicalRank ?? null;
    const to = withRank[withRank.length - 1]?.canonicalRank ?? null;
    const move = movement(from, to);
    let best: number | null = null;
    let bestAt: Date | null = null;
    let worst: number | null = null;
    for (const s of withRank) {
      const rank = s.canonicalRank as number;
      if (best === null || rank < best) {
        best = rank;
        bestAt = s.observedAt;
      }
      if (worst === null || rank > worst) worst = rank;
    }
    categories.push({
      categoryName: name,
      fromRank: from,
      toRank: to,
      movement: move,
      improvementPercent: improvementPercent(from, to),
      bestRank: best,
      bestRankAt: bestAt?.toISOString() ?? null,
      worstRank: worst,
      dataGaps: list.filter((s) => s.dataGap).length,
      staleCount: list.filter((s) => s.stale).length,
    });
    if (move !== null && move > 0 && (biggestImprovement === null || move > biggestImprovement.movement)) {
      biggestImprovement = { category: name, movement: move };
    }
    if (move !== null && move < 0 && (biggestDecline === null || move < biggestDecline.movement)) {
      biggestDecline = { category: name, movement: move };
    }
  }

  const [newCategories, leaderboardBoundary, clicks24h, clicksPrevious, discrepancyCount, fallbackRuns, providerStatus] =
    await Promise.all([
      prisma.amazonEditionCategory.findMany({
        where: { editionId, firstSeenAt: { gte: periodStart, lte: periodEnd } },
        include: { category: { select: { canonicalName: true } } },
      }),
      loadLeaderboardMovements(periodStart, periodEnd),
      countEditionClicks(editionId, periodStart, periodEnd),
      countEditionClicks(
        editionId,
        new Date(periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime())),
        periodStart,
      ),
      prisma.amazonRankObservation.count({
        where: { editionId, observedAt: { gte: periodStart, lte: periodEnd }, discrepancyFlag: true },
      }),
      prisma.amazonProviderRun.count({
        where: { startedAt: { gte: periodStart, lte: periodEnd }, fallbackFrom: { not: null } },
      }),
      prisma.amazonProviderStatus.findUnique({ where: { provider: "RAINFOREST" } }),
    ]);

  const totalSnapshots = snapshots.length;
  const gapSnapshots = snapshots.filter((s) => s.dataGap).length;
  const quota = providerStatus?.quota as { creditsRemaining?: number } | null;

  return {
    categories,
    biggestImprovement,
    biggestDecline,
    newCategories: newCategories.map((c) => c.category.canonicalName),
    leaderboardEntries: leaderboardBoundary.entries,
    leaderboardExits: leaderboardBoundary.exits,
    clicks24h,
    clicksPrevious24h: clicksPrevious,
    dataCompleteness: totalSnapshots > 0 ? (totalSnapshots - gapSnapshots) / totalSnapshots : null,
    discrepancyCount,
    fallbackRuns,
    creditsRemaining: typeof quota?.creditsRemaining === "number" ? quota.creditsRemaining : null,
  };
}

async function loadLeaderboardMovements(
  periodStart: Date,
  periodEnd: Date,
): Promise<{ entries: string[]; exits: string[] }> {
  const own = await prisma.amazonEdition.findMany({ select: { asin: true } });
  const ownAsins = new Set(own.map((e) => e.asin));
  const categories = await prisma.amazonCategory.findMany({
    where: { leaderboardEnabled: true, active: true },
    select: { id: true, canonicalName: true },
  });
  const entries: string[] = [];
  const exits: string[] = [];
  for (const category of categories) {
    const [firstSnapshot, lastSnapshot] = await Promise.all([
      prisma.amazonLeaderboardSnapshot.findFirst({
        where: { categoryId: category.id, observedAt: { lte: periodStart } },
        orderBy: { observedAt: "desc" },
        include: { entries: { select: { asin: true } } },
      }),
      prisma.amazonLeaderboardSnapshot.findFirst({
        where: { categoryId: category.id, observedAt: { lte: periodEnd } },
        orderBy: { observedAt: "desc" },
        include: { entries: { select: { asin: true } } },
      }),
    ]);
    if (!lastSnapshot || firstSnapshot?.id === lastSnapshot.id) continue;
    const before = new Set((firstSnapshot?.entries ?? []).map((e) => e.asin));
    const after = new Set(lastSnapshot.entries.map((e) => e.asin));
    for (const asin of after) {
      if (!before.has(asin) && ownAsins.has(asin)) {
        entries.push(category.canonicalName);
      }
    }
    for (const asin of before) {
      if (!after.has(asin) && ownAsins.has(asin)) {
        exits.push(category.canonicalName);
      }
    }
  }
  return { entries, exits };
}

async function countEditionClicks(editionId: string, start: Date, end: Date): Promise<number> {
  const edition = await prisma.amazonEdition.findUnique({
    where: { id: editionId },
    select: { trackedShortCode: true, asin: true },
  });
  if (!edition) return 0;
  return prisma.clickEvent.count({
    where: {
      isBot: false,
      ts: { gte: start, lte: end },
      OR: [
        ...(edition.trackedShortCode ? [{ code: edition.trackedShortCode }] : []),
        { shortLink: { destination: { url: { contains: edition.asin } } } },
      ],
    },
  });
}

export interface DigestRunResult {
  status: "sent" | "skipped_already_sent" | "skipped_not_due" | "failed";
  digestId?: string;
}

/** Führt den täglichen Digest aus (idempotent über Unique-Constraint). */
export async function runDailyDigest(options: {
  editionId: string;
  timezone: string;
  digestTime: string;
  recipient: string;
  now?: Date;
}): Promise<DigestRunResult> {
  const now = options.now ?? new Date();
  if (!isDigestTimeReached(now, options.digestTime, options.timezone)) {
    return { status: "skipped_not_due" };
  }
  const calendarDate = calendarDateInTimezone(now, options.timezone);
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let digestId: string;
  try {
    // Unique-Constraint übernimmt die Einmaligkeit pro Tag/Zeitzone/Empfänger
    const digest = await prisma.amazonDigestRun.create({
      data: {
        calendarDate: new Date(`${calendarDate}T00:00:00.000Z`),
        timezone: options.timezone,
        periodStart,
        periodEnd,
        status: "sent",
        channel: "inapp",
        recipient: options.recipient,
      },
    });
    digestId = digest.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "skipped_already_sent" };
    }
    throw error;
  }

  try {
    const summary = await buildDigestSummary(options.editionId, periodStart, periodEnd);
    await prisma.amazonDigestRun.update({
      where: { id: digestId },
      data: {
        summary: summary as unknown as Prisma.InputJsonValue,
        sentAt: new Date(),
        dataCompleteness: summary.dataCompleteness,
      },
    });
    logger.info("amazon.digest_sent", { calendarDate, recipient: options.recipient });
    return { status: "sent", digestId };
  } catch (error) {
    await prisma.amazonDigestRun.update({
      where: { id: digestId },
      data: { status: "failed" },
    });
    logger.error("amazon.digest_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { status: "failed", digestId };
  }
}
