import { describe, expect, it } from "vitest";
import { forecastQuota } from "@/lib/amazon/quota";

const now = new Date("2026-08-29T12:00:00Z");

function baseInput() {
  return {
    rankIntervalMinutes: 60,
    leaderboardIntervalMinutes: 180,
    activeLeaderboardCategories: 5,
    metadataIntervalMinutes: 1440,
    accountStatusIntervalMinutes: 360,
    salesEstimationEnabled: false,
    creditsRemaining: 14_880,
    creditsLimit: 15_000,
    creditsResetAt: new Date("2026-09-15T00:00:00Z"),
    now,
    dailyCreditBudget: null,
  };
}

describe("forecastQuota", () => {
  it("entspricht dem Standardbeispiel: 24 + 40 ≈ 64 Requests/Tag, ≈ 1.920/30 Tage", () => {
    const forecast = forecastQuota(baseInput());
    expect(forecast.productRunsPerDay).toBe(24);
    expect(forecast.leaderboardRunsPerDay).toBe(40);
    expect(forecast.productRunsPerDay + forecast.leaderboardRunsPerDay).toBe(64);
    expect((forecast.productRunsPerDay + forecast.leaderboardRunsPerDay) * 30).toBe(1_920);
    // Gesamtprognose enthält zusätzlich Metadaten-Requests
    expect(forecast.totalRequestsPerDay).toBe(65);
    expect(forecast.accountRunsPerDay).toBe(4); // kostenlos, nicht im Credit-Budget
  });

  it("berechnet Erschöpfungstag und Restlaufzeit", () => {
    const forecast = forecastQuota(baseInput());
    expect(forecast.projectedCreditsPerDay).toBe(65);
    expect(forecast.exhaustionDate).not.toBeNull();
    const days = (forecast.exhaustionDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(14_880 / 65, 1);
    expect(forecast.daysUntilReset).toBeCloseTo(16.5, 1);
  });

  it("Warnstufen: <30 % Hinweis, <20 % Warnung, <10 % kritisch", () => {
    expect(forecastQuota({ ...baseInput(), creditsRemaining: 4_400 }).warnLevel).toBe("hint");
    expect(forecastQuota({ ...baseInput(), creditsRemaining: 2_900 }).warnLevel).toBe("warning");
    expect(forecastQuota({ ...baseInput(), creditsRemaining: 1_400 }).warnLevel).toBe("critical");
    expect(forecastQuota(baseInput()).warnLevel).toBe("ok");
  });

  it("Prognosewarnung, wenn Verbrauch das Restbudget bis zum Reset überschreitet", () => {
    const forecast = forecastQuota({
      ...baseInput(),
      creditsRemaining: 6_000, // 40 % → keine Level-Warnung
      creditsResetAt: new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000),
    });
    expect(forecast.warnLevel).toBe("forecast_exceeded");
  });

  it("erkennt Überschreitung des Tagesbudgets", () => {
    const forecast = forecastQuota({ ...baseInput(), dailyCreditBudget: 50 });
    expect(forecast.exceedsDailyBudget).toBe(true);
    expect(forecastQuota({ ...baseInput(), dailyCreditBudget: 100 }).exceedsDailyBudget).toBe(false);
  });

  it("funktioniert ohne Account-Daten", () => {
    const forecast = forecastQuota({
      ...baseInput(),
      creditsRemaining: null,
      creditsLimit: null,
      creditsResetAt: null,
    });
    expect(forecast.exhaustionDate).toBeNull();
    expect(forecast.remainingSharePercent).toBeNull();
    expect(forecast.warnLevel).toBe("ok");
  });
});
