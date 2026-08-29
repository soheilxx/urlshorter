import { CREDIT_WARN_LEVELS } from "@/lib/amazon/constants";

/**
 * Rainforest-Credit-Prognose (rein, unit-getestet).
 * Beispiel laut Vorgabe: eigenes Buch stündlich ≈ 24 Requests/Tag, fünf
 * Kategorien alle 3 h ≈ 40 Leaderboard-Requests/Tag → ≈ 64/Tag, ≈ 1.920/30 Tage.
 */

export interface QuotaForecastInput {
  rankIntervalMinutes: number;
  leaderboardIntervalMinutes: number;
  activeLeaderboardCategories: number;
  metadataIntervalMinutes: number;
  /** Produkt-Requests pro Metadaten-Lauf (i. d. R. 1 – nur Cache-Misses). */
  metadataRequestsPerRun?: number;
  accountStatusIntervalMinutes: number;
  salesEstimationEnabled: boolean;
  /** Ø Credits pro erfolgreichem Request (Standard 1). */
  averageCreditsPerRequest?: number;
  creditsRemaining: number | null;
  creditsLimit: number | null;
  /** Zeitpunkt des Credit-Resets laut Account API. */
  creditsResetAt: Date | null;
  now: Date;
  /** Optionales Tagesbudget (Admin-Einstellung). */
  dailyCreditBudget: number | null;
}

export type CreditWarnLevel = "ok" | "hint" | "warning" | "critical" | "forecast_exceeded";

export interface QuotaForecast {
  productRunsPerDay: number;
  leaderboardRunsPerDay: number;
  metadataRunsPerDay: number;
  accountRunsPerDay: number;
  salesEstimationRunsPerDay: number;
  totalRequestsPerDay: number;
  totalRequestsPerMonth: number;
  projectedCreditsPerDay: number;
  projectedCreditsUntilReset: number | null;
  daysUntilReset: number | null;
  /** Voraussichtlicher Erschöpfungstag bei gleichbleibendem Verbrauch. */
  exhaustionDate: Date | null;
  remainingSharePercent: number | null;
  warnLevel: CreditWarnLevel;
  exceedsDailyBudget: boolean;
}

const MINUTES_PER_DAY = 1_440;

export function forecastQuota(input: QuotaForecastInput): QuotaForecast {
  const perDay = (intervalMinutes: number): number =>
    intervalMinutes > 0 ? MINUTES_PER_DAY / intervalMinutes : 0;

  // Rainforest-Anteil des stündlichen Buchabrufs: 1 Produktrequest pro Lauf
  const productRunsPerDay = Math.round(perDay(input.rankIntervalMinutes));
  const leaderboardRunsPerDay = Math.round(
    perDay(input.leaderboardIntervalMinutes) * input.activeLeaderboardCategories,
  );
  const metadataRunsPerDay =
    Math.round(perDay(input.metadataIntervalMinutes) * (input.metadataRequestsPerRun ?? 1) * 100) /
    100;
  // Account API ist kostenlos – zählt nicht ins Credit-Budget
  const accountRunsPerDay = Math.round(perDay(input.accountStatusIntervalMinutes));
  const salesEstimationRunsPerDay = input.salesEstimationEnabled ? 1 : 0;

  const totalRequestsPerDay =
    productRunsPerDay + leaderboardRunsPerDay + metadataRunsPerDay + salesEstimationRunsPerDay;
  const avgCredits = input.averageCreditsPerRequest ?? 1;
  const projectedCreditsPerDay = totalRequestsPerDay * avgCredits;

  let daysUntilReset: number | null = null;
  let projectedCreditsUntilReset: number | null = null;
  if (input.creditsResetAt !== null) {
    daysUntilReset = Math.max(
      0,
      (input.creditsResetAt.getTime() - input.now.getTime()) / (24 * 60 * 60 * 1000),
    );
    projectedCreditsUntilReset = projectedCreditsPerDay * daysUntilReset;
  }

  let exhaustionDate: Date | null = null;
  if (input.creditsRemaining !== null && projectedCreditsPerDay > 0) {
    const days = input.creditsRemaining / projectedCreditsPerDay;
    exhaustionDate = new Date(input.now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  const remainingSharePercent =
    input.creditsRemaining !== null && input.creditsLimit !== null && input.creditsLimit > 0
      ? (input.creditsRemaining / input.creditsLimit) * 100
      : null;

  let warnLevel: CreditWarnLevel = "ok";
  if (remainingSharePercent !== null) {
    if (remainingSharePercent < CREDIT_WARN_LEVELS.critical * 100) warnLevel = "critical";
    else if (remainingSharePercent < CREDIT_WARN_LEVELS.warning * 100) warnLevel = "warning";
    else if (remainingSharePercent < CREDIT_WARN_LEVELS.hint * 100) warnLevel = "hint";
  }
  if (
    warnLevel === "ok" &&
    projectedCreditsUntilReset !== null &&
    input.creditsRemaining !== null &&
    projectedCreditsUntilReset > input.creditsRemaining
  ) {
    warnLevel = "forecast_exceeded";
  }

  return {
    productRunsPerDay,
    leaderboardRunsPerDay,
    metadataRunsPerDay,
    accountRunsPerDay,
    salesEstimationRunsPerDay,
    totalRequestsPerDay,
    totalRequestsPerMonth: totalRequestsPerDay * 30,
    projectedCreditsPerDay,
    projectedCreditsUntilReset,
    daysUntilReset,
    exhaustionDate,
    remainingSharePercent,
    warnLevel,
    exceedsDailyBudget:
      input.dailyCreditBudget !== null && projectedCreditsPerDay > input.dailyCreditBudget,
  };
}
