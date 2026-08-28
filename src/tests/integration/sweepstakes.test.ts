import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createFormToken, decryptOrderNumber } from "@/lib/sweepstakes-crypto";
import { submitSweepstakesEntry, type SubmitContext } from "@/lib/sweepstakes";

/**
 * Integrationstests der Teilnahme-Logik gegen die echte Test-Datenbank.
 */

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    retailer: "amazon",
    orderNumber: "306-1234567-1234567",
    firstName: "Erika",
    lastName: "Musterfrau",
    street: "Musterstraße",
    houseNumber: "12a",
    postalCode: "10115",
    city: "Berlin",
    country: "Deutschland",
    email: "Erika@Beispiel.DE",
    phone: "+49 151 1234567",
    confirmAccuracy: true,
    acceptTerms: true,
    acknowledgePrivacy: true,
    ...overrides,
  };
}

function ctx(overrides: Partial<SubmitContext> = {}): SubmitContext {
  return {
    submissionIdentifier: "test-identifier-1",
    honeypot: null,
    formToken: createFormToken(Date.now() - 10_000),
    utm: { source: "instagram", medium: null, campaign: "launch", content: null, term: null },
    referrer: "https://l.instagram.com/",
    landingHost: "lizenzzumerfolg.com",
    ...overrides,
  };
}

beforeEach(async () => {
  await prisma.sweepstakesEntry.deleteMany();
});

describe("submitSweepstakesEntry", () => {
  it("speichert eine gültige Teilnahme vollständig und normalisiert", async () => {
    const result = await submitSweepstakesEntry(validInput(), ctx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.referenceNumber).toMatch(/^GEWINN-[2-9A-HJKMNP-Z]{8}$/);

    const row = await prisma.sweepstakesEntry.findUnique({
      where: { referenceNumber: result.referenceNumber },
    });
    expect(row).not.toBeNull();
    expect(row?.email).toBe("erika@beispiel.de");
    expect(row?.phone).toBe("+491511234567");
    expect(row?.orderNumberHash).toMatch(/^[0-9a-f]{64}$/);
    expect(decryptOrderNumber(row?.orderNumberEncrypted ?? "")).toBe("306-1234567-1234567");
    expect(row?.utmSource).toBe("instagram");
    expect(row?.termsVersion.length).toBeGreaterThan(0);
    expect(row?.status).toBe("RECEIVED");
  });

  it("erkennt Duplikate auch bei anderer Schreibweise der Bestellnummer", async () => {
    await submitSweepstakesEntry(validInput(), ctx());
    const dup = await submitSweepstakesEntry(
      validInput({ orderNumber: "  306-1234567-1234567  ", email: "andere@beispiel.de" }),
      ctx({ submissionIdentifier: "test-identifier-2" }),
    );
    expect(dup.ok).toBe(false);
    if (dup.ok) return;
    expect(dup.error).toContain("bereits für das Gewinnspiel registriert");
    expect(await prisma.sweepstakesEntry.count()).toBe(1);
  });

  it("lehnt fehlende Pflichtbestätigungen feldbezogen ab", async () => {
    const r1 = await submitSweepstakesEntry(validInput({ acceptTerms: false }), ctx());
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.fieldErrors?.acceptTerms).toContain("Teilnahmebedingungen");

    const r2 = await submitSweepstakesEntry(validInput({ acknowledgePrivacy: false }), ctx());
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.fieldErrors?.acknowledgePrivacy).toContain("Datenschutz");
    expect(await prisma.sweepstakesEntry.count()).toBe(0);
  });

  it("lehnt ungültige E-Mail, Telefonnummer und Bestellnummer ab", async () => {
    const badMail = await submitSweepstakesEntry(validInput({ email: "keine-mail" }), ctx());
    expect(badMail.ok).toBe(false);
    if (!badMail.ok) expect(badMail.fieldErrors?.email).toBeTruthy();

    const badPhone = await submitSweepstakesEntry(validInput({ phone: "0151 123" }), ctx());
    expect(badPhone.ok).toBe(false);
    if (!badPhone.ok) expect(badPhone.fieldErrors?.phone).toContain("Ländervorwahl");

    const badOrder = await submitSweepstakesEntry(validInput({ orderNumber: "!!" }), ctx());
    expect(badOrder.ok).toBe(false);
    if (!badOrder.ok) expect(badOrder.fieldErrors?.orderNumber).toBeTruthy();
  });

  it("verlangt bei 'Anderer Händler' einen Händlernamen", async () => {
    const r = await submitSweepstakesEntry(
      validInput({ retailer: "other", retailerOther: "" }),
      ctx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.retailerOther).toBeTruthy();

    const ok = await submitSweepstakesEntry(
      validInput({ retailer: "other", retailerOther: "Osiander", orderNumber: "OS-2026-778899" }),
      ctx(),
    );
    expect(ok.ok).toBe(true);
  });

  it("akzeptiert Honeypot-Einsendungen zum Schein, speichert aber nichts", async () => {
    const r = await submitSweepstakesEntry(validInput(), ctx({ honeypot: "http://spam" }));
    expect(r.ok).toBe(true);
    expect(await prisma.sweepstakesEntry.count()).toBe(0);
  });

  it("lehnt zu schnelle Submits ab (Formular-Token zu frisch)", async () => {
    const r = await submitSweepstakesEntry(
      validInput(),
      ctx({ formToken: createFormToken(Date.now() - 500) }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("zu schnell");
  });

  it("begrenzt die Anzahl der Einsendungen pro Client (Rate Limit)", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await submitSweepstakesEntry(
        validInput({ orderNumber: `306-000000${i}-1234567`, email: `t${i}@beispiel.de` }),
        ctx({ submissionIdentifier: "flooder" }),
      );
      expect(r.ok).toBe(true);
    }
    const blocked = await submitSweepstakesEntry(
      validInput({ orderNumber: "306-9999999-1234567" }),
      ctx({ submissionIdentifier: "flooder" }),
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toContain("Zu viele Registrierungen");
    expect(await prisma.sweepstakesEntry.count()).toBe(5);
  });

  it("lehnt Teilnahmen nach der Gewinnerbekanntgabe ab", async () => {
    const r = await submitSweepstakesEntry(
      validInput(),
      ctx({ now: new Date("2026-11-01T12:00:00+01:00") }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("beendet");
    expect(await prisma.sweepstakesEntry.count()).toBe(0);
  });
});
