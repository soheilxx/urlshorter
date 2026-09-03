import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  getVoucherStats,
  importVoucherCodes,
  parseVoucherCodes,
  redeemVoucher,
  type VoucherSubmitContext,
} from "@/lib/gutschein";
import { createFormToken, decryptOrderNumber } from "@/lib/sweepstakes-crypto";

/**
 * Integrationstests der Gutscheinaktion gegen die echte Test-Datenbank:
 * Import-Parser, atomare Vergabe (auch parallel), Wiedervorlage, Duplikate.
 */

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    retailer: "amazon",
    orderNumber: "306-7654321-1234567",
    firstName: "Erika",
    lastName: "Musterfrau",
    email: "Erika@Beispiel.DE",
    consent: true,
    ...overrides,
  };
}

function ctx(overrides: Partial<VoucherSubmitContext> = {}): VoucherSubmitContext {
  return {
    submissionIdentifier: `test-${randomUUID()}`,
    honeypot: null,
    formToken: createFormToken(Date.now() - 10_000),
    utm: { source: "newsletter", medium: "email", campaign: "buch", content: null, term: null },
    referrer: null,
    landingHost: "lizenzzumerfolg.com",
    ...overrides,
  };
}

async function seedCodes(codes: string[]): Promise<void> {
  await prisma.voucherCode.createMany({
    data: codes.map((code) => ({ id: randomUUID(), code, batch: "test" })),
  });
}

beforeEach(async () => {
  await prisma.voucherRedemption.deleteMany();
  await prisma.voucherCode.deleteMany();
});

describe("parseVoucherCodes", () => {
  it("liest die Spalte „code“ aus dem Shop-Export (Semikolon, Kopfzeile)", () => {
    const text =
      "id;customerId;code;cashed;firstName;lastName;number\n301;;C30BF207;0;;;\n302;;C30BF558;0;;;\n302;;C30BF558;0;;;\n";
    const parsed = parseVoucherCodes(text);
    expect(parsed.codes).toEqual(["C30BF207", "C30BF558"]);
    expect(parsed.invalid).toBe(0);
  });

  it("akzeptiert reine Listen und überspringt ungültige Zeilen", () => {
    const parsed = parseVoucherCodes("AAA-111\n\n  BBB222  \n!!invalid!!\n");
    expect(parsed.codes).toEqual(["AAA-111", "BBB222"]);
    expect(parsed.invalid).toBe(1);
  });
});

describe("importVoucherCodes", () => {
  it("importiert neue Codes und zählt vorhandene als Duplikate", async () => {
    // Einspaltige Kopfzeile „code“ wird als Kopfzeile erkannt, nicht als Code
    const first = await importVoucherCodes("code\nCODE-0001\nCODE-0002\nCODE-0003", "charge-1");
    expect(first).toEqual({ imported: 3, duplicates: 0, invalid: 0 });
    const second = await importVoucherCodes("CODE-0002\nCODE-0004", null);
    expect(second).toEqual({ imported: 1, duplicates: 1, invalid: 0 });
    expect(await prisma.voucherCode.count()).toBe(4);
  });
});

describe("redeemVoucher", () => {
  it("vergibt den ältesten freien Code und speichert datensparsam", async () => {
    await seedCodes(["FIRST", "SECOND"]);
    const result = await redeemVoucher(validInput(), ctx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.code).toBe("FIRST");
    expect(result.alreadyIssued).toBe(false);

    const row = await prisma.voucherRedemption.findFirst({ include: { voucherCode: true } });
    expect(row?.email).toBe("erika@beispiel.de");
    expect(row?.orderNumberHash).toMatch(/^[0-9a-f]{64}$/);
    expect(decryptOrderNumber(row?.orderNumberEncrypted ?? "")).toBe("306-7654321-1234567");
    expect(row?.utmSource).toBe("newsletter");
  });

  it("zeigt denselben Code erneut bei gleicher Bestellnummer + E-Mail, lehnt fremde E-Mail ab", async () => {
    await seedCodes(["ONLY"]);
    const first = await redeemVoucher(validInput(), ctx());
    expect(first.ok && first.code).toBe("ONLY");

    const again = await redeemVoucher(
      validInput({ orderNumber: " 306-7654321-1234567 ", email: "erika@beispiel.de" }),
      ctx(),
    );
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.code).toBe("ONLY");
      expect(again.alreadyIssued).toBe(true);
    }

    const foreign = await redeemVoucher(validInput({ email: "fremd@beispiel.de" }), ctx());
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.fieldErrors?.orderNumber).toContain("bereits ein Gutschein");
    expect(await prisma.voucherRedemption.count()).toBe(1);
  });

  it("vergibt bei parallelen Anfragen jeden Code genau einmal und meldet danach „vergeben“", async () => {
    await seedCodes(["P1", "P2", "P3", "P4", "P5"]);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        redeemVoucher(
          validInput({ orderNumber: `ORDER-${1000 + i}`, email: `kunde${i}@beispiel.de` }),
          ctx(),
        ),
      ),
    );
    const issued = results.filter((r) => r.ok).map((r) => (r.ok ? r.code : ""));
    expect(issued).toHaveLength(5);
    expect(new Set(issued).size).toBe(5);
    const soldOut = results.filter((r) => !r.ok);
    expect(soldOut).toHaveLength(3);
    for (const r of soldOut) if (!r.ok) expect(r.soldOut).toBe(true);
    expect(await prisma.voucherRedemption.count()).toBe(5);
  });

  it("verweigert Formular ohne gültiges Token und verbraucht bei Honeypot keinen Code", async () => {
    await seedCodes(["KEEP"]);
    const tooFast = await redeemVoucher(validInput(), ctx({ formToken: createFormToken() }));
    expect(tooFast.ok).toBe(false);

    const bot = await redeemVoucher(validInput(), ctx({ honeypot: "spam" }));
    expect(bot.ok).toBe(true);
    if (bot.ok) expect(bot.code).not.toBe("KEEP");
    expect(await prisma.voucherRedemption.count()).toBe(0);
  });

  it("liefert Dashboard-Kennzahlen", async () => {
    await seedCodes(["S1", "S2", "S3"]);
    await redeemVoucher(validInput(), ctx());
    const stats = await getVoucherStats();
    expect(stats.totalCodes).toBe(3);
    expect(stats.issued).toBe(1);
    expect(stats.remaining).toBe(2);
    expect(stats.today).toBe(1);
    expect(stats.bySource[0]).toEqual({ source: "newsletter", count: 1 });
  });
});
