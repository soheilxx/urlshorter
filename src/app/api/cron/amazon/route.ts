import { AMAZON_JOB_TYPES, type AmazonJobType } from "@/lib/amazon/constants";
import { runAmazonJob, runDueAmazonJobs } from "@/lib/amazon/jobs";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Scheduler-Tick des Amazon-Ranking-Moduls: führt alle fälligen
 * Hintergrundjobs aus (Fälligkeit + verteilte Locks in AmazonJobState).
 *
 * Aufrufer: Vercel Cron (Bearer CRON_SECRET) und/oder ein externer Pinger
 * (siehe docs/amazon-ranking-operations.md – auf dem Vercel-Hobby-Plan sind
 * nur tägliche Crons möglich, für stündliches Tracking wird der Endpoint
 * zusätzlich extern angestoßen, z. B. per GitHub-Actions-Workflow).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

/**
 * Sicherer Modul-Status (keine Secrets): für die kontrollierte
 * Produktionsprüfung nach dem Rollout (?summary=1).
 */
async function buildClicksDebug(): Promise<Record<string, unknown> | null> {
  const { buildEditionClickStats } = await import("@/lib/amazon/clicks");
  const edition = await prisma.amazonEdition.findFirst({ orderBy: { createdAt: "asc" } });
  if (!edition) return null;
  const stats = await buildEditionClickStats(edition);
  return {
    trackedShortCode: edition.trackedShortCode,
    shortLinks: stats.shortLinks,
    windows: stats.windows,
    bySource: stats.bySource,
    byShortLink: stats.byShortLink,
  };
}

async function buildStatusSummary(): Promise<Record<string, unknown>> {
  const [edition, categories, providerStatuses, latestCanonical, leaderboards, lastRuns] =
    await Promise.all([
      prisma.amazonEdition.findFirst({
        select: {
          asin: true,
          asinValidated: true,
          asinValidationProvider: true,
          preorder: true,
          currentPrice: true,
          currency: true,
          currentAvailability: true,
          currentRating: true,
          currentReviewCount: true,
          metadataProvider: true,
        },
      }),
      prisma.amazonCategory.findMany({
        select: {
          canonicalName: true,
          categoryType: true,
          active: true,
          leaderboardEnabled: true,
          resolutionStatus: true,
          providerMappings: {
            select: { provider: true, providerCategoryId: true, verified: true },
          },
        },
      }),
      prisma.amazonProviderStatus.findMany({
        select: {
          provider: true,
          configured: true,
          healthy: true,
          consecutiveFailures: true,
          circuitBreakerState: true,
          currentLatencyMs: true,
          lastSuccessAt: true,
        },
      }),
      prisma.amazonCanonicalRankSnapshot.findMany({
        orderBy: { observedAt: "desc" },
        take: 20,
        select: {
          observedAt: true,
          canonicalRank: true,
          selectedProvider: true,
          selectionReason: true,
          stale: true,
          dataGap: true,
          category: { select: { canonicalName: true } },
        },
      }),
      prisma.amazonLeaderboardSnapshot.findMany({
        orderBy: { observedAt: "desc" },
        take: 10,
        select: {
          observedAt: true,
          returnedCount: true,
          complete: true,
          category: { select: { canonicalName: true } },
        },
      }),
      prisma.amazonProviderRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 15,
        select: {
          jobType: true,
          provider: true,
          status: true,
          errorClass: true,
          safeErrorMessage: true,
          httpStatus: true,
          creditsUsed: true,
          creditsRemaining: true,
          latencyMs: true,
          startedAt: true,
        },
      }),
    ]);
  return {
    edition,
    categories,
    providerStatuses,
    latestCanonical,
    leaderboards,
    lastRuns,
  };
}

async function handle(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json(
      { error: "Nicht autorisiert." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("summary") === "1") {
      const summary = await buildStatusSummary();
      return Response.json(
        { ok: true, summary },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (url.searchParams.get("clicks") === "1") {
      const clicks = await buildClicksDebug();
      return Response.json(
        { ok: true, clicks },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    // Ops-Diagnose (CRON_SECRET-geschützt, redigierte Daten):
    // ?search=Begriff → Rainforest-Kategoriensuche, ?children=ID → Kinderliste
    const searchTerm = url.searchParams.get("search");
    const childrenOf = url.searchParams.get("children");
    if (searchTerm || childrenOf !== null) {
      const { rainforestListCategories, rainforestSearchCategories } = await import(
        "@/lib/amazon/providers/rainforest"
      );
      const { safeErrorMessage } = await import("@/lib/amazon/redact");
      try {
        const result = searchTerm
          ? await rainforestSearchCategories(searchTerm)
          : await rainforestListCategories(childrenOf || null);
        return Response.json(
          { ok: true, categories: result.data },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch (error) {
        return Response.json(
          { ok: false, error: safeErrorMessage(error) },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    const singleJob = url.searchParams.get("job");
    if (singleJob) {
      if (!(AMAZON_JOB_TYPES as readonly string[]).includes(singleJob)) {
        return Response.json({ ok: false, error: "Unbekannter Job." }, { status: 400 });
      }
      const result = await runAmazonJob(singleJob as AmazonJobType, { force: true });
      return Response.json(
        { ok: true, results: [result] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const results = await runDueAmazonJobs();
    return Response.json(
      { ok: true, results },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logger.error("cron.amazon_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return Response.json(
      { ok: false, error: "Amazon-Scheduler-Tick fehlgeschlagen." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
