import { describe, expect, it } from "vitest";
import {
  CARDS_ANNOUNCEMENT_DATE,
  CARDS_CARDMARKET_COUNT,
  CARDS_CARDMARKET_TOTAL_EUR,
  CARDS_CARDMARKET_TOTAL_LABEL,
  CARDS_ENTRY_DEADLINE_EXCLUSIVE,
  CARDS_MAIN_PRIZE,
  CARDS_PRIZE_COUNT,
  CARDS_PRIZE_SCOPE,
  CARDS_PRIZES,
  CARDS_SHARE_TEXT,
  CARDS_SHARE_TEXT_CLOSED,
  CARDS_TERMS_VERSION,
  CARDS_URL,
  cardsAmazonCtaLabel,
  cardsPrizeFullLabel,
  cardsPrizeOverviewLabel,
  getCardsPhase,
} from "@/lib/cards-giveaway-config";
import {
  campaignForEntryPath,
  campaignPrize,
  getCampaign,
  isCampaignId,
  SWEEPSTAKES_CAMPAIGNS,
} from "@/lib/sweepstakes-campaign";

describe("Cards-Gewinnspiel: Gewinnumfang (exakt laut Briefing)", () => {
  it("enthält genau 1 OP-17 Case, 3 Fusion-World-Booster-Boxen, 3 Magnificent-Monsters-EU-Cases und 10 Gutscheine à 100 €", () => {
    const byId = Object.fromEntries(CARDS_PRIZES.map((p) => [p.id, p]));
    expect(byId.op17_case?.count).toBe(1);
    expect(byId.op17_case?.unit).toBe("One Piece OP-17 Case");
    expect(byId.op17_case?.main).toBe(true);
    expect(byId.fusion_world_st01_box?.count).toBe(3);
    expect(byId.fusion_world_st01_box?.productCode).toBe("ST01");
    expect(byId.fusion_world_st01_box?.unit).toContain("Booster Box");
    expect(byId.fusion_world_st01_box?.franchise).toContain("Fusion World");
    expect(byId.magnificent_monsters_eu_case?.count).toBe(3);
    expect(byId.magnificent_monsters_eu_case?.variant).toBe("EU Version");
    expect(byId.magnificent_monsters_eu_case?.unit).toContain("Case");
    expect(byId.cardmarket_100?.count).toBe(10);
    expect(byId.cardmarket_100?.valueEurPerUnit).toBe(100);
    expect(CARDS_PRIZES.filter((p) => p.main)).toHaveLength(1);
    expect(CARDS_MAIN_PRIZE.id).toBe("op17_case");
  });

  it("leitet 17 Gewinne und 1.000 € Cardmarket-Gutscheinwert ab – ohne erfundenen Gesamtmarktwert", () => {
    expect(CARDS_PRIZE_COUNT).toBe(17);
    expect(CARDS_CARDMARKET_COUNT).toBe(10);
    expect(CARDS_CARDMARKET_TOTAL_EUR).toBe(1000);
    expect(CARDS_CARDMARKET_TOTAL_LABEL).toBe("1.000 €");
    // Sachgewinne tragen bewusst keinen Wert
    expect(
      CARDS_PRIZES.filter((p) => p.id !== "cardmarket_100").every(
        (p) => p.valueEurPerUnit === null,
      ),
    ).toBe(true);
    expect(CARDS_PRIZE_SCOPE).toContain("1×OP-17 Case");
    expect(CARDS_PRIZE_SCOPE).toContain("10×100 € Cardmarket");
    expect(CARDS_PRIZE_SCOPE).toContain(CARDS_TERMS_VERSION);
  });

  it("formatiert Mengen immer sichtbar vor der Einheit", () => {
    expect(CARDS_PRIZES.map(cardsPrizeOverviewLabel)).toEqual([
      "1 × OP-17 Case",
      "3 × Fusion World Booster Box",
      "3 × Magnificent Monsters EU Case",
      "10 × 100 € Cardmarket",
    ]);
    expect(cardsPrizeFullLabel(CARDS_PRIZES[1]!)).toBe(
      "3 × Story Booster 01 Booster Box Fusion World (ST01)",
    );
    expect(cardsPrizeFullLabel(CARDS_PRIZES[2]!)).toBe("3 × Magnificent Monsters EU Version Case");
  });
});

describe("Cards-Gewinnspiel: Fristen (Europe/Berlin)", () => {
  it("exklusive Servergrenze ist 2026-10-05T22:00:00.000Z, Bekanntgabe am 12.10.2026 ohne Uhrzeit", () => {
    expect(CARDS_ENTRY_DEADLINE_EXCLUSIVE.toISOString()).toBe("2026-10-05T22:00:00.000Z");
    expect(CARDS_ANNOUNCEMENT_DATE.toISOString()).toBe("2026-10-11T22:00:00.000Z");
  });

  it("die volle Schlussminute zählt, ab Mitternacht MESZ ist geschlossen, ab dem Bekanntgabetag 'announced'", () => {
    expect(getCardsPhase(new Date("2026-09-18T10:00:00+02:00"))).toBe("open");
    expect(getCardsPhase(new Date("2026-10-05T23:59:59.999+02:00"))).toBe("open");
    expect(getCardsPhase(new Date("2026-10-06T00:00:00.000+02:00"))).toBe("closed");
    expect(getCardsPhase(new Date("2026-10-11T23:59:59+02:00"))).toBe("closed");
    expect(getCardsPhase(new Date("2026-10-12T00:00:00+02:00"))).toBe("announced");
  });

  it("CTA-Wortlaut folgt dem Erscheinungstermin des Buches", () => {
    expect(cardsAmazonCtaLabel(new Date("2026-10-05T12:00:00+02:00"))).toBe(
      "Buch bei Amazon vorbestellen",
    );
    expect(cardsAmazonCtaLabel(new Date("2026-10-06T00:00:00+02:00"))).toBe(
      "Buch bei Amazon kaufen",
    );
  });
});

describe("Cards-Gewinnspiel: Teilen und Kampagnenregister", () => {
  it("Share-Text nennt die Gewinne, die Spende und endet auf der kanonischen URL ohne Parameter", () => {
    expect(CARDS_URL).toBe("https://lizenzzumerfolg.com/cards");
    expect(CARDS_SHARE_TEXT).toContain("OP-17 Case");
    expect(CARDS_SHARE_TEXT).toContain("17 Gewinne");
    expect(CARDS_SHARE_TEXT).toContain("10 × 100 € Cardmarket");
    expect(CARDS_SHARE_TEXT).toContain("100 % der Autoreneinnahmen");
    expect(CARDS_SHARE_TEXT.endsWith(CARDS_URL)).toBe(true);
    expect(CARDS_SHARE_TEXT).not.toContain("utm_");
    expect(CARDS_SHARE_TEXT_CLOSED).toContain("beendet");
    expect(CARDS_SHARE_TEXT_CLOSED).toContain("12.10.2026");
  });

  it("ordnet Teilnahmewege eindeutig zu und kennt keinen Fallback", () => {
    expect(campaignForEntryPath("/cards")?.id).toBe("cards_2026");
    expect(campaignForEntryPath("/gewinn")?.id).toBe("dubai_2026");
    expect(campaignForEntryPath("/verlosung")?.id).toBe("dubai_2026");
    expect(campaignForEntryPath("/cards/danke")).toBeNull();
    expect(campaignForEntryPath("/gutschein")).toBeNull();
    expect(campaignForEntryPath(undefined)).toBeNull();
    expect(isCampaignId("cards_2026")).toBe(true);
    expect(isCampaignId("cards")).toBe(false);
    expect(isCampaignId("")).toBe(false);
  });

  it("Gewinnkataloge sind kampagnenrein", () => {
    expect(campaignPrize("cards_2026", "op17_case")?.label).toBe(
      "1 × One Piece OP-17 Case (OP-17)",
    );
    expect(campaignPrize("dubai_2026", "op17_case")).toBeNull();
    expect(campaignPrize("cards_2026", "dubai_reise")).toBeNull();
    expect(campaignPrize("dubai_2026", "dubai_reise")).not.toBeNull();
    expect(campaignPrize("dubai_2026", "voucher_wiresoft_500")?.label).toBe(
      "Wertgutschein Wiresoft 500 €",
    );
    expect(SWEEPSTAKES_CAMPAIGNS.dubai_2026.prizes).toHaveLength(1 + 9);
    expect(getCampaign("cards_2026").termsVersion).toBe(CARDS_TERMS_VERSION);
    expect(getCampaign("cards_2026").entryPaths).toEqual(["/cards"]);
    expect(getCampaign("dubai_2026").entryPaths).toEqual(["/gewinn", "/verlosung"]);
  });
});
