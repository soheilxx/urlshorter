import { describe, expect, it } from "vitest";
import { selectCanonical } from "@/lib/amazon/canonical";

const now = new Date("2026-08-29T12:00:00Z");
const fresh = new Date(now.getTime() - 5 * 60 * 1000);
const outdated = new Date(now.getTime() - 6 * 60 * 60 * 1000);
const STALE_AFTER = 3 * 60 * 60 * 1000;

describe("selectCanonical", () => {
  it("wählt Creators, wenn frisch und vollständig", () => {
    const result = selectCanonical({
      creators: { rank: 9350, fetchedAt: fresh },
      rainforest: { rank: 9421, fetchedAt: fresh },
      lastCanonical: null,
      now,
      staleAfterMs: STALE_AFTER,
    });
    expect(result.canonicalRank).toBe(9350);
    expect(result.selectedProvider).toBe("CREATORS");
    expect(result.selectionReason).toBe("creators_fresh");
    expect(result.stale).toBe(false);
    expect(result.providerDifference).toBe(71);
    expect(result.discrepancy).toBe(true);
    expect(result.providerDifferencePercent).toBeCloseTo((71 / 9350) * 100, 4);
  });

  it("fällt auf Rainforest zurück, wenn Creators keinen Rang liefert", () => {
    const result = selectCanonical({
      creators: { rank: null, fetchedAt: fresh },
      rainforest: { rank: 9421, fetchedAt: fresh },
      lastCanonical: null,
      now,
      staleAfterMs: STALE_AFTER,
    });
    expect(result.selectedProvider).toBe("RAINFOREST");
    expect(result.selectionReason).toBe("rainforest_fallback");
  });

  it("fällt auf Rainforest zurück, wenn Creators veraltet ist", () => {
    const result = selectCanonical({
      creators: { rank: 9000, fetchedAt: outdated },
      rainforest: { rank: 9421, fetchedAt: fresh },
      lastCanonical: null,
      now,
      staleAfterMs: STALE_AFTER,
    });
    expect(result.selectedProvider).toBe("RAINFOREST");
  });

  it("partielle Creators-Antwort ist nicht kanonisch", () => {
    const result = selectCanonical({
      creators: { rank: 9000, fetchedAt: fresh, partial: true },
      rainforest: { rank: 9421, fetchedAt: fresh },
      lastCanonical: null,
      now,
      staleAfterMs: STALE_AFTER,
    });
    expect(result.selectedProvider).toBe("RAINFOREST");
  });

  it("nutzt den letzten kanonischen Wert als stale, wenn beide fehlen", () => {
    const result = selectCanonical({
      creators: null,
      rainforest: null,
      lastCanonical: { rank: 9350, observedAt: outdated },
      now,
      staleAfterMs: STALE_AFTER,
    });
    expect(result.canonicalRank).toBe(9350);
    expect(result.selectedProvider).toBeNull();
    expect(result.selectionReason).toBe("stale_last_value");
    expect(result.stale).toBe(true);
    expect(result.dataGap).toBe(false);
  });

  it("meldet Datenlücke ohne jeglichen Vorwert (niemals Rang 0)", () => {
    const result = selectCanonical({
      creators: null,
      rainforest: null,
      lastCanonical: null,
      now,
      staleAfterMs: STALE_AFTER,
    });
    expect(result.canonicalRank).toBeNull();
    expect(result.dataGap).toBe(true);
    expect(result.selectionReason).toBe("data_gap");
  });

  it("Rang 0 wird nie als gültiger Wert akzeptiert", () => {
    const result = selectCanonical({
      creators: { rank: 0, fetchedAt: fresh },
      rainforest: null,
      lastCanonical: null,
      now,
      staleAfterMs: STALE_AFTER,
    });
    expect(result.canonicalRank).toBeNull();
    expect(result.dataGap).toBe(true);
  });

  it("respektiert die umgekehrte Priorität (rainforest_first)", () => {
    const result = selectCanonical({
      creators: { rank: 9350, fetchedAt: fresh },
      rainforest: { rank: 9421, fetchedAt: fresh },
      lastCanonical: null,
      now,
      staleAfterMs: STALE_AFTER,
      priority: "rainforest_first",
    });
    expect(result.selectedProvider).toBe("RAINFOREST");
    expect(result.selectionReason).toBe("rainforest_fresh");
  });

  it("gleiche Werte beider Provider sind keine Abweichung", () => {
    const result = selectCanonical({
      creators: { rank: 100, fetchedAt: fresh },
      rainforest: { rank: 100, fetchedAt: fresh },
      lastCanonical: null,
      now,
      staleAfterMs: STALE_AFTER,
    });
    expect(result.providerDifference).toBe(0);
    expect(result.discrepancy).toBe(false);
  });
});
