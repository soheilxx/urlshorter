import "server-only";
import {
  CATEGORY_RANK_THRESHOLDS,
  CATEGORY_TYPE_WEBSITE,
  KPI_WINDOWS,
  WEBSITE_RANK_THRESHOLDS,
  type KpiWindowKey,
} from "@/lib/amazon/constants";
import {
  changeOverWindow,
  summarizeSeries,
  thresholdStatus,
  type RankPoint,
  type SeriesSummary,
  type ThresholdStatus,
  type WindowChange,
} from "@/lib/amazon/rank-math";
import { prisma } from "@/lib/db";

/**
 * KPI-Aufbereitung für die UI: lädt kanonische Zeitreihen und berechnet alle
 * Kennzahlen zentral über lib/amazon/rank-math (kleiner Rang = besser).
 */

export interface CanonicalSeriesPoint extends RankPoint {
  stale: boolean;
  dataGap: boolean;
  selectedProvider: string | null;
}

/** Kanonische Zeitreihe einer Kategorie (Datenlücken bleiben als null sichtbar). */
export async function loadCanonicalSeries(
  editionId: string,
  categoryId: string,
  options: { since?: Date; limit?: number } = {},
): Promise<CanonicalSeriesPoint[]> {
  const snapshots = await prisma.amazonCanonicalRankSnapshot.findMany({
    where: {
      editionId,
      categoryId,
      ...(options.since ? { observedAt: { gte: options.since } } : {}),
    },
    orderBy: { observedAt: "asc" },
    take: options.limit ?? 2000,
    select: {
      observedAt: true,
      canonicalRank: true,
      stale: true,
      dataGap: true,
      selectedProvider: true,
    },
  });
  return snapshots.map((s) => ({
    observedAt: s.observedAt,
    rank: s.canonicalRank,
    stale: s.stale,
    dataGap: s.dataGap,
    selectedProvider: s.selectedProvider,
  }));
}

export interface CategoryKpis {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  summary: SeriesSummary;
  windows: Record<KpiWindowKey, WindowChange>;
  thresholds: ThresholdStatus[];
  /** Bester Rang seit Vorbestellstart (falls bekannt). */
  bestSincePreorder: { rank: number; observedAt: Date } | null;
  lastPoint: CanonicalSeriesPoint | null;
  isStale: boolean;
  hasDataGap: boolean;
}

export async function buildCategoryKpis(options: {
  editionId: string;
  categoryId: string;
  categoryName: string;
  categoryType: string;
  expectedIntervalMinutes: number;
  preorderStartAt: Date | null;
  now?: Date;
}): Promise<CategoryKpis> {
  const now = options.now ?? new Date();
  const points = await loadCanonicalSeries(options.editionId, options.categoryId);
  const expectedIntervalMs = options.expectedIntervalMinutes * 60 * 1000;
  const summary = summarizeSeries(points, { now, expectedIntervalMs });

  const windows = {} as Record<KpiWindowKey, WindowChange>;
  for (const window of KPI_WINDOWS) {
    windows[window.key] = changeOverWindow(points, now, window.ms);
  }

  const thresholdValues =
    options.categoryType === CATEGORY_TYPE_WEBSITE
      ? WEBSITE_RANK_THRESHOLDS
      : CATEGORY_RANK_THRESHOLDS;
  const thresholds = thresholdValues.map((t) => thresholdStatus(points, t, expectedIntervalMs));

  let bestSincePreorder: { rank: number; observedAt: Date } | null = null;
  if (options.preorderStartAt) {
    for (const point of points) {
      if (point.rank === null || point.observedAt < options.preorderStartAt) continue;
      if (bestSincePreorder === null || point.rank < bestSincePreorder.rank) {
        bestSincePreorder = { rank: point.rank, observedAt: point.observedAt };
      }
    }
  }

  const lastPoint = points.length > 0 ? points[points.length - 1]! : null;
  const isStale =
    lastPoint !== null &&
    (lastPoint.stale || now.getTime() - lastPoint.observedAt.getTime() > expectedIntervalMs * 2.5);

  return {
    categoryId: options.categoryId,
    categoryName: options.categoryName,
    categoryType: options.categoryType,
    summary,
    windows,
    thresholds,
    bestSincePreorder,
    lastPoint,
    isStale,
    hasDataGap: points.some((p) => p.dataGap),
  };
}
