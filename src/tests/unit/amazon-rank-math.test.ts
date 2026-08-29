import { describe, expect, it } from "vitest";
import {
  bestRank,
  biggestJumps,
  changeOverWindow,
  detectGaps,
  improvementPercent,
  median,
  medianAbsoluteDeviation,
  movement,
  numericDelta,
  stddev,
  streaks,
  summarizeSeries,
  thresholdStatus,
  worstRank,
  type RankPoint,
} from "@/lib/amazon/rank-math";

const HOUR = 60 * 60 * 1000;

function point(hoursAgo: number, rank: number | null, now = new Date("2026-08-29T12:00:00Z")): RankPoint {
  return { observedAt: new Date(now.getTime() - hoursAgo * HOUR), rank };
}

describe("movement & improvementPercent (kleiner = besser)", () => {
  it("berechnet die manuellen Beispielstände exakt", () => {
    // Bücher gesamt: 12.484 → 9.350
    expect(movement(12_484, 9_350)).toBe(3_134);
    expect(improvementPercent(12_484, 9_350)).toBeCloseTo(25.1041, 3);
    // Präsentationen: 16 → 14
    expect(movement(16, 14)).toBe(2);
    expect(improvementPercent(16, 14)).toBeCloseTo(12.5, 5);
    // E-Business: 33 → 22
    expect(movement(33, 22)).toBe(11);
    expect(improvementPercent(33, 22)).toBeCloseTo(33.3333, 3);
    // Biografien von Geschäftsleuten: 42 → 23
    expect(movement(42, 23)).toBe(19);
    expect(improvementPercent(42, 23)).toBeCloseTo(45.2381, 3);
  });

  it("positive movement = Verbesserung, negative = Verschlechterung", () => {
    expect(movement(100, 50)).toBe(50); // besser
    expect(movement(50, 100)).toBe(-50); // schlechter
    expect(movement(50, 50)).toBe(0);
    expect(numericDelta(50, 100)).toBe(-50);
  });

  it("berechnet nichts bei fehlenden Werten oder Division durch 0", () => {
    expect(movement(null, 10)).toBeNull();
    expect(movement(10, null)).toBeNull();
    expect(improvementPercent(null, 10)).toBeNull();
    expect(improvementPercent(0, 10)).toBeNull();
    expect(improvementPercent(10, null)).toBeNull();
  });
});

describe("Statistik-Helfer", () => {
  it("median, stddev, MAD", () => {
    expect(median([1, 3, 5])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(stddev([2, 2, 2])).toBe(0);
    expect(stddev([1, 3])).toBeCloseTo(1, 5);
    expect(medianAbsoluteDeviation([1, 2, 3, 4, 5])).toBe(1);
  });
});

describe("bestRank / worstRank", () => {
  it("bester = kleinster, schlechtester = größter (mit Zeitpunkt des ersten Erreichens)", () => {
    const points = [point(3, 100), point(2, 40), point(1, 40), point(0, 80)];
    const best = bestRank(points);
    expect(best?.rank).toBe(40);
    expect(best?.observedAt).toEqual(points[1]!.observedAt);
    expect(worstRank(points)?.rank).toBe(100);
  });

  it("ignoriert Datenlücken", () => {
    expect(bestRank([point(1, null)])).toBeNull();
  });
});

describe("changeOverWindow", () => {
  const now = new Date("2026-08-29T12:00:00Z");
  const points = [point(30, 200), point(20, 150), point(5, 120), point(1, 100)];

  it("vergleicht ältesten und neuesten Wert im Fenster", () => {
    const change = changeOverWindow(points, now, 24 * HOUR);
    expect(change.fromRank).toBe(150);
    expect(change.toRank).toBe(100);
    expect(change.movement).toBe(50);
  });

  it("liefert null-Werte bei leerem Fenster", () => {
    const change = changeOverWindow(points, now, HOUR / 2);
    expect(change.movement).toBeNull();
  });

  it("fehlgeschlagene Messungen zählen nicht als Referenz", () => {
    const withGap = [point(10, null), point(1, 100)];
    const change = changeOverWindow(withGap, now, 24 * HOUR);
    expect(change.fromRank).toBe(100);
    expect(change.movement).toBe(0);
  });
});

describe("streaks & jumps", () => {
  it("erkennt Verbesserungs- und Verschlechterungsserien", () => {
    // 100 → 90 → 80 → 85 → 70 → 60
    const points = [point(5, 100), point(4, 90), point(3, 80), point(2, 85), point(1, 70), point(0, 60)];
    const result = streaks(points);
    expect(result.longestImprovement).toBe(2);
    expect(result.longestDecline).toBe(1);
    expect(result.current).toBe(2);
  });

  it("findet größte Sprünge", () => {
    const points = [point(3, 100), point(2, 40), point(1, 90), point(0, 85)];
    const jumps = biggestJumps(points);
    expect(jumps.biggestImprovement?.movement).toBe(60);
    expect(jumps.biggestDecline?.movement).toBe(-50);
  });
});

describe("detectGaps", () => {
  it("zählt Lücken über dem 2,5-fachen Intervall", () => {
    const points = [point(10, 100), point(9, 99), point(2, 90), point(1, 89)];
    const gaps = detectGaps(points, HOUR);
    expect(gaps.count).toBe(1);
    expect(gaps.longestMs).toBe(7 * HOUR);
  });

  it("null-Messungen erzeugen Lücken zwischen erfolgreichen Messungen", () => {
    const points = [point(5, 100), point(4, null), point(3, null), point(0, 90)];
    expect(detectGaps(points, HOUR).count).toBe(1);
  });
});

describe("thresholdStatus", () => {
  it("erster Eintritt, Verweildauer und aktueller Status", () => {
    // 12 → 8 → 9 → 15 (Schwelle 10)
    const points = [point(3, 12), point(2, 8), point(1, 9), point(0, 15)];
    const status = thresholdStatus(points, 10, HOUR);
    expect(status.reached).toBe(true);
    expect(status.firstReachedAt).toEqual(points[1]!.observedAt);
    expect(status.currentlyIn).toBe(false);
    expect(status.totalDurationMs).toBe(HOUR); // nur Segment 8→9
  });

  it("nie erreicht", () => {
    const status = thresholdStatus([point(1, 500)], 10, HOUR);
    expect(status.reached).toBe(false);
    expect(status.firstReachedAt).toBeNull();
  });
});

describe("summarizeSeries", () => {
  const now = new Date("2026-08-29T12:00:00Z");

  it("liefert vollständige Kennzahlen inkl. Vollständigkeit", () => {
    const points = [point(4, 200), point(3, null), point(2, 150), point(1, 100)];
    const summary = summarizeSeries(points, { now, expectedIntervalMs: HOUR });
    expect(summary.count).toBe(4);
    expect(summary.successCount).toBe(3);
    expect(summary.missingCount).toBe(1);
    expect(summary.completenessPercent).toBeCloseTo(75, 5);
    expect(summary.current?.rank).toBe(100);
    expect(summary.previous?.rank).toBe(150);
    expect(summary.movement).toBe(50);
    expect(summary.best?.rank).toBe(100);
    expect(summary.worst?.rank).toBe(200);
    expect(summary.velocityPerHour).toBeCloseTo(100 / 3, 3);
    expect(summary.velocityPerDay).toBeCloseTo(800, 1);
  });

  it("leere Serie erzeugt keine Berechnungen", () => {
    const summary = summarizeSeries([], { now, expectedIntervalMs: HOUR });
    expect(summary.current).toBeNull();
    expect(summary.movement).toBeNull();
    expect(summary.completenessPercent).toBeNull();
  });
});
