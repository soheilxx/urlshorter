import { describe, expect, it } from "vitest";
import { parseCreatorsGetItems } from "@/lib/amazon/providers/creators-parse";
import {
  parseRainforestAccount,
  parseRainforestBestsellers,
  parseRainforestCategories,
  parseRainforestProductMetadata,
  parseRainforestProductRanks,
  parseRequestInfo,
} from "@/lib/amazon/providers/rainforest-parse";
import {
  CREATORS_GETITEMS_ITEM_ERROR,
  CREATORS_GETITEMS_NO_RANKS,
  CREATORS_GETITEMS_SUCCESS,
} from "@/tests/fixtures/amazon/creators-fixtures";
import {
  RAINFOREST_ACCOUNT_SUCCESS,
  RAINFOREST_BESTSELLERS_PARTIAL,
  RAINFOREST_BESTSELLERS_SUCCESS,
  RAINFOREST_CATEGORIES_SACHBUECHER,
  RAINFOREST_ERROR_NO_CREDITS,
  RAINFOREST_PRODUCT_NO_RANK,
  RAINFOREST_PRODUCT_SUCCESS,
} from "@/tests/fixtures/amazon/rainforest-fixtures";

// ---------------------------------------------------------------------------
// Amazon Creators API – Contract-Tests
// ---------------------------------------------------------------------------

describe("parseCreatorsGetItems", () => {
  it("extrahiert websiteSalesRank und Kategorienränge inkl. Ancestor-Pfaden", () => {
    const result = parseCreatorsGetItems(CREATORS_GETITEMS_SUCCESS);
    expect(result.ranks).toHaveLength(1);
    const ranks = result.ranks[0]!;
    expect(ranks.asin).toBe("3690662508");
    expect(ranks.websiteSalesRank).toBe(12_484);
    expect(ranks.websiteDisplayGroup).toBe("Bücher");
    expect(ranks.categoryRanks).toHaveLength(3);
    const praesentationen = ranks.categoryRanks.find((c) => c.providerCategoryId === "686022031")!;
    expect(praesentationen.rank).toBe(16);
    expect(praesentationen.categoryPath).toBe("Bücher › Business & Karriere › Präsentationen");
    expect(ranks.categoryRanks.map((c) => c.rank)).toEqual([16, 33, 42]);
  });

  it("extrahiert Metadaten (Titel, Autor, ISBNs, Cover, Preis, Vorbestellstatus)", () => {
    const result = parseCreatorsGetItems(CREATORS_GETITEMS_SUCCESS);
    const meta = result.metadata[0]!;
    expect(meta.title).toBe("Die Lizenz zum Erfolg");
    expect(meta.author).toBe("Soheil Hosseini");
    expect(meta.publisher).toBe("Deutscher Wirtschaftsbuch Verlag");
    expect(meta.format).toBe("Taschenbuch");
    expect(meta.isbn10).toBe("3690662508");
    expect(meta.isbn13).toBe("9783690662505");
    expect(meta.coverLargeUrl).toContain("m.media-amazon.com");
    expect(meta.price).toBe(18);
    expect(meta.currency).toBe("EUR");
    expect(meta.preorder).toBe(true);
  });

  it("fehlender websiteSalesRank und Nodes ohne Rang → null bzw. ausgelassen", () => {
    const result = parseCreatorsGetItems(CREATORS_GETITEMS_NO_RANKS);
    const ranks = result.ranks[0]!;
    expect(ranks.websiteSalesRank).toBeNull();
    expect(ranks.categoryRanks).toHaveLength(0); // Node ohne salesRank fällt raus
  });

  it("meldet nicht zugängliche Items über den Errors-Container", () => {
    const result = parseCreatorsGetItems(CREATORS_GETITEMS_ITEM_ERROR);
    expect(result.ranks).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.code).toBe("ItemNotAccessible");
    expect(result.errors[0]!.asin).toBe("B000000000");
  });

  it("verkraftet leere/kaputte Payloads", () => {
    expect(parseCreatorsGetItems(null).ranks).toHaveLength(0);
    expect(parseCreatorsGetItems({}).ranks).toHaveLength(0);
    expect(parseCreatorsGetItems("unsinn").ranks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rainforest API – Contract-Tests
// ---------------------------------------------------------------------------

describe("parseRainforestProductRanks", () => {
  it("interpretiert 'Bücher' als Gesamtrang, den Rest als Kategorienränge", () => {
    const ranks = parseRainforestProductRanks(RAINFOREST_PRODUCT_SUCCESS)!;
    expect(ranks.websiteSalesRank).toBe(9_350);
    expect(ranks.categoryRanks).toHaveLength(3);
    const eBusiness = ranks.categoryRanks.find((c) => c.categoryName === "E-Business (Bücher)")!;
    expect(eBusiness.rank).toBe(22);
    expect(eBusiness.providerCategoryId).toBe("403434031"); // aus dem Bestseller-Link
    expect(ranks.providerUpdatedAt).toEqual(new Date("2026-08-29T10:00:04.000Z"));
  });

  it("bestsellers_rank fehlt → keine Ränge, aber kein Fehler", () => {
    const ranks = parseRainforestProductRanks(RAINFOREST_PRODUCT_NO_RANK)!;
    expect(ranks.websiteSalesRank).toBeNull();
    expect(ranks.categoryRanks).toHaveLength(0);
  });
});

describe("parseRainforestProductMetadata", () => {
  it("extrahiert Preis, Bewertung, Verfügbarkeit und Vorbestellstatus", () => {
    const meta = parseRainforestProductMetadata(RAINFOREST_PRODUCT_SUCCESS)!;
    expect(meta.price).toBe(18);
    expect(meta.priceRaw).toBe("18,00 €");
    expect(meta.rating).toBe(4.8);
    expect(meta.reviewCount).toBe(12);
    expect(meta.preorder).toBe(true);
    expect(meta.isbn10).toBe("3690662508");
    expect(meta.isbn13).toBe("9783690662505");
    expect(meta.publisher).toBe("Deutscher Wirtschaftsbuch Verlag");
  });
});

describe("parseRainforestBestsellers", () => {
  it("liefert 25 eindeutige Einträge in Originalreihenfolge (Duplikat entfernt)", () => {
    const board = parseRainforestBestsellers(RAINFOREST_BESTSELLERS_SUCCESS)!;
    expect(board.entries).toHaveLength(25);
    expect(board.complete).toBe(true);
    expect(board.providerCategoryId).toBe("sachbuecher_test");
    // Duplikat (Position 26, ASIN von Platz 3) wurde entfernt, Reihenfolge unverändert
    const asins = board.entries.map((e) => e.asin);
    expect(new Set(asins).size).toBe(25);
    expect(board.entries[2]!.asin).toBe("B0TEST0003");
    expect(board.entries[19]!.asin).toBe("3690662508"); // eigenes Buch auf Platz 20
    expect(board.entries[19]!.bestsellerRank).toBe(20);
  });

  it("markiert Listen mit weniger als 25 Einträgen als partial", () => {
    const board = parseRainforestBestsellers(RAINFOREST_BESTSELLERS_PARTIAL)!;
    expect(board.entries).toHaveLength(18);
    expect(board.complete).toBe(false);
    expect(board.partialReason).toContain("18 von 25");
  });
});

describe("parseRainforestCategories", () => {
  it("liefert alle Treffer mit vollständigen Pfaden (Mehrdeutigkeit sichtbar)", () => {
    const categories = parseRainforestCategories(RAINFOREST_CATEGORIES_SACHBUECHER);
    expect(categories).toHaveLength(2);
    expect(categories[0]!.path).toBe("Bücher > Sachbücher");
    expect(categories[1]!.path).toContain("Kindle");
  });
});

describe("parseRainforestAccount", () => {
  it("übernimmt Quota-Felder, aber NIEMALS api_key oder E-Mail", () => {
    const quota = parseRainforestAccount(RAINFOREST_ACCOUNT_SUCCESS)!;
    expect(quota.plan).toBe("starter");
    expect(quota.creditsRemaining).toBe(14_880);
    expect(quota.creditsLimit).toBe(15_000);
    expect(quota.creditsResetAt).toBe("2026-09-15T00:00:00.000Z");
    expect(quota.overageAllowed).toBe(false);
    expect(quota.platformStatus).toEqual([{ component: "api", status: "operational" }]);
    expect(JSON.stringify(quota)).not.toContain("TESTKEY");
    expect(JSON.stringify(quota)).not.toContain("test@example.com");
  });
});

describe("parseRequestInfo", () => {
  it("liest success und Credits", () => {
    const info = parseRequestInfo(RAINFOREST_PRODUCT_SUCCESS);
    expect(info.success).toBe(true);
    expect(info.creditsUsed).toBe(118);
    expect(info.creditsRemaining).toBe(14_882);
  });

  it("erkennt Fehlerantworten (Credits erschöpft)", () => {
    const info = parseRequestInfo(RAINFOREST_ERROR_NO_CREDITS);
    expect(info.success).toBe(false);
  });
});
