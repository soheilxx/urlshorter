import "server-only";
import { createHash } from "node:crypto";
import type {
  AmazonCategory,
  AmazonEdition,
  AmazonProviderKind,
  AmazonRunStatus,
  AmazonSourceStatus,
  Prisma,
} from "@prisma/client";
import { selectCanonical } from "@/lib/amazon/canonical";
import {
  CATEGORY_TYPE_BESTSELLERS,
  CATEGORY_TYPE_BROWSE_NODE,
  CATEGORY_TYPE_WEBSITE,
} from "@/lib/amazon/constants";
import type {
  NormalizedCategoryRank,
  NormalizedLeaderboard,
  NormalizedProductMetadata,
  NormalizedProductRanks,
  ProviderQuotaStatus,
} from "@/lib/amazon/provider-types";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Datenhaltung des Amazon-Ranking-Moduls: idempotente Upserts, getrennte
 * Provider-Beobachtungen, kanonische Snapshots, Leaderboards, Provider-Status.
 * Externe Antworten sind zu diesem Zeitpunkt bereits abgerufen und validiert –
 * hier laufen nur noch kurze DB-Operationen.
 */

// ---------------------------------------------------------------------------
// Bootstrap: eigenes Buch + Pflichtkategorien (idempotent)
// ---------------------------------------------------------------------------

export const PRIMARY_BOOK = {
  title: "Die Lizenz zum Erfolg",
  author: "Soheil Hosseini",
  publisher: "Deutscher Wirtschaftsbuch Verlag",
  language: "Deutsch",
  format: "Taschenbuch",
  isbn10: "3690662508",
  isbn13: "9783690662505",
  publicationDate: new Date("2026-10-06"),
  trackedShortCode: "wulp",
} as const;

/** Pflichtkategorien (Sachbücher zwingend als Top-25-Kategorie). */
const REQUIRED_CATEGORIES: Array<{
  name: string;
  type: string;
  required: boolean;
  leaderboard: boolean;
}> = [
  { name: "Bücher", type: CATEGORY_TYPE_WEBSITE, required: true, leaderboard: true },
  { name: "Sachbücher", type: CATEGORY_TYPE_BROWSE_NODE, required: true, leaderboard: true },
  { name: "Präsentationen", type: CATEGORY_TYPE_BROWSE_NODE, required: false, leaderboard: true },
  {
    name: "E-Business (Bücher)",
    type: CATEGORY_TYPE_BROWSE_NODE,
    required: false,
    leaderboard: true,
  },
  {
    name: "Biografien von Geschäftsleuten",
    type: CATEGORY_TYPE_BROWSE_NODE,
    required: false,
    leaderboard: true,
  },
  // Amazon.de führt KEINE eigenständige "Sachbücher"-Bestsellerliste
  // (per Categories API verifiziert). Als nächstliegende Sachbuch-Listen
  // werden die beiden Ober-Kategorien beobachtet, in denen das Buch rankt
  // (Entscheidung Betreiber, 2026-08-29). Auflösung dynamisch über die
  // Rainforest-Hierarchie (Namens-Aliasse EN↔DE in lib/amazon/jobs.ts).
  {
    name: "Business & Karriere",
    type: CATEGORY_TYPE_BESTSELLERS,
    required: false,
    leaderboard: true,
  },
  {
    name: "Biografien & Erinnerungen",
    type: CATEGORY_TYPE_BESTSELLERS,
    required: false,
    leaderboard: true,
  },
];

export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Legt Buch, Edition und Pflichtkategorien an (idempotent, überschreibt nichts). */
export async function ensurePrimaryBook(): Promise<{ bookId: string; editionId: string }> {
  const env = getEnv();
  const marketplace = env.AMAZON_CREATORS_MARKETPLACE;
  const asin = env.AMAZON_PRIMARY_BOOK_ASIN;

  let edition = await prisma.amazonEdition.findUnique({
    where: { marketplace_asin: { marketplace, asin } },
  });
  let bookId: string;
  if (!edition) {
    const book = await prisma.amazonBook.create({
      data: {
        title: PRIMARY_BOOK.title,
        author: PRIMARY_BOOK.author,
        publisher: PRIMARY_BOOK.publisher,
        language: PRIMARY_BOOK.language,
      },
    });
    edition = await prisma.amazonEdition.create({
      data: {
        bookId: book.id,
        marketplace,
        asin,
        isbn10: PRIMARY_BOOK.isbn10,
        isbn13: env.AMAZON_PRIMARY_BOOK_ISBN13,
        format: PRIMARY_BOOK.format,
        publicationDate: PRIMARY_BOOK.publicationDate,
        preorder: true,
        preorderStartAt: new Date(),
        productUrl: `https://${marketplace}/dp/${asin}`,
        affiliateUrl: env.AMAZON_CREATORS_PARTNER_TAG
          ? `https://${marketplace}/dp/${asin}?tag=${env.AMAZON_CREATORS_PARTNER_TAG}`
          : null,
        trackedShortCode: PRIMARY_BOOK.trackedShortCode,
      },
    });
    await prisma.amazonBook.update({
      where: { id: book.id },
      data: { primaryEditionId: edition.id },
    });
    bookId = book.id;
    logger.info("amazon.primary_book_created", { editionId: edition.id });
  } else {
    bookId = edition.bookId;
  }

  for (const category of REQUIRED_CATEGORIES) {
    const normalized = normalizeCategoryName(category.name);
    const existing = await prisma.amazonCategory.findFirst({
      where: { marketplace, normalizedName: normalized, categoryType: category.type },
    });
    if (!existing) {
      await prisma.amazonCategory.create({
        data: {
          marketplace,
          canonicalName: category.name,
          normalizedName: normalized,
          categoryType: category.type,
          required: category.required,
          leaderboardEnabled: category.leaderboard,
          isRoot: category.type === CATEGORY_TYPE_WEBSITE,
        },
      });
    }
  }

  return { bookId, editionId: edition.id };
}

// ---------------------------------------------------------------------------
// Kategorie-Auflösung für Provider-Ränge (inkl. Auto-Discovery)
// ---------------------------------------------------------------------------

async function resolveCategoryForRank(
  marketplace: string,
  provider: AmazonProviderKind,
  categoryRank: NormalizedCategoryRank,
  autoFollow: boolean,
): Promise<{ category: AmazonCategory; discovered: boolean } | null> {
  const mapping = await prisma.amazonCategoryProviderMapping.findFirst({
    where: { provider, providerCategoryId: categoryRank.providerCategoryId },
    include: { category: true },
  });
  if (mapping) {
    // Bestseller-URL nachtragen, falls sie jetzt bekannt ist (URL-Fallback)
    if (!mapping.providerCategoryUrl && categoryRank.bestsellerUrl) {
      await prisma.amazonCategoryProviderMapping.update({
        where: { id: mapping.id },
        data: { providerCategoryUrl: categoryRank.bestsellerUrl },
      });
    }
    return { category: mapping.category, discovered: false };
  }

  const normalized = normalizeCategoryName(categoryRank.categoryName);
  // Exakter Name zuerst; sonst Klammerzusatz-Variante ("E-Business" passt zu
  // "E-Business (Bücher)"), damit keine Duplikate zu den Pflichtkategorien
  // entstehen.
  const byName =
    (await prisma.amazonCategory.findFirst({
      where: {
        marketplace,
        normalizedName: normalized,
        categoryType: { in: [CATEGORY_TYPE_BROWSE_NODE, CATEGORY_TYPE_BESTSELLERS] },
      },
    })) ??
    (await prisma.amazonCategory.findFirst({
      where: {
        marketplace,
        normalizedName: { startsWith: `${normalized} (` },
        categoryType: { in: [CATEGORY_TYPE_BROWSE_NODE, CATEGORY_TYPE_BESTSELLERS] },
      },
    }));
  if (byName) {
    await prisma.amazonCategoryProviderMapping.upsert({
      where: {
        categoryId_provider_providerCategoryId: {
          categoryId: byName.id,
          provider,
          providerCategoryId: categoryRank.providerCategoryId,
        },
      },
      update: {
        providerCategoryName: categoryRank.categoryName,
        providerCategoryPath: categoryRank.categoryPath,
        ...(categoryRank.bestsellerUrl
          ? { providerCategoryUrl: categoryRank.bestsellerUrl }
          : {}),
      },
      create: {
        categoryId: byName.id,
        provider,
        providerCategoryId: categoryRank.providerCategoryId,
        providerCategoryName: categoryRank.categoryName,
        providerCategoryPath: categoryRank.categoryPath,
        providerCategoryUrl: categoryRank.bestsellerUrl,
      },
    });
    return { category: byName, discovered: false };
  }

  if (!autoFollow) return null;

  // Automatische Kategorienerkennung: neue Kategorie + Mapping anlegen
  const category = await prisma.amazonCategory.create({
    data: {
      marketplace,
      canonicalName: categoryRank.categoryName,
      normalizedName: normalized,
      path: categoryRank.categoryPath,
      categoryType: CATEGORY_TYPE_BROWSE_NODE,
      autoFollow: true,
      resolutionStatus: "resolved",
      lastResolvedAt: new Date(),
    },
  });
  await prisma.amazonCategoryProviderMapping.create({
    data: {
      categoryId: category.id,
      provider,
      providerCategoryId: categoryRank.providerCategoryId,
      providerCategoryName: categoryRank.categoryName,
      providerCategoryPath: categoryRank.categoryPath,
      providerCategoryUrl: categoryRank.bestsellerUrl,
    },
  });
  logger.info("amazon.category_discovered", {
    categoryId: category.id,
    name: categoryRank.categoryName,
    provider,
  });
  return { category, discovered: true };
}

// ---------------------------------------------------------------------------
// Rangbeobachtungen speichern (idempotent über Unique-Constraint)
// ---------------------------------------------------------------------------

export interface RecordRanksContext {
  observedAt: Date;
  fetchedAt: Date;
  runId: string | null;
  sourceStatus: AmazonSourceStatus;
  autoFollow: boolean;
  providerUpdatedAt?: Date | null;
}

export interface RecordRanksResult {
  observationIds: string[];
  touchedCategoryIds: string[];
  discoveredCategories: Array<{ id: string; name: string }>;
}

/** Speichert Website- und Kategorienränge EINES Providers als Beobachtungen. */
export async function recordProductRanks(
  edition: AmazonEdition,
  provider: AmazonProviderKind,
  ranks: NormalizedProductRanks,
  ctx: RecordRanksContext,
): Promise<RecordRanksResult> {
  const result: RecordRanksResult = {
    observationIds: [],
    touchedCategoryIds: [],
    discoveredCategories: [],
  };

  const upsertObservation = async (categoryId: string, rank: number | null): Promise<void> => {
    const freshness =
      ctx.providerUpdatedAt != null
        ? Math.max(0, Math.round((ctx.fetchedAt.getTime() - ctx.providerUpdatedAt.getTime()) / 1000))
        : null;
    const observation = await prisma.amazonRankObservation.upsert({
      where: {
        editionId_categoryId_provider_observedAt: {
          editionId: edition.id,
          categoryId,
          provider,
          observedAt: ctx.observedAt,
        },
      },
      update: {
        rank,
        fetchedAt: ctx.fetchedAt,
        sourceStatus: ctx.sourceStatus,
        providerUpdatedAt: ctx.providerUpdatedAt ?? null,
        freshnessSeconds: freshness,
        runId: ctx.runId,
      },
      create: {
        editionId: edition.id,
        categoryId,
        provider,
        rank,
        observedAt: ctx.observedAt,
        fetchedAt: ctx.fetchedAt,
        sourceStatus: ctx.sourceStatus,
        providerUpdatedAt: ctx.providerUpdatedAt ?? null,
        freshnessSeconds: freshness,
        runId: ctx.runId,
      },
    });
    result.observationIds.push(observation.id);
    result.touchedCategoryIds.push(categoryId);
  };

  // Gesamtrang (WEBSITE-Kategorie) – auch NULL wird als Beobachtung ohne Rang
  // gespeichert (Messung fand statt, Provider lieferte keinen Rang).
  const websiteCategory = await prisma.amazonCategory.findFirst({
    where: { marketplace: edition.marketplace, categoryType: CATEGORY_TYPE_WEBSITE },
  });
  if (websiteCategory) {
    await upsertObservation(websiteCategory.id, ranks.websiteSalesRank);
  }

  for (const categoryRank of ranks.categoryRanks) {
    const resolved = await resolveCategoryForRank(
      edition.marketplace,
      provider,
      categoryRank,
      ctx.autoFollow,
    );
    if (!resolved || !resolved.category.active) continue;
    await upsertObservation(resolved.category.id, categoryRank.rank);
    if (resolved.discovered) {
      result.discoveredCategories.push({
        id: resolved.category.id,
        name: resolved.category.canonicalName,
      });
    }
    await prisma.amazonEditionCategory.upsert({
      where: {
        editionId_categoryId: { editionId: edition.id, categoryId: resolved.category.id },
      },
      update: { currentlyRanked: true, lastSeenAt: ctx.fetchedAt },
      create: {
        editionId: edition.id,
        categoryId: resolved.category.id,
        discoveryProvider: provider,
        autoDiscovered: resolved.discovered,
        currentlyRanked: true,
        firstSeenAt: ctx.fetchedAt,
        lastSeenAt: ctx.fetchedAt,
      },
    });
  }

  // Kategorien, die dieser Provider zuvor geliefert hat, jetzt aber nicht mehr
  // → Austritt aus der Rangliste sichtbar machen.
  await prisma.amazonEditionCategory.updateMany({
    where: {
      editionId: edition.id,
      currentlyRanked: true,
      lastSeenAt: { lt: ctx.fetchedAt },
      category: { providerMappings: { some: { provider } } },
    },
    data: { currentlyRanked: false },
  });

  return result;
}

// ---------------------------------------------------------------------------
// Kanonische Snapshots
// ---------------------------------------------------------------------------

export interface CanonicalContext {
  staleAfterMinutes: number;
  providerPriority: "creators_first" | "rainforest_first";
  now?: Date;
}

/** Wählt und speichert den kanonischen Rang für einen Messzeitpunkt. */
export async function upsertCanonicalSnapshot(
  editionId: string,
  categoryId: string,
  observedAt: Date,
  ctx: CanonicalContext,
): Promise<{ id: string; canonicalRank: number | null; stale: boolean; dataGap: boolean }> {
  const observations = await prisma.amazonRankObservation.findMany({
    where: { editionId, categoryId, observedAt, provider: { in: ["CREATORS", "RAINFOREST"] } },
  });
  const creators = observations.find((o) => o.provider === "CREATORS") ?? null;
  const rainforest = observations.find((o) => o.provider === "RAINFOREST") ?? null;

  const lastCanonical = await prisma.amazonCanonicalRankSnapshot.findFirst({
    where: { editionId, categoryId, observedAt: { lt: observedAt }, canonicalRank: { not: null } },
    orderBy: { observedAt: "desc" },
  });

  const selection = selectCanonical({
    creators: creators
      ? {
          rank: creators.rank,
          fetchedAt: creators.fetchedAt,
          partial: creators.sourceStatus === "PARTIAL",
        }
      : null,
    rainforest: rainforest
      ? { rank: rainforest.rank, fetchedAt: rainforest.fetchedAt }
      : null,
    lastCanonical:
      lastCanonical && lastCanonical.canonicalRank !== null
        ? { rank: lastCanonical.canonicalRank, observedAt: lastCanonical.observedAt }
        : null,
    now: ctx.now ?? new Date(),
    staleAfterMs: ctx.staleAfterMinutes * 60 * 1000,
    priority: ctx.providerPriority,
  });

  const snapshot = await prisma.amazonCanonicalRankSnapshot.upsert({
    where: {
      editionId_categoryId_observedAt: { editionId, categoryId, observedAt },
    },
    update: {
      canonicalRank: selection.canonicalRank,
      selectedProvider: selection.selectedProvider,
      selectionReason: selection.selectionReason,
      stale: selection.stale,
      dataGap: selection.dataGap,
      amazonObservationId: creators?.id ?? null,
      rainforestObservationId: rainforest?.id ?? null,
    },
    create: {
      editionId,
      categoryId,
      observedAt,
      canonicalRank: selection.canonicalRank,
      selectedProvider: selection.selectedProvider,
      selectionReason: selection.selectionReason,
      stale: selection.stale,
      dataGap: selection.dataGap,
      amazonObservationId: creators?.id ?? null,
      rainforestObservationId: rainforest?.id ?? null,
    },
  });

  // Beobachtungen mit Auswahl-/Abweichungsinfo markieren
  const updates: Array<Promise<unknown>> = [];
  if (creators) {
    updates.push(
      prisma.amazonRankObservation.update({
        where: { id: creators.id },
        data: {
          canonical: selection.selectedProvider === "CREATORS",
          discrepancyFlag: selection.discrepancy,
          providerDifference: selection.providerDifference,
          providerPriority: ctx.providerPriority === "creators_first" ? 1 : 2,
        },
      }),
    );
  }
  if (rainforest) {
    updates.push(
      prisma.amazonRankObservation.update({
        where: { id: rainforest.id },
        data: {
          canonical: selection.selectedProvider === "RAINFOREST",
          discrepancyFlag: selection.discrepancy,
          providerDifference: selection.providerDifference,
          providerPriority: ctx.providerPriority === "creators_first" ? 2 : 1,
        },
      }),
    );
  }
  await Promise.all(updates);

  return {
    id: snapshot.id,
    canonicalRank: selection.canonicalRank,
    stale: selection.stale,
    dataGap: selection.dataGap,
  };
}

// ---------------------------------------------------------------------------
// Leaderboard-Snapshots
// ---------------------------------------------------------------------------

export interface SaveLeaderboardContext {
  runId: string | null;
  observedAt: Date;
  fetchedAt: Date;
  requestedLimit: number;
}

export async function saveLeaderboardSnapshot(
  category: AmazonCategory,
  leaderboard: NormalizedLeaderboard,
  ctx: SaveLeaderboardContext,
): Promise<string> {
  const env = getEnv();
  const asins = leaderboard.entries.map((e) => e.asin);
  const ownEditions = await prisma.amazonEdition.findMany({
    where: { asin: { in: asins } },
    select: { id: true, asin: true },
  });
  const editionByAsin = new Map(ownEditions.map((e) => [e.asin, e.id]));

  const snapshot = await prisma.amazonLeaderboardSnapshot.create({
    data: {
      categoryId: category.id,
      provider: "RAINFOREST",
      observedAt: ctx.observedAt,
      providerUpdatedAt: leaderboard.providerUpdatedAt,
      fetchedAt: ctx.fetchedAt,
      requestedLimit: ctx.requestedLimit,
      returnedCount: leaderboard.returnedCount,
      complete: leaderboard.complete,
      partialReason: leaderboard.partialReason,
      runId: ctx.runId,
      entries: {
        create: leaderboard.entries.map((entry) => ({
          position: entry.position,
          bestsellerRank: entry.bestsellerRank,
          asin: entry.asin,
          editionId: editionByAsin.get(entry.asin) ?? null,
          titleSnapshot: entry.title.slice(0, 500),
          subTitleSnapshot: entry.subTitle?.slice(0, 500) ?? null,
          authorSnapshot: entry.author?.slice(0, 300) ?? null,
          formatSnapshot: entry.variant?.slice(0, 100) ?? null,
          imageUrlSnapshot: entry.image,
          productUrlSnapshot: entry.link,
          affiliateUrlSnapshot: env.AMAZON_CREATORS_PARTNER_TAG
            ? `https://${env.AMAZON_CREATORS_MARKETPLACE}/dp/${entry.asin}?tag=${env.AMAZON_CREATORS_PARTNER_TAG}`
            : null,
          priceSnapshot: entry.price,
          currencySnapshot: entry.currency,
          priceRawSnapshot: entry.priceRaw,
          ratingSnapshot: entry.rating,
          reviewCountSnapshot: entry.reviewCount,
        })),
      },
    },
  });
  return snapshot.id;
}

// ---------------------------------------------------------------------------
// Metadaten-Snapshots + Edition-Aktualisierung
// ---------------------------------------------------------------------------

export interface MetadataChange {
  field: "price" | "availability" | "preorder" | "rating" | "reviewCount";
  from: string | null;
  to: string | null;
}

export async function saveMetadataSnapshot(
  edition: AmazonEdition,
  provider: AmazonProviderKind,
  meta: NormalizedProductMetadata,
  observedAt: Date,
): Promise<MetadataChange[]> {
  await prisma.amazonProductMetadataSnapshot.create({
    data: {
      editionId: edition.id,
      provider,
      title: meta.title,
      author: meta.author,
      coverSmallUrl: meta.coverSmallUrl,
      coverMediumUrl: meta.coverMediumUrl,
      coverLargeUrl: meta.coverLargeUrl,
      price: meta.price,
      currency: meta.currency,
      availability: meta.availability?.slice(0, 300) ?? null,
      rating: meta.rating,
      reviewCount: meta.reviewCount,
      preorder: meta.preorder,
      observedAt,
    },
  });

  const changes: MetadataChange[] = [];
  const oldPrice = edition.currentPrice !== null ? Number(edition.currentPrice) : null;
  if (meta.price !== null && oldPrice !== null && Math.abs(meta.price - oldPrice) >= 0.01) {
    changes.push({ field: "price", from: String(oldPrice), to: String(meta.price) });
  }
  if (
    meta.availability !== null &&
    edition.currentAvailability !== null &&
    meta.availability !== edition.currentAvailability
  ) {
    changes.push({
      field: "availability",
      from: edition.currentAvailability,
      to: meta.availability,
    });
  }
  if (meta.preorder !== null && meta.preorder !== edition.preorder) {
    changes.push({ field: "preorder", from: String(edition.preorder), to: String(meta.preorder) });
  }
  if (
    meta.rating !== null &&
    edition.currentRating !== null &&
    Math.abs(meta.rating - edition.currentRating) >= 0.05
  ) {
    changes.push({ field: "rating", from: String(edition.currentRating), to: String(meta.rating) });
  }
  if (
    meta.reviewCount !== null &&
    edition.currentReviewCount !== null &&
    meta.reviewCount !== edition.currentReviewCount
  ) {
    changes.push({
      field: "reviewCount",
      from: String(edition.currentReviewCount),
      to: String(meta.reviewCount),
    });
  }

  const asinConfirmed = meta.asin === edition.asin;
  await prisma.amazonEdition.update({
    where: { id: edition.id },
    data: {
      parentAsin: meta.parentAsin ?? edition.parentAsin,
      coverSmallUrl: meta.coverSmallUrl ?? edition.coverSmallUrl,
      coverMediumUrl: meta.coverMediumUrl ?? edition.coverMediumUrl,
      coverLargeUrl: meta.coverLargeUrl ?? edition.coverLargeUrl,
      coverWidth: meta.coverWidth ?? edition.coverWidth,
      coverHeight: meta.coverHeight ?? edition.coverHeight,
      currentPrice: meta.price ?? edition.currentPrice,
      currency: meta.currency ?? edition.currency,
      currentAvailability: meta.availability?.slice(0, 300) ?? edition.currentAvailability,
      currentRating: meta.rating ?? edition.currentRating,
      currentReviewCount: meta.reviewCount ?? edition.currentReviewCount,
      preorder: meta.preorder ?? edition.preorder,
      metadataProvider: provider,
      metadataObservedAt: observedAt,
      productUrl: meta.productUrl ?? edition.productUrl,
      ...(asinConfirmed && !edition.asinValidated
        ? {
            asinValidated: true,
            asinValidatedAt: observedAt,
            asinValidationProvider: provider,
          }
        : {}),
    },
  });

  return changes;
}

// ---------------------------------------------------------------------------
// Provider-Runs, Status, Circuit Breaker
// ---------------------------------------------------------------------------

export async function startProviderRun(options: {
  jobType: string;
  provider?: AmazonProviderKind | null;
  capability?: string | null;
  correlationId: string;
  scheduledAt?: Date | null;
  attempt?: number;
}): Promise<string> {
  const run = await prisma.amazonProviderRun.create({
    data: {
      jobType: options.jobType,
      provider: options.provider ?? null,
      capability: options.capability ?? null,
      correlationId: options.correlationId,
      scheduledAt: options.scheduledAt ?? null,
      startedAt: new Date(),
      attempt: options.attempt ?? 1,
    },
  });
  return run.id;
}

export async function finishProviderRun(
  runId: string,
  data: {
    status: AmazonRunStatus;
    requestCount?: number;
    recordsRequested?: number | null;
    recordsReturned?: number | null;
    creditsUsed?: number | null;
    creditsRemaining?: number | null;
    latencyMs?: number | null;
    fallbackFrom?: AmazonProviderKind | null;
    errorClass?: string | null;
    errorCode?: string | null;
    safeErrorMessage?: string | null;
    httpStatus?: number | null;
  },
): Promise<void> {
  await prisma.amazonProviderRun.update({
    where: { id: runId },
    data: { ...data, completedAt: new Date() },
  });
}

const CIRCUIT_OPEN_AFTER_FAILURES = 4;
const CIRCUIT_RETRY_AFTER_MS = 10 * 60 * 1000;

export async function updateProviderStatus(
  provider: AmazonProviderKind,
  outcome: {
    configured: boolean;
    success: boolean;
    latencyMs?: number | null;
    quota?: ProviderQuotaStatus | null;
  },
): Promise<void> {
  const existing = await prisma.amazonProviderStatus.findUnique({ where: { provider } });
  const consecutiveFailures = outcome.success ? 0 : (existing?.consecutiveFailures ?? 0) + 1;
  let circuitState = existing?.circuitBreakerState ?? "closed";
  let circuitOpenedAt = existing?.circuitOpenedAt ?? null;
  if (outcome.success) {
    circuitState = "closed";
    circuitOpenedAt = null;
  } else if (consecutiveFailures >= CIRCUIT_OPEN_AFTER_FAILURES && circuitState !== "open") {
    circuitState = "open";
    circuitOpenedAt = new Date();
    logger.warn("amazon.circuit_opened", { provider, consecutiveFailures });
  }

  await prisma.amazonProviderStatus.upsert({
    where: { provider },
    update: {
      configured: outcome.configured,
      healthy: outcome.success,
      lastSuccessAt: outcome.success ? new Date() : existing?.lastSuccessAt,
      lastFailureAt: outcome.success ? existing?.lastFailureAt : new Date(),
      consecutiveFailures,
      circuitBreakerState: circuitState,
      circuitOpenedAt,
      currentLatencyMs: outcome.latencyMs ?? existing?.currentLatencyMs,
      ...(outcome.quota !== undefined && outcome.quota !== null
        ? { quota: outcome.quota as unknown as Prisma.InputJsonValue }
        : {}),
    },
    create: {
      provider,
      configured: outcome.configured,
      healthy: outcome.success,
      lastSuccessAt: outcome.success ? new Date() : null,
      lastFailureAt: outcome.success ? null : new Date(),
      consecutiveFailures,
      circuitBreakerState: circuitState,
      circuitOpenedAt,
      currentLatencyMs: outcome.latencyMs ?? null,
      ...(outcome.quota !== undefined && outcome.quota !== null
        ? { quota: outcome.quota as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });
}

/** Circuit-Breaker-Gate: open → blockiert, bis die Wartezeit abgelaufen ist. */
export async function circuitAllows(provider: AmazonProviderKind): Promise<boolean> {
  const status = await prisma.amazonProviderStatus.findUnique({ where: { provider } });
  if (!status || status.circuitBreakerState === "closed") return true;
  if (
    status.circuitOpenedAt &&
    Date.now() - status.circuitOpenedAt.getTime() > CIRCUIT_RETRY_AFTER_MS
  ) {
    await prisma.amazonProviderStatus.update({
      where: { provider },
      data: { circuitBreakerState: "half_open" },
    });
    return true; // half-open: ein Versuch erlaubt
  }
  return status.circuitBreakerState === "half_open";
}

// ---------------------------------------------------------------------------
// Redigierte Rohpayloads (max. Retention laut Einstellung)
// ---------------------------------------------------------------------------

export async function storeRawPayload(options: {
  provider: AmazonProviderKind;
  capability: string;
  runId: string | null;
  redactedPayload: unknown;
  fetchedAt: Date;
}): Promise<void> {
  const serialized = JSON.stringify(options.redactedPayload);
  await prisma.amazonRawPayload.create({
    data: {
      provider: options.provider,
      capability: options.capability,
      runId: options.runId,
      payload: options.redactedPayload as Prisma.InputJsonValue,
      payloadHash: createHash("sha256").update(serialized).digest("hex"),
      fetchedAt: options.fetchedAt,
    },
  });
}

export async function cleanupRawPayloads(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.amazonRawPayload.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}

// ---------------------------------------------------------------------------
// Manuelle Baseline (source=manual, vom Admin festgelegter Zeitstempel)
// ---------------------------------------------------------------------------

export interface BaselineEntry {
  categoryName: string;
  rank: number;
}

/**
 * Importiert manuell beobachtete Stände als MANUAL-Beobachtungen + kanonische
 * Snapshots. Wird NIE als Live-Snapshot gekennzeichnet.
 */
export async function importManualBaseline(options: {
  editionId: string;
  observedAt: Date;
  entries: BaselineEntry[];
}): Promise<{ imported: number }> {
  const edition = await prisma.amazonEdition.findUniqueOrThrow({
    where: { id: options.editionId },
  });
  let imported = 0;
  for (const entry of options.entries) {
    if (!Number.isInteger(entry.rank) || entry.rank <= 0) continue;
    const normalized = normalizeCategoryName(entry.categoryName);
    let category = await prisma.amazonCategory.findFirst({
      where: { marketplace: edition.marketplace, normalizedName: normalized },
    });
    if (!category) {
      category = await prisma.amazonCategory.create({
        data: {
          marketplace: edition.marketplace,
          canonicalName: entry.categoryName,
          normalizedName: normalized,
          categoryType:
            normalized === "bücher" ? CATEGORY_TYPE_WEBSITE : CATEGORY_TYPE_BROWSE_NODE,
        },
      });
    }
    await prisma.amazonRankObservation.upsert({
      where: {
        editionId_categoryId_provider_observedAt: {
          editionId: edition.id,
          categoryId: category.id,
          provider: "MANUAL",
          observedAt: options.observedAt,
        },
      },
      update: { rank: entry.rank, sourceStatus: "MANUAL", fetchedAt: options.observedAt },
      create: {
        editionId: edition.id,
        categoryId: category.id,
        provider: "MANUAL",
        rank: entry.rank,
        observedAt: options.observedAt,
        fetchedAt: options.observedAt,
        sourceStatus: "MANUAL",
        canonical: true,
      },
    });
    await prisma.amazonCanonicalRankSnapshot.upsert({
      where: {
        editionId_categoryId_observedAt: {
          editionId: edition.id,
          categoryId: category.id,
          observedAt: options.observedAt,
        },
      },
      update: { canonicalRank: entry.rank, selectionReason: "manual_baseline" },
      create: {
        editionId: edition.id,
        categoryId: category.id,
        observedAt: options.observedAt,
        canonicalRank: entry.rank,
        selectedProvider: "MANUAL",
        selectionReason: "manual_baseline",
      },
    });
    imported += 1;
  }
  return { imported };
}
