import { beforeEach, describe, expect, it } from "vitest";
import {
  drawCardsWinner,
  getCardsDrawState,
  markRemainingCardsNotWon,
  undoLastCardsDraw,
} from "@/lib/cards-draw";
import { CARDS_PRIZES } from "@/lib/cards-giveaway-config";
import { prisma } from "@/lib/db";
import { createFormToken } from "@/lib/sweepstakes-crypto";
import { submitSweepstakesEntry, type SubmitContext } from "@/lib/sweepstakes";

/**
 * Integrationstests der Cards-Gewinnziehung gegen die Test-Datenbank:
 * Lose = Bestellnummern, ein Los gewinnt höchstens einmal, Personen mit
 * mehreren Losen können mehrfach gewinnen, Gewinnmengen je Kategorie,
 * Protokoll, Verwerfen, Kampagnenreinheit.
 */

function input(orderNumber: string, email: string): Record<string, unknown> {
  return {
    retailer: "amazon",
    orderNumber,
    firstName: "Test",
    lastName: "Person",
    street: "Weg",
    houseNumber: "1",
    postalCode: "10115",
    city: "Berlin",
    country: "Deutschland",
    email,
    phone: "+49 170 1234567",
    consent: true,
  };
}

/** Zeitpunkt innerhalb der Teilnahmephase (Teilnahme ist seit 06.10.2026 geschlossen) */
const OPEN_MOMENT = new Date("2026-09-25T12:00:00+02:00");

function ctx(campaign: SubmitContext["campaign"], path: string, id: string): SubmitContext {
  return {
    campaign,
    now: OPEN_MOMENT,
    submissionIdentifier: `draw-${id}`,
    honeypot: null,
    formToken: createFormToken(OPEN_MOMENT.getTime() - 10_000),
    utm: { source: null, medium: null, campaign: null, content: null, term: null },
    referrer: null,
    landingHost: "lizenzzumerfolg.com",
    landingPath: path,
  };
}

async function seedCards(lose: Array<[string, string]>) {
  for (const [order, email] of lose) {
    const r = await submitSweepstakesEntry(input(order, email), ctx("cards_2026", "/cards", order));
    if (!r.ok) throw new Error(`seed failed: ${r.error}`);
  }
}

beforeEach(async () => {
  await prisma.sweepstakesDraw.deleteMany();
  await prisma.sweepstakesEntry.deleteMany();
});

describe("Cards-Gewinnziehung", () => {
  it("zieht ein Los aus dem Cards-Topf, markiert es als Gewinner und protokolliert Topfgröße, Index und Vorzustand", async () => {
    await seedCards([
      ["306-0000001-0000001", "a@beispiel.de"],
      ["306-0000002-0000002", "b@beispiel.de"],
      ["306-0000003-0000003", "c@beispiel.de"],
    ]);
    // Dubai-Lose gehören nie in den Cards-Topf
    const dubai = await submitSweepstakesEntry(
      input("306-9999999-0000009", "dubai@beispiel.de"),
      ctx("dubai_2026", "/gewinn", "dubai"),
    );
    expect(dubai.ok).toBe(true);

    const before = await getCardsDrawState();
    expect(before.poolSize).toBe(3);
    expect(before.validLose).toBe(3);
    expect(before.participants).toBe(3);
    expect(before.totalPrizes).toBe(17);

    const result = await drawCardsWinner({ prizeId: "op17_case", actor: "admin@test.local" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draw.sequence).toBe(1);
    expect(result.draw.prizeId).toBe("op17_case");
    expect(result.draw.poolSize).toBe(3);
    expect(result.draw.randomIndex).toBeGreaterThanOrEqual(0);
    expect(result.draw.randomIndex).toBeLessThan(3);
    expect(result.draw.referenceNumber).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    expect(result.draw.orderNumber).toMatch(/^306-000000[123]-000000[123]$/);
    expect(result.reelStrip).not.toContain(result.draw.referenceNumber);
    expect(result.reelStrip.length).toBe(2);

    const entry = await prisma.sweepstakesEntry.findUnique({ where: { id: result.draw.entryId } });
    expect(entry?.campaignId).toBe("cards_2026");
    expect(entry?.status).toBe("WINNER");
    expect(entry?.prizeId).toBe("op17_case");
    const protocol = await prisma.sweepstakesDraw.findMany();
    expect(protocol).toHaveLength(1);
    expect(protocol[0]?.previousStatus).toBe("RECEIVED");
    expect(result.state.poolSize).toBe(2);
    expect(result.state.prizes.find((p) => p.id === "op17_case")?.remaining).toBe(0);

    // Dubai unverändert
    const dubaiRow = await prisma.sweepstakesEntry.findFirst({
      where: { campaignId: "dubai_2026" },
    });
    expect(dubaiRow?.status).toBe("RECEIVED");
  });

  it("jede Bestellnummer ist ein Los: eine Person mit 5 Losen kann mehrfach gewinnen, ein Los aber nur einmal", async () => {
    await seedCards([
      ["A-1001", "viel@beispiel.de"],
      ["A-1002", "viel@beispiel.de"],
      ["A-1003", "viel@beispiel.de"],
      ["A-1004", "viel@beispiel.de"],
      ["A-1005", "viel@beispiel.de"],
      ["B-2001", "einmal@beispiel.de"],
    ]);
    const state = await getCardsDrawState();
    expect(state.poolSize).toBe(6);
    expect(state.participants).toBe(2);

    const won: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await drawCardsWinner({ prizeId: "cardmarket_100", actor: "admin@test.local" });
      expect(r.ok).toBe(true);
      if (r.ok) won.push(r.draw.orderNumber);
    }
    // Alle sechs Lose gezogen, jedes genau einmal
    expect(new Set(won).size).toBe(6);
    expect(won.filter((o) => o.startsWith("A-"))).toHaveLength(5);
    const winners = await prisma.sweepstakesEntry.count({ where: { status: "WINNER" } });
    expect(winners).toBe(6);

    // Topf leer → klare Meldung, kein Fehler
    const empty = await drawCardsWinner({ prizeId: "cardmarket_100", actor: "admin@test.local" });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toContain("Keine Lose");
  });

  it("hält die Gewinnmengen je Kategorie ein (OP-17 nur einmal)", async () => {
    await seedCards([
      ["C-100001", "c1@beispiel.de"],
      ["C-100002", "c2@beispiel.de"],
    ]);
    const first = await drawCardsWinner({ prizeId: "op17_case", actor: "admin@test.local" });
    expect(first.ok).toBe(true);
    const second = await drawCardsWinner({ prizeId: "op17_case", actor: "admin@test.local" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toContain("bereits gezogen");
    const unknown = await drawCardsWinner({ prizeId: "dubai_reise", actor: "admin@test.local" });
    expect(unknown.ok).toBe(false);
    expect(await prisma.sweepstakesDraw.count()).toBe(1);
  });

  it("Option „höchstens ein Gewinn je Person“ schließt weitere Lose einer Gewinnerin aus", async () => {
    await seedCards([
      ["D-100001", "doppelt@beispiel.de"],
      ["D-100002", "doppelt@beispiel.de"],
      ["D-100003", "doppelt@beispiel.de"],
      ["E-100001", "einzel@beispiel.de"],
    ]);
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(
        await drawCardsWinner({
          prizeId: "cardmarket_100",
          actor: "admin@test.local",
          onePrizePerPerson: true,
        }),
      );
    }
    const wins = results.filter((r) => r.ok);
    expect(wins).toHaveLength(2);
    const winnerEmails = await prisma.sweepstakesEntry.findMany({
      where: { status: "WINNER" },
      select: { email: true },
    });
    expect(new Set(winnerEmails.map((w) => w.email)).size).toBe(2);
    const blocked = results.find((r) => !r.ok);
    expect(blocked && !blocked.ok ? blocked.error : "").toContain("Gewinnern");
  });

  it("verwirft die letzte Ziehung: Los zurück im Topf, Protokoll bereinigt, Reihenfolge bleibt konsistent", async () => {
    await seedCards([
      ["F-100001", "f1@beispiel.de"],
      ["F-100002", "f2@beispiel.de"],
    ]);
    const a = await drawCardsWinner({
      prizeId: "fusion_world_st01_display",
      actor: "admin@test.local",
    });
    const b = await drawCardsWinner({
      prizeId: "magnificent_monsters_eu_case",
      actor: "admin@test.local",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!b.ok) return;

    const undo = await undoLastCardsDraw("admin@test.local");
    expect(undo.ok).toBe(true);
    if (!undo.ok) return;
    expect(undo.undone.referenceNumber).toBe(b.draw.referenceNumber);
    const restored = await prisma.sweepstakesEntry.findUnique({ where: { id: b.draw.entryId } });
    expect(restored?.status).toBe("RECEIVED");
    expect(restored?.prizeId).toBeNull();
    expect(undo.state.draws).toHaveLength(1);
    expect(undo.state.poolSize).toBe(1);

    // Nächste Ziehung bekommt wieder Sequenz 2
    const c = await drawCardsWinner({
      prizeId: "magnificent_monsters_eu_case",
      actor: "admin@test.local",
    });
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.draw.sequence).toBe(2);

    const none = await undoLastCardsDraw("admin@test.local");
    expect(none.ok).toBe(true);
    const none2 = await undoLastCardsDraw("admin@test.local");
    expect(none2.ok).toBe(true);
    const none3 = await undoLastCardsDraw("admin@test.local");
    expect(none3.ok).toBe(false);
  });

  it("markiert restliche Lose erst nach vollständiger Ziehung als „Nicht gewonnen“", async () => {
    const lose: Array<[string, string]> = [];
    for (let i = 1; i <= 20; i++) lose.push([`G-${1000 + i}`, `g${i}@beispiel.de`]);
    await seedCards(lose);

    const tooEarly = await markRemainingCardsNotWon("admin@test.local");
    expect(tooEarly.ok).toBe(false);

    for (const prize of CARDS_PRIZES) {
      for (let k = 0; k < prize.count; k++) {
        const r = await drawCardsWinner({ prizeId: prize.id, actor: "admin@test.local" });
        expect(r.ok).toBe(true);
      }
    }
    const full = await getCardsDrawState();
    expect(full.drawnTotal).toBe(17);
    expect(full.remainingTotal).toBe(0);
    expect(full.poolSize).toBe(3);
    expect(full.draws.map((d) => d.sequence)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));

    const marked = await markRemainingCardsNotWon("admin@test.local");
    expect(marked.ok).toBe(true);
    if (marked.ok) {
      expect(marked.count).toBe(3);
      expect(marked.state.poolSize).toBe(0);
      expect(marked.state.notWonMarked).toBe(3);
    }
  });
});
