import { beforeEach, describe, expect, it } from "vitest";
import {
  CARDS_ENTRY_DEADLINE_EXCLUSIVE,
  CARDS_PRIZE_SCOPE,
  CARDS_TERMS_VERSION,
} from "@/lib/cards-giveaway-config";
import { prisma } from "@/lib/db";
import { PRIZE_SCOPE, TERMS_VERSION } from "@/lib/gewinnspiel-config";
import { createFormToken } from "@/lib/sweepstakes-crypto";
import { submitSweepstakesEntry, type SubmitContext } from "@/lib/sweepstakes";

/**
 * Integrationstests der Kampagnentrennung (Dubai vs. Cards) gegen die echte
 * Test-Datenbank: getrennte Lostöpfe, Duplikate je Kampagne, kein Fallback,
 * Fristgrenze der Cards-Kampagne, Wettlauf derselben Bestellnummer.
 */

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    retailer: "amazon",
    orderNumber: "306-5550001-7770001",
    firstName: "Kenji",
    lastName: "Sammler",
    street: "Kartenweg",
    houseNumber: "17",
    postalCode: "20095",
    city: "Hamburg",
    country: "Deutschland",
    email: "kenji@beispiel.de",
    phone: "+49 170 1234567",
    consent: true,
    ...overrides,
  };
}

function ctx(overrides: Partial<SubmitContext> = {}): SubmitContext {
  return {
    campaign: "cards_2026",
    submissionIdentifier: `client-${Math.random().toString(36).slice(2, 8)}`,
    honeypot: null,
    formToken: createFormToken(Date.now() - 10_000),
    utm: {
      source: "reddit",
      medium: "social",
      campaign: "cards_launch",
      content: null,
      term: null,
    },
    referrer: "https://www.reddit.com/",
    landingHost: "lizenzzumerfolg.com",
    landingPath: "/cards",
    ...overrides,
  };
}

beforeEach(async () => {
  await prisma.sweepstakesEntry.deleteMany();
});

describe("Kampagnentrennung: Cards (/cards) und Dubai (/gewinn, /verlosung)", () => {
  it("speichert eine Cards-Anmeldung ausschließlich in der Cards-Kampagne – mit eigener Bedingungsversion und eigenem Gewinnumfang", async () => {
    const r = await submitSweepstakesEntry(validInput(), ctx());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.campaign).toBe("cards_2026");
    expect(r.persisted).toBe(true);
    expect(r.landingPath).toBe("/cards");
    expect(r.trackingEventId).toMatch(/^[0-9a-f-]{36}$/);

    const row = await prisma.sweepstakesEntry.findUnique({
      where: { referenceNumber: r.referenceNumber },
    });
    expect(row?.campaignId).toBe("cards_2026");
    expect(row?.landingPath).toBe("/cards");
    expect(row?.termsVersion).toBe(CARDS_TERMS_VERSION);
    expect(row?.termsVersion.startsWith("cards-1.0")).toBe(true);
    expect(row?.prizeScope).toBe(CARDS_PRIZE_SCOPE);
    expect(row?.prizeScope).toContain("1×OP-17 Case");
    expect(row?.prizeScope).not.toContain("dubai");

    // Dubai-Zähler unverändert
    expect(await prisma.sweepstakesEntry.count({ where: { campaignId: "dubai_2026" } })).toBe(0);
  });

  it("eine Dubai-Anmeldung bleibt im Dubai-Lostopf (Bedingungen 1.3) – Cards unverändert", async () => {
    const r = await submitSweepstakesEntry(
      validInput(),
      ctx({ campaign: "dubai_2026", landingPath: "/verlosung" }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.campaign).toBe("dubai_2026");
    const row = await prisma.sweepstakesEntry.findUnique({
      where: { referenceNumber: r.referenceNumber },
    });
    expect(row?.campaignId).toBe("dubai_2026");
    expect(row?.landingPath).toBe("/verlosung");
    expect(row?.termsVersion).toBe(TERMS_VERSION);
    expect(row?.prizeScope).toBe(PRIZE_SCOPE);
    expect(await prisma.sweepstakesEntry.count({ where: { campaignId: "cards_2026" } })).toBe(0);
  });

  it("dieselbe Bestellnummer: je einmal bei Dubai und bei Cards (zwei bewusste Anmeldungen), innerhalb von Cards nur ein Los", async () => {
    const dubai = await submitSweepstakesEntry(
      validInput(),
      ctx({ campaign: "dubai_2026", landingPath: "/gewinn" }),
    );
    expect(dubai.ok).toBe(true);

    const cards = await submitSweepstakesEntry(validInput(), ctx());
    expect(cards.ok).toBe(true);

    const again = await submitSweepstakesEntry(
      validInput({ orderNumber: "  306-5550001-7770001 ", email: "anderer@beispiel.de" }),
      ctx(),
    );
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error).toContain("Cards-Gewinnspiel");
      expect(again.fieldErrors?.orderNumber).toContain("bereits");
    }

    const rows = await prisma.sweepstakesEntry.findMany({ orderBy: { campaignId: "asc" } });
    expect(rows.map((r) => r.campaignId)).toEqual(["cards_2026", "dubai_2026"]);
    expect(new Set(rows.map((r) => r.orderNumberHash)).size).toBe(1);
  });

  it("zwei echte Bestellnummern derselben Person ergeben zwei Cards-Lose (keine Sperre über E-Mail)", async () => {
    const a = await submitSweepstakesEntry(
      validInput({ orderNumber: "306-1000001-0000001" }),
      ctx(),
    );
    const b = await submitSweepstakesEntry(validInput({ orderNumber: "TH-88123456" }), ctx());
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.trackingEventId).not.toBe(b.trackingEventId);
    expect(await prisma.sweepstakesEntry.count({ where: { campaignId: "cards_2026" } })).toBe(2);
  });

  it("gleichzeitige Anmeldungen derselben Bestellnummer bei Cards ergeben genau ein Los (Unique-Constraint)", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        submitSweepstakesEntry(
          validInput({ email: `race${i}@beispiel.de` }),
          ctx({ submissionIdentifier: `race-${i}` }),
        ),
      ),
    );
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => !r.ok && r.error.includes("bereits")).length).toBe(3);
    expect(await prisma.sweepstakesEntry.count()).toBe(1);
  });

  it("übernimmt keinen kampagnenfremden Teilnahmeweg und fällt ohne gültige Kampagne nicht auf Dubai zurück", async () => {
    const foreignPath = await submitSweepstakesEntry(
      validInput(),
      ctx({ landingPath: "/verlosung" }),
    );
    expect(foreignPath.ok).toBe(true);
    if (!foreignPath.ok) return;
    const row = await prisma.sweepstakesEntry.findUnique({
      where: { referenceNumber: foreignPath.referenceNumber },
    });
    expect(row?.campaignId).toBe("cards_2026");
    expect(row?.landingPath).toBeNull();

    const missing = await submitSweepstakesEntry(
      validInput({ orderNumber: "306-2222222-3333333" }),
      ctx({ campaign: "dubai" as unknown as SubmitContext["campaign"] }),
    );
    expect(missing.ok).toBe(false);
    expect(await prisma.sweepstakesEntry.count()).toBe(1);
  });

  it("Honeypot-Scheinerfolg bei Cards: nichts gespeichert, keine Ereignis-ID", async () => {
    const r = await submitSweepstakesEntry(validInput(), ctx({ honeypot: "http://spam" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.persisted).toBe(false);
    expect(r.trackingEventId).toBeNull();
    expect(r.campaign).toBe("cards_2026");
    expect(await prisma.sweepstakesEntry.count()).toBe(0);
  });

  it("Fristgrenze Cards: 05.10.2026 23:59:59.999 MESZ zählt, ab 06.10.2026 00:00:00 MESZ ist Schluss – Dubai läuft weiter", async () => {
    expect(CARDS_ENTRY_DEADLINE_EXCLUSIVE.toISOString()).toBe("2026-10-05T22:00:00.000Z");
    const lastMoment = new Date(CARDS_ENTRY_DEADLINE_EXCLUSIVE.getTime() - 1);
    const ok = await submitSweepstakesEntry(
      validInput(),
      ctx({ now: lastMoment, formToken: createFormToken(lastMoment.getTime() - 10_000) }),
    );
    expect(ok.ok).toBe(true);
    const saved = await prisma.sweepstakesEntry.findFirst({ where: { campaignId: "cards_2026" } });
    // Derselbe serverseitige Eingangszeitpunkt für Fristentscheidung und gespeicherte Teilnahme
    expect(saved?.createdAt.toISOString()).toBe(lastMoment.toISOString());

    const closed = await submitSweepstakesEntry(
      validInput({ orderNumber: "306-4444444-5555555" }),
      ctx({
        now: CARDS_ENTRY_DEADLINE_EXCLUSIVE,
        formToken: createFormToken(CARDS_ENTRY_DEADLINE_EXCLUSIVE.getTime() - 10_000),
      }),
    );
    expect(closed.ok).toBe(false);
    if (!closed.ok) expect(closed.error).toContain("beendet");

    const dubaiStillOpen = await submitSweepstakesEntry(
      validInput({ orderNumber: "306-4444444-5555555" }),
      ctx({
        campaign: "dubai_2026",
        landingPath: "/gewinn",
        now: CARDS_ENTRY_DEADLINE_EXCLUSIVE,
        formToken: createFormToken(CARDS_ENTRY_DEADLINE_EXCLUSIVE.getTime() - 10_000),
      }),
    );
    expect(dubaiStillOpen.ok).toBe(true);
    expect(await prisma.sweepstakesEntry.count({ where: { campaignId: "cards_2026" } })).toBe(1);
    expect(await prisma.sweepstakesEntry.count({ where: { campaignId: "dubai_2026" } })).toBe(1);
  });
});
