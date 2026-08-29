import { describe, expect, it } from "vitest";
import {
  dedupeEntries,
  diffLeaderboard,
  leaderboardAggregates,
  type LeaderboardEntryInput,
} from "@/lib/amazon/leaderboard-math";

function entry(position: number, asin: string, extra: Partial<LeaderboardEntryInput> = {}): LeaderboardEntryInput {
  return { position, bestsellerRank: position, asin, ...extra };
}

describe("diffLeaderboard", () => {
  const previous = [entry(1, "A"), entry(2, "B"), entry(3, "C"), entry(4, "D")];

  it("berechnet leaderboardMovement = previousPosition - currentPosition", () => {
    const current = [entry(1, "B"), entry(2, "A"), entry(3, "C")];
    const diff = diffLeaderboard(current, previous);
    const b = diff.entries.find((e) => e.asin === "B")!;
    expect(b.change).toEqual({ kind: "up", movement: 1 }); // 2 → 1 = Aufstieg
    const a = diff.entries.find((e) => e.asin === "A")!;
    expect(a.change).toEqual({ kind: "down", movement: -1 }); // 1 → 2 = Abstieg
    const c = diff.entries.find((e) => e.asin === "C")!;
    expect(c.change).toEqual({ kind: "same" });
    expect(diff.exits).toEqual(["D"]);
  });

  it("unterscheidet Neueinsteiger und Wiedereinsteiger", () => {
    const current = [entry(1, "A"), entry(2, "NEU"), entry(3, "ALT")];
    const diff = diffLeaderboard(current, previous, new Set(["ALT"]));
    expect(diff.newEntries).toEqual(["NEU"]);
    expect(diff.reEntries).toEqual(["ALT"]);
  });

  it("erste Messung: alle Einträge NEU, kein Turnover", () => {
    const diff = diffLeaderboard([entry(1, "A")], null);
    expect(diff.entries[0]!.change.kind).toBe("new");
    expect(diff.turnover).toBeNull();
  });

  it("berechnet Turnover und größte Auf-/Absteiger", () => {
    const current = [entry(1, "C"), entry(2, "NEU1"), entry(3, "A"), entry(4, "NEU2")];
    const diff = diffLeaderboard(current, previous);
    expect(diff.turnover).toBeCloseTo(2 / 4, 5);
    expect(diff.biggestClimber).toEqual({ asin: "C", movement: 2 });
    expect(diff.biggestFaller).toEqual({ asin: "A", movement: -2 });
  });
});

describe("dedupeEntries", () => {
  it("entfernt Duplikate ohne die Reihenfolge zu verändern und begrenzt auf 25", () => {
    const entries = [
      ...Array.from({ length: 26 }, (_, i) => entry(i + 1, i === 25 ? "X3" : `X${i + 1}`)),
    ];
    // Duplikat an Position 26 (ASIN X3)
    const result = dedupeEntries(entries, 25);
    expect(result).toHaveLength(25);
    expect(result.map((e) => e.asin)).toEqual(
      Array.from({ length: 25 }, (_, i) => `X${i + 1}`),
    );
  });

  it("erfindet keine fehlenden Plätze", () => {
    const result = dedupeEntries([entry(1, "A"), entry(2, "A"), entry(3, "B")], 25);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.asin)).toEqual(["A", "B"]);
  });
});

describe("leaderboardAggregates", () => {
  it("berechnet Bewertungs-, Preis- und Vorbestellkennzahlen", () => {
    const entries = [
      entry(1, "A", { rating: 4, reviewCount: 100, price: 10, preorder: true, imageUrl: "x" }),
      entry(2, "B", { rating: 5, reviewCount: 300, price: 20, preorder: false, imageUrl: "y" }),
      entry(3, "C", { rating: null, reviewCount: 200, price: 30, preorder: false, imageUrl: null }),
    ];
    const agg = leaderboardAggregates(entries, 25);
    expect(agg.averageRating).toBeCloseTo(4.5, 5);
    expect(agg.medianReviewCount).toBe(200);
    expect(agg.averagePrice).toBeCloseTo(20, 5);
    expect(agg.medianPrice).toBe(20);
    expect(agg.priceRange).toEqual({ min: 10, max: 30 });
    expect(agg.preorderShare).toBeCloseTo(1 / 3, 5);
    expect(agg.missingCovers).toBe(1);
    expect(agg.completeness).toBeCloseTo(3 / 25, 5);
  });

  it("liefert null-Werte bei leeren Daten", () => {
    const agg = leaderboardAggregates([], 25);
    expect(agg.averageRating).toBeNull();
    expect(agg.priceRange).toBeNull();
    expect(agg.completeness).toBe(0);
  });
});
