import "server-only";
import { randomUUID } from "node:crypto";
import type { AmazonRunStatus } from "@prisma/client";
import { alertCreditLevel, alertDiscoveredCategories, alertMetadataChanges, alertProviderIssue, deliverAlert, evaluateRankChangeAlerts, type CategoryRankChange } from "@/lib/amazon/alerts";
import { getAmazonSettings, type AmazonSettings } from "@/lib/amazon/amazon-settings";
import { AMAZON_JOB_TYPES, type AmazonJobType } from "@/lib/amazon/constants";
import { runDailyDigest } from "@/lib/amazon/digest";
import { forecastQuota } from "@/lib/amazon/quota";
import { ProviderError } from "@/lib/amazon/provider-types";
import { creatorsGetItems, getCreatorsAccessToken, isCreatorsConfigured } from "@/lib/amazon/providers/creators";
import {
  isRainforestConfigured,
  rainforestGetAccount,
  rainforestGetBestsellers,
  rainforestGetProduct,
  rainforestSearchCategories,
} from "@/lib/amazon/providers/rainforest";
import { redactJson, safeErrorMessage } from "@/lib/amazon/redact";
import {
  circuitAllows,
  cleanupRawPayloads,
  ensurePrimaryBook,
  finishProviderRun,
  importManualBaseline,
  normalizeCategoryName,
  recordProductRanks,
  saveLeaderboardSnapshot,
  saveMetadataSnapshot,
  startProviderRun,
  storeRawPayload,
  updateProviderStatus,
  upsertCanonicalSnapshot,
} from "@/lib/amazon/store";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export { importManualBaseline };

/**
 * Scheduler und Hintergrundjobs des Amazon-Ranking-Moduls.
 *
 * Ein "Tick" (/api/cron/amazon oder manueller Admin-Trigger) führt alle
 * fälligen Jobs aus. Fälligkeit und verteilte Locks liegen in AmazonJobState:
 * Der Lock wird über ein bedingtes UPDATE erworben (schützt vor parallelen
 * Doppelstarts über mehrere Serverless-Instanzen). Provider-Aufrufe laufen
 * NIEMALS im Redirect-Hot-Path.
 */

const LOCK_DURATION_MS = 10 * 60 * 1000;
const MANUAL_RATE_LIMIT_MS = 2 * 60 * 1000;

export interface JobOutcome {
  status: AmazonRunStatus;
  detail: string;
}

interface JobContext {
  settings: AmazonSettings;
  correlationId: string;
  manual: boolean;
  now: Date;
}

interface JobDefinition {
  type: AmazonJobType;
  intervalMinutes: (settings: AmazonSettings) => number;
  /** Läuft der Job auch bei deaktiviertem Modul? (Health/Cleanup: ja) */
  runsWhenDisabled: boolean;
  run: (ctx: JobContext) => Promise<JobOutcome>;
}

/** Messzeitpunkt auf volle Minute runden (stabile Zeitreihen-Buckets). */
function minuteBucket(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000);
}

/** Heute verbrauchte Rainforest-Credits (UTC-Kalendertag). */
async function creditsUsedToday(now: Date): Promise<number> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const result = await prisma.amazonProviderRun.aggregate({
    where: { provider: "RAINFOREST", startedAt: { gte: dayStart } },
    _sum: { creditsUsed: true },
  });
  return result._sum.creditsUsed ?? 0;
}

async function budgetAllows(
  settings: AmazonSettings,
  now: Date,
  plannedCredits: number,
): Promise<boolean> {
  if (settings.dailyCreditBudget === null) return true;
  const used = await creditsUsedToday(now);
  return used + plannedCredits <= settings.dailyCreditBudget;
}

// ---------------------------------------------------------------------------
// Job: refresh-primary-book-ranks – beide Provider parallel (allSettled)
// ---------------------------------------------------------------------------

async function jobRefreshPrimaryBookRanks(ctx: JobContext): Promise<JobOutcome> {
  const { editionId } = await ensurePrimaryBook();
  const edition = await prisma.amazonEdition.findUniqueOrThrow({ where: { id: editionId } });
  const observedAt = minuteBucket(ctx.now);
  const touchedCategories = new Set<string>();
  const discovered: Array<{ id: string; name: string }> = [];
  let creatorsOk = false;
  let rainforestOk = false;
  let anyConfigured = false;

  const creatorsTask = async (): Promise<void> => {
    if (!isCreatorsConfigured()) return;
    anyConfigured = true;
    if (!(await circuitAllows("CREATORS"))) {
      await alertProviderIssue({
        provider: "Amazon Creators API",
        kind: "circuit_open",
        detail: "Der Provider wird nach mehreren Fehlern vorübergehend übersprungen.",
      });
      return;
    }
    const runId = await startProviderRun({
      jobType: "refresh-primary-book-ranks",
      provider: "CREATORS",
      capability: "CATEGORY_SALES_RANKS",
      correlationId: ctx.correlationId,
    });
    try {
      const result = await creatorsGetItems([edition.asin]);
      const ranks = result.ranks.find((r) => r.asin === edition.asin);
      const meta = result.metadata.find((m) => m.asin === edition.asin);
      const itemError = result.errors.find((e) => e.asin === edition.asin);
      if (!ranks && itemError) {
        throw new ProviderError({
          message: `Item nicht zugänglich: ${itemError.code ?? "unbekannt"}`,
          errorClass: "not_found",
          retryable: false,
        });
      }
      if (ranks) {
        const recorded = await recordProductRanks(edition, "CREATORS", ranks, {
          observedAt,
          fetchedAt: new Date(),
          runId,
          sourceStatus: itemError ? "PARTIAL" : "LIVE",
          autoFollow: ctx.settings.autoFollowCategories,
        });
        recorded.touchedCategoryIds.forEach((id) => touchedCategories.add(id));
        discovered.push(...recorded.discoveredCategories);
      }
      if (meta) {
        const changes = await saveMetadataSnapshot(edition, "CREATORS", meta, observedAt);
        await alertMetadataChanges(edition.asin, changes);
      }
      for (const payload of result.rawPayloads) {
        await storeRawPayload({
          provider: "CREATORS",
          capability: "CATEGORY_SALES_RANKS",
          runId,
          redactedPayload: redactJson(payload),
          fetchedAt: new Date(),
        });
      }
      await finishProviderRun(runId, {
        status: "SUCCESS",
        requestCount: result.requestCount,
        recordsRequested: 1,
        recordsReturned: ranks ? 1 : 0,
        latencyMs: result.latencyMs,
      });
      await updateProviderStatus("CREATORS", {
        configured: true,
        success: true,
        latencyMs: result.latencyMs,
      });
      creatorsOk = true;
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : null;
      await finishProviderRun(runId, {
        status: "FAILED",
        errorClass: providerError?.errorClass ?? "unknown",
        errorCode: providerError?.code ?? null,
        httpStatus: providerError?.httpStatus ?? null,
        safeErrorMessage: safeErrorMessage(error),
      });
      await updateProviderStatus("CREATORS", { configured: true, success: false });
      logger.warn("amazon.creators_rank_fetch_failed", {
        errorClass: providerError?.errorClass ?? "unknown",
      });
    }
  };

  const rainforestTask = async (): Promise<void> => {
    if (!isRainforestConfigured()) return;
    anyConfigured = true;
    if (!(await circuitAllows("RAINFOREST"))) return;
    if (!(await budgetAllows(ctx.settings, ctx.now, 1))) {
      logger.warn("amazon.rainforest_budget_exceeded", { job: "refresh-primary-book-ranks" });
      return;
    }
    const runId = await startProviderRun({
      jobType: "refresh-primary-book-ranks",
      provider: "RAINFOREST",
      capability: "CATEGORY_SALES_RANKS",
      correlationId: ctx.correlationId,
    });
    try {
      const result = await rainforestGetProduct(edition.asin);
      if (result.data.ranks) {
        const recorded = await recordProductRanks(edition, "RAINFOREST", result.data.ranks, {
          observedAt,
          fetchedAt: new Date(),
          runId,
          sourceStatus: "LIVE",
          autoFollow: ctx.settings.autoFollowCategories,
          providerUpdatedAt: result.data.ranks.providerUpdatedAt,
        });
        recorded.touchedCategoryIds.forEach((id) => touchedCategories.add(id));
        discovered.push(...recorded.discoveredCategories);
      }
      if (result.data.metadata) {
        const changes = await saveMetadataSnapshot(
          edition,
          "RAINFOREST",
          result.data.metadata,
          observedAt,
        );
        await alertMetadataChanges(edition.asin, changes);
      }
      await storeRawPayload({
        provider: "RAINFOREST",
        capability: "CATEGORY_SALES_RANKS",
        runId,
        redactedPayload: result.redactedPayload,
        fetchedAt: new Date(),
      });
      await finishProviderRun(runId, {
        status: "SUCCESS",
        requestCount: 1,
        recordsRequested: 1,
        recordsReturned: result.data.ranks ? 1 : 0,
        creditsUsed: result.creditsUsed,
        creditsRemaining: result.creditsRemaining,
        latencyMs: result.latencyMs,
      });
      await updateProviderStatus("RAINFOREST", {
        configured: true,
        success: true,
        latencyMs: result.latencyMs,
      });
      rainforestOk = true;
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : null;
      await finishProviderRun(runId, {
        status: "FAILED",
        errorClass: providerError?.errorClass ?? "unknown",
        httpStatus: providerError?.httpStatus ?? null,
        safeErrorMessage: safeErrorMessage(error),
      });
      await updateProviderStatus("RAINFOREST", { configured: true, success: false });
      logger.warn("amazon.rainforest_rank_fetch_failed", {
        errorClass: providerError?.errorClass ?? "unknown",
      });
    }
  };

  // Ein Providerfehler darf das Ergebnis des anderen nicht verwerfen
  await Promise.allSettled([creatorsTask(), rainforestTask()]);

  if (!anyConfigured) {
    return { status: "SKIPPED", detail: "Kein Provider konfiguriert." };
  }

  // Kanonische Auswahl + Alert-Auswertung pro berührter Kategorie.
  // Auch bei komplettem Providerausfall: bestehende Kategorien fortschreiben,
  // damit stale/data_gap sichtbar werden.
  if (touchedCategories.size === 0) {
    const known = await prisma.amazonEditionCategory.findMany({
      where: { editionId, active: true },
      select: { categoryId: true },
    });
    known.forEach((k) => touchedCategories.add(k.categoryId));
    const website = await prisma.amazonCategory.findFirst({
      where: { marketplace: edition.marketplace, categoryType: "WEBSITE" },
      select: { id: true },
    });
    if (website) touchedCategories.add(website.id);
  }

  const changes: CategoryRankChange[] = [];
  for (const categoryId of touchedCategories) {
    const category = await prisma.amazonCategory.findUnique({ where: { id: categoryId } });
    if (!category || !category.active) continue;
    const [previous, previousBestAgg] = await Promise.all([
      prisma.amazonCanonicalRankSnapshot.findFirst({
        where: { editionId, categoryId, observedAt: { lt: observedAt }, canonicalRank: { not: null } },
        orderBy: { observedAt: "desc" },
      }),
      prisma.amazonCanonicalRankSnapshot.aggregate({
        where: { editionId, categoryId, observedAt: { lt: observedAt }, canonicalRank: { not: null } },
        _min: { canonicalRank: true },
      }),
    ]);
    const canonical = await upsertCanonicalSnapshot(editionId, categoryId, observedAt, {
      staleAfterMinutes: ctx.settings.staleAfterMinutes,
      providerPriority: ctx.settings.providerPriority,
      now: ctx.now,
    });
    changes.push({
      categoryId,
      categoryName: category.canonicalName,
      categoryType: category.categoryType,
      previousRank: previous?.canonicalRank ?? null,
      currentRank: canonical.canonicalRank,
      previousBest: previousBestAgg._min.canonicalRank ?? null,
      stale: canonical.stale,
      dataGap: canonical.dataGap,
    });
  }

  await evaluateRankChangeAlerts(changes);
  await alertDiscoveredCategories(discovered);

  if (!creatorsOk && rainforestOk && isCreatorsConfigured()) {
    await alertProviderIssue({
      provider: "Amazon Creators API",
      kind: "fallback_active",
      detail: "Rainforest liefert die kanonischen Werte, bis Creators wieder erreichbar ist.",
    });
  }
  if (!creatorsOk && !rainforestOk) {
    await alertProviderIssue({
      provider: "Amazon Creators API + Rainforest API",
      kind: "down",
      detail: "Beide Provider sind fehlgeschlagen – letzter Stand bleibt als stale sichtbar.",
    });
    return { status: "FAILED", detail: "Beide Provider fehlgeschlagen." };
  }
  return creatorsOk && rainforestOk
    ? { status: "SUCCESS", detail: "Beide Provider erfolgreich." }
    : { status: "PARTIAL", detail: creatorsOk ? "Nur Creators erfolgreich." : "Nur Rainforest erfolgreich." };
}

// ---------------------------------------------------------------------------
// Job: refresh-category-leaderboards – Top-25 via Rainforest
// ---------------------------------------------------------------------------

async function jobRefreshCategoryLeaderboards(ctx: JobContext): Promise<JobOutcome> {
  if (!isRainforestConfigured()) {
    return { status: "SKIPPED", detail: "Rainforest nicht konfiguriert." };
  }
  const categories = await prisma.amazonCategory.findMany({
    where: {
      active: true,
      leaderboardEnabled: true,
      providerMappings: { some: { provider: "RAINFOREST" } },
    },
    include: {
      providerMappings: { where: { provider: "RAINFOREST" }, orderBy: { verified: "desc" } },
    },
  });
  if (categories.length === 0) {
    return { status: "SKIPPED", detail: "Keine Kategorie mit Rainforest-Mapping aktiv." };
  }
  if (!(await budgetAllows(ctx.settings, ctx.now, categories.length))) {
    return { status: "SKIPPED", detail: "Tagesbudget für Credits würde überschritten." };
  }
  if (!(await circuitAllows("RAINFOREST"))) {
    return { status: "SKIPPED", detail: "Circuit Breaker offen." };
  }

  const ownEditions = await prisma.amazonEdition.findMany({ select: { asin: true } });
  const ownAsins = new Set(ownEditions.map((e) => e.asin));

  let successCount = 0;
  let failureCount = 0;
  for (const category of categories) {
    const mapping = category.providerMappings[0];
    if (!mapping) continue;
    const runId = await startProviderRun({
      jobType: "refresh-category-leaderboards",
      provider: "RAINFOREST",
      capability: "CATEGORY_LEADERBOARD",
      correlationId: ctx.correlationId,
    });
    try {
      const result = await rainforestGetBestsellers({
        categoryId: mapping.providerCategoryId,
        categoryUrl: mapping.providerCategoryUrl,
        limit: category.leaderboardLimit,
      });
      if (!result.data || result.data.entries.length === 0) {
        throw new ProviderError({
          message: "Leere Bestsellerliste erhalten.",
          errorClass: "validation",
          retryable: false,
        });
      }
      const observedAt = minuteBucket(new Date());

      // Eintritt/Austritt des eigenen Buchs gegen den letzten Snapshot prüfen
      const previous = await prisma.amazonLeaderboardSnapshot.findFirst({
        where: { categoryId: category.id },
        orderBy: { observedAt: "desc" },
        include: { entries: { select: { asin: true } } },
      });
      await saveLeaderboardSnapshot(category, result.data, {
        runId,
        observedAt,
        fetchedAt: new Date(),
        requestedLimit: category.leaderboardLimit,
      });
      await storeRawPayload({
        provider: "RAINFOREST",
        capability: "CATEGORY_LEADERBOARD",
        runId,
        redactedPayload: result.redactedPayload,
        fetchedAt: new Date(),
      });
      await finishProviderRun(runId, {
        status: result.data.complete ? "SUCCESS" : "PARTIAL",
        requestCount: 1,
        recordsRequested: category.leaderboardLimit,
        recordsReturned: result.data.returnedCount,
        creditsUsed: result.creditsUsed,
        creditsRemaining: result.creditsRemaining,
        latencyMs: result.latencyMs,
      });
      await updateProviderStatus("RAINFOREST", {
        configured: true,
        success: true,
        latencyMs: result.latencyMs,
      });

      const previousOwn = new Set(
        (previous?.entries ?? []).map((e) => e.asin).filter((a) => ownAsins.has(a)),
      );
      const currentOwnEntries = result.data.entries.filter((e) => ownAsins.has(e.asin));
      for (const entry of currentOwnEntries) {
        if (!previousOwn.has(entry.asin)) {
          await deliverAlert({
            dedupeKey: `top25_entry:${category.id}:${entry.asin}`,
            title: `Eigenes Buch in Top 25: „${category.canonicalName}“`,
            message: `Platz ${entry.position} (Bestseller-Rang ${entry.bestsellerRank}).`,
            severity: "info",
            cooldownMinutes: 360,
          });
        }
      }
      for (const asin of previousOwn) {
        if (!currentOwnEntries.some((e) => e.asin === asin)) {
          await deliverAlert({
            dedupeKey: `top25_exit:${category.id}:${asin}`,
            title: `Aus Top 25 ausgeschieden: „${category.canonicalName}“`,
            message: "Das eigene Buch ist nicht mehr in der Top-25-Liste.",
            severity: "warning",
            cooldownMinutes: 360,
          });
        }
      }
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      const providerError = error instanceof ProviderError ? error : null;
      await finishProviderRun(runId, {
        status: "FAILED",
        errorClass: providerError?.errorClass ?? "unknown",
        httpStatus: providerError?.httpStatus ?? null,
        safeErrorMessage: safeErrorMessage(error),
      });
      await updateProviderStatus("RAINFOREST", { configured: true, success: false });
    }
  }

  if (successCount === 0) return { status: "FAILED", detail: "Alle Leaderboard-Abrufe fehlgeschlagen." };
  return failureCount === 0
    ? { status: "SUCCESS", detail: `${successCount} Listen aktualisiert.` }
    : { status: "PARTIAL", detail: `${successCount} ok, ${failureCount} fehlgeschlagen.` };
}

// ---------------------------------------------------------------------------
// Job: refresh-product-metadata – Creators primär (Cover, Basisdaten)
// ---------------------------------------------------------------------------

async function jobRefreshProductMetadata(ctx: JobContext): Promise<JobOutcome> {
  await ensurePrimaryBook();
  const editions = await prisma.amazonEdition.findMany({ where: { active: true } });
  if (editions.length === 0) return { status: "SKIPPED", detail: "Keine aktiven Editionen." };
  if (!isCreatorsConfigured()) {
    return { status: "SKIPPED", detail: "Creators nicht konfiguriert (Rainforest-Metadaten laufen im Rang-Job mit)." };
  }
  if (!(await circuitAllows("CREATORS"))) {
    return { status: "SKIPPED", detail: "Circuit Breaker offen." };
  }
  const runId = await startProviderRun({
    jobType: "refresh-product-metadata",
    provider: "CREATORS",
    capability: "PRODUCT_METADATA",
    correlationId: ctx.correlationId,
  });
  try {
    const result = await creatorsGetItems(editions.map((e) => e.asin));
    const observedAt = minuteBucket(ctx.now);
    let updated = 0;
    for (const edition of editions) {
      const meta = result.metadata.find((m) => m.asin === edition.asin);
      if (!meta) continue;
      const changes = await saveMetadataSnapshot(edition, "CREATORS", meta, observedAt);
      await alertMetadataChanges(edition.asin, changes);
      updated += 1;
    }
    await finishProviderRun(runId, {
      status: updated > 0 ? "SUCCESS" : "PARTIAL",
      requestCount: result.requestCount,
      recordsRequested: editions.length,
      recordsReturned: updated,
      latencyMs: result.latencyMs,
    });
    await updateProviderStatus("CREATORS", { configured: true, success: true, latencyMs: result.latencyMs });
    return { status: "SUCCESS", detail: `${updated} Editionen aktualisiert.` };
  } catch (error) {
    const providerError = error instanceof ProviderError ? error : null;
    await finishProviderRun(runId, {
      status: "FAILED",
      errorClass: providerError?.errorClass ?? "unknown",
      safeErrorMessage: safeErrorMessage(error),
    });
    await updateProviderStatus("CREATORS", { configured: true, success: false });
    return { status: "FAILED", detail: safeErrorMessage(error, 120) };
  }
}

// ---------------------------------------------------------------------------
// Job: resolve-amazon-categories – Rainforest-Kategorie-IDs auflösen
// ---------------------------------------------------------------------------

async function jobResolveCategories(ctx: JobContext): Promise<JobOutcome> {
  if (!isRainforestConfigured()) {
    return { status: "SKIPPED", detail: "Rainforest nicht konfiguriert." };
  }
  await ensurePrimaryBook();
  const categories = await prisma.amazonCategory.findMany({
    where: {
      active: true,
      leaderboardEnabled: true,
      providerMappings: { none: { provider: "RAINFOREST" } },
    },
  });
  if (categories.length === 0) {
    return { status: "SUCCESS", detail: "Alle Leaderboard-Kategorien sind aufgelöst." };
  }
  let resolved = 0;
  let ambiguous = 0;
  for (const category of categories) {
    const runId = await startProviderRun({
      jobType: "resolve-amazon-categories",
      provider: "RAINFOREST",
      capability: "CATEGORY_SEARCH",
      correlationId: ctx.correlationId,
    });
    try {
      // Klammerzusätze für die Suche entfernen ("E-Business (Bücher)" → "E-Business")
      const searchTerm = category.canonicalName.replace(/\s*\(.*\)\s*/, "").trim();
      const result = await rainforestSearchCategories(searchTerm);
      const candidates = result.data.filter(
        (c) =>
          normalizeCategoryName(c.name) === normalizeCategoryName(searchTerm) ||
          normalizeCategoryName(c.name) === category.normalizedName,
      );
      const scoped = candidates.filter(
        (c) => c.path === null || /bücher|books/i.test(c.path),
      );
      const usable = scoped.length > 0 ? scoped : candidates;

      for (const candidate of usable) {
        await prisma.amazonCategoryProviderMapping.upsert({
          where: {
            categoryId_provider_providerCategoryId: {
              categoryId: category.id,
              provider: "RAINFOREST",
              providerCategoryId: candidate.providerCategoryId,
            },
          },
          update: {
            providerCategoryName: candidate.name,
            providerCategoryPath: candidate.path,
            providerCategoryUrl: candidate.url,
            parentProviderCategoryId: candidate.parentId,
          },
          create: {
            categoryId: category.id,
            provider: "RAINFOREST",
            providerCategoryId: candidate.providerCategoryId,
            providerCategoryName: candidate.name,
            providerCategoryPath: candidate.path,
            providerCategoryUrl: candidate.url,
            parentProviderCategoryId: candidate.parentId,
            // Eindeutiger Treffer im Bücherbereich → automatisch verifiziert;
            // mehrere Treffer → Admin wählt anhand der vollständigen Pfade.
            verified: usable.length === 1,
            verifiedAt: usable.length === 1 ? new Date() : null,
          },
        });
      }
      await prisma.amazonCategory.update({
        where: { id: category.id },
        data: {
          lastResolvedAt: new Date(),
          resolutionStatus:
            usable.length === 1 ? "resolved" : usable.length > 1 ? "ambiguous" : "failed",
        },
      });
      if (usable.length === 1) resolved += 1;
      else if (usable.length > 1) ambiguous += 1;
      await finishProviderRun(runId, {
        status: "SUCCESS",
        requestCount: 1,
        recordsReturned: usable.length,
        creditsUsed: result.creditsUsed,
        creditsRemaining: result.creditsRemaining,
        latencyMs: result.latencyMs,
      });
    } catch (error) {
      await prisma.amazonCategory.update({
        where: { id: category.id },
        data: { lastResolvedAt: new Date(), resolutionStatus: "failed" },
      });
      await finishProviderRun(runId, {
        status: "FAILED",
        safeErrorMessage: safeErrorMessage(error),
      });
    }
  }
  return {
    status: "SUCCESS",
    detail: `${resolved} aufgelöst, ${ambiguous} mehrdeutig (Admin-Auswahl nötig), ${categories.length - resolved - ambiguous} fehlgeschlagen.`,
  };
}

// ---------------------------------------------------------------------------
// Jobs: Provider-Health + Rainforest-Account
// ---------------------------------------------------------------------------

async function jobRefreshProviderHealth(ctx: JobContext): Promise<JobOutcome> {
  const results: string[] = [];
  if (isCreatorsConfigured()) {
    const started = Date.now();
    try {
      await getCreatorsAccessToken();
      await updateProviderStatus("CREATORS", {
        configured: true,
        success: true,
        latencyMs: Date.now() - started,
      });
      results.push("Creators ok");
    } catch {
      await updateProviderStatus("CREATORS", { configured: true, success: false });
      results.push("Creators fehlgeschlagen");
    }
  } else {
    await updateProviderStatus("CREATORS", { configured: false, success: false });
    results.push("Creators nicht konfiguriert");
  }
  if (isRainforestConfigured()) {
    const started = Date.now();
    try {
      const account = await rainforestGetAccount();
      await updateProviderStatus("RAINFOREST", {
        configured: true,
        success: true,
        latencyMs: Date.now() - started,
        quota: account.data,
      });
      results.push("Rainforest ok");
    } catch {
      await updateProviderStatus("RAINFOREST", { configured: true, success: false });
      results.push("Rainforest fehlgeschlagen");
    }
  } else {
    await updateProviderStatus("RAINFOREST", { configured: false, success: false });
    results.push("Rainforest nicht konfiguriert");
  }
  void ctx;
  return { status: "SUCCESS", detail: results.join(", ") };
}

async function jobRefreshRainforestAccount(ctx: JobContext): Promise<JobOutcome> {
  if (!isRainforestConfigured()) {
    return { status: "SKIPPED", detail: "Rainforest nicht konfiguriert." };
  }
  const runId = await startProviderRun({
    jobType: "refresh-rainforest-account-status",
    provider: "RAINFOREST",
    capability: "QUOTA_STATUS",
    correlationId: ctx.correlationId,
  });
  try {
    const account = await rainforestGetAccount();
    await updateProviderStatus("RAINFOREST", {
      configured: true,
      success: true,
      latencyMs: account.latencyMs,
      quota: account.data,
    });
    await finishProviderRun(runId, {
      status: "SUCCESS",
      requestCount: 1,
      latencyMs: account.latencyMs,
    });
    if (account.data) {
      const activeCategories = await prisma.amazonCategory.count({
        where: { active: true, leaderboardEnabled: true },
      });
      const forecast = forecastQuota({
        rankIntervalMinutes: ctx.settings.rankIntervalMinutes,
        leaderboardIntervalMinutes: ctx.settings.leaderboardIntervalMinutes,
        activeLeaderboardCategories: activeCategories,
        metadataIntervalMinutes: ctx.settings.metadataIntervalMinutes,
        accountStatusIntervalMinutes: ctx.settings.accountStatusIntervalMinutes,
        salesEstimationEnabled: ctx.settings.salesEstimationEnabled,
        creditsRemaining: account.data.creditsRemaining,
        creditsLimit: account.data.creditsLimit,
        creditsResetAt: account.data.creditsResetAt ? new Date(account.data.creditsResetAt) : null,
        now: ctx.now,
        dailyCreditBudget: ctx.settings.dailyCreditBudget,
      });
      if (forecast.warnLevel !== "ok") {
        await alertCreditLevel({
          warnLevel: forecast.warnLevel,
          creditsRemaining: account.data.creditsRemaining,
          creditsLimit: account.data.creditsLimit,
        });
      }
    }
    return { status: "SUCCESS", detail: "Account-Status aktualisiert." };
  } catch (error) {
    await finishProviderRun(runId, { status: "FAILED", safeErrorMessage: safeErrorMessage(error) });
    await updateProviderStatus("RAINFOREST", { configured: true, success: false });
    return { status: "FAILED", detail: safeErrorMessage(error, 120) };
  }
}

// ---------------------------------------------------------------------------
// Job: Digest + Cleanup
// ---------------------------------------------------------------------------

async function jobSendDailyDigest(ctx: JobContext): Promise<JobOutcome> {
  if (!ctx.settings.digestEnabled) {
    return { status: "SKIPPED", detail: "Digest deaktiviert." };
  }
  const { editionId } = await ensurePrimaryBook();
  const result = await runDailyDigest({
    editionId,
    timezone: ctx.settings.timezone,
    digestTime: ctx.settings.digestTime,
    recipient: ctx.settings.digestRecipient,
    now: ctx.now,
  });
  const detailMap: Record<string, string> = {
    sent: "Digest erstellt.",
    skipped_already_sent: "Heute bereits versendet.",
    skipped_not_due: "Noch nicht fällig (vor Digest-Uhrzeit).",
    failed: "Digest fehlgeschlagen.",
  };
  return {
    status: result.status === "sent" ? "SUCCESS" : result.status === "failed" ? "FAILED" : "SKIPPED",
    detail: detailMap[result.status] ?? result.status,
  };
}

async function jobCleanupPayloads(ctx: JobContext): Promise<JobOutcome> {
  const deleted = await cleanupRawPayloads(ctx.settings.rawPayloadRetentionDays);
  let observationNote = "";
  if (ctx.settings.rankRetentionDays > 0) {
    const cutoff = new Date(Date.now() - ctx.settings.rankRetentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.amazonRankObservation.deleteMany({
      where: { observedAt: { lt: cutoff } },
    });
    observationNote = `, ${result.count} alte Beobachtungen`;
  }
  return { status: "SUCCESS", detail: `${deleted} Rohpayloads gelöscht${observationNote}.` };
}

// ---------------------------------------------------------------------------
// Registry + Scheduler
// ---------------------------------------------------------------------------

const JOB_DEFINITIONS: JobDefinition[] = [
  {
    type: "refresh-primary-book-ranks",
    intervalMinutes: (s) => s.rankIntervalMinutes,
    runsWhenDisabled: false,
    run: jobRefreshPrimaryBookRanks,
  },
  {
    type: "refresh-category-leaderboards",
    intervalMinutes: (s) => s.leaderboardIntervalMinutes,
    runsWhenDisabled: false,
    run: jobRefreshCategoryLeaderboards,
  },
  {
    type: "refresh-product-metadata",
    intervalMinutes: (s) => s.metadataIntervalMinutes,
    runsWhenDisabled: false,
    run: jobRefreshProductMetadata,
  },
  {
    type: "resolve-amazon-categories",
    intervalMinutes: () => 1_440,
    runsWhenDisabled: false,
    run: jobResolveCategories,
  },
  {
    type: "refresh-provider-health",
    intervalMinutes: (s) => s.healthIntervalMinutes,
    runsWhenDisabled: true,
    run: jobRefreshProviderHealth,
  },
  {
    type: "refresh-rainforest-account-status",
    intervalMinutes: (s) => s.accountStatusIntervalMinutes,
    runsWhenDisabled: false,
    run: jobRefreshRainforestAccount,
  },
  {
    type: "send-daily-ranking-digest",
    intervalMinutes: () => 30,
    runsWhenDisabled: false,
    run: jobSendDailyDigest,
  },
  {
    type: "cleanup-provider-payloads",
    intervalMinutes: () => 1_440,
    runsWhenDisabled: true,
    run: jobCleanupPayloads,
  },
];

export function getJobDefinition(jobType: string): JobDefinition | null {
  return JOB_DEFINITIONS.find((j) => j.type === jobType) ?? null;
}

/** Lock über bedingtes UPDATE erwerben (verteilter Lock). */
async function acquireJobLock(jobType: string, owner: string, now: Date): Promise<boolean> {
  await prisma.amazonJobState.upsert({
    where: { jobType },
    update: {},
    create: { jobType },
  });
  const result = await prisma.amazonJobState.updateMany({
    where: {
      jobType,
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    data: {
      lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
      lockOwner: owner,
    },
  });
  return result.count === 1;
}

async function releaseJobLock(
  jobType: string,
  owner: string,
  data: { lastStatus: AmazonRunStatus; nextRunAt: Date },
): Promise<void> {
  await prisma.amazonJobState.updateMany({
    where: { jobType, lockOwner: owner },
    data: {
      lockedUntil: null,
      lockOwner: null,
      lastRunAt: new Date(),
      lastStatus: data.lastStatus,
      nextRunAt: data.nextRunAt,
    },
  });
}

export interface RunJobResult {
  jobType: string;
  status: AmazonRunStatus | "LOCKED" | "NOT_DUE" | "DISABLED";
  detail: string;
}

/** Führt einen einzelnen Job aus (mit Lock; force = manuelle Auslösung). */
export async function runAmazonJob(
  jobType: AmazonJobType,
  options: { force?: boolean; actor?: string } = {},
): Promise<RunJobResult> {
  const definition = getJobDefinition(jobType);
  if (!definition) return { jobType, status: "FAILED", detail: "Unbekannter Job." };
  const settings = await getAmazonSettings();
  const now = new Date();

  if (!settings.enabled && !definition.runsWhenDisabled && !options.force) {
    return { jobType, status: "DISABLED", detail: "Modul deaktiviert (AMAZON_RANKING_ENABLED)." };
  }

  const state = await prisma.amazonJobState.findUnique({ where: { jobType } });
  if (!options.force) {
    if (state && state.enabled === false) {
      return { jobType, status: "DISABLED", detail: "Job deaktiviert." };
    }
    if (state?.nextRunAt && state.nextRunAt > now) {
      return { jobType, status: "NOT_DUE", detail: `Fällig ab ${state.nextRunAt.toISOString()}.` };
    }
  } else {
    // Manuelle Auslösung: Rate-Limit gegen versehentliche Doppel-Klicks
    const recentManual = await prisma.amazonProviderRun.findFirst({
      where: {
        jobType,
        startedAt: { gte: new Date(now.getTime() - MANUAL_RATE_LIMIT_MS) },
        correlationId: { startsWith: "manual:" },
      },
      select: { id: true },
    });
    if (recentManual) {
      return {
        jobType,
        status: "LOCKED",
        detail: "Manueller Refresh wurde gerade erst ausgeführt (Rate-Limit 2 Minuten).",
      };
    }
  }

  const correlationId = `${options.force ? "manual" : "cron"}:${randomUUID()}`;
  if (!(await acquireJobLock(jobType, correlationId, now))) {
    return { jobType, status: "LOCKED", detail: "Job läuft bereits (Lock aktiv)." };
  }

  const intervalMinutes = state?.intervalMinutes ?? definition.intervalMinutes(settings);
  let outcome: JobOutcome = { status: "FAILED", detail: "Nicht ausgeführt." };
  try {
    outcome = await definition.run({
      settings,
      correlationId,
      manual: options.force === true,
      now,
    });
  } catch (error) {
    outcome = { status: "FAILED", detail: safeErrorMessage(error, 200) };
    logger.error("amazon.job_failed", { jobType, message: safeErrorMessage(error, 200) });
  } finally {
    await releaseJobLock(jobType, correlationId, {
      lastStatus: outcome.status,
      nextRunAt: new Date(now.getTime() + intervalMinutes * 60 * 1000),
    });
  }
  logger.info("amazon.job_finished", { jobType, status: outcome.status, manual: options.force === true });
  return { jobType, status: outcome.status, detail: outcome.detail };
}

/** Führt alle fälligen Jobs aus (Scheduler-Tick). */
export async function runDueAmazonJobs(): Promise<RunJobResult[]> {
  const results: RunJobResult[] = [];
  for (const jobType of AMAZON_JOB_TYPES) {
    results.push(await runAmazonJob(jobType));
  }
  return results;
}
