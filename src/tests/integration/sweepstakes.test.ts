import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { PRIZE_SCOPE, TERMS_VERSION } from "@/lib/gewinnspiel-config";
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
    consent: true,
    ...overrides,
  };
}

function ctx(overrides: Partial<SubmitContext> = {}): SubmitContext {
  return {
    campaign: "dubai_2026",
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
    expect(result.referenceNumber).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);

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

  it("lehnt eine fehlende Pflichtbestätigung feldbezogen ab", async () => {
    const r = await submitSweepstakesEntry(validInput({ consent: false }), ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors?.consent).toContain("Teilnahmebedingungen");
      expect(r.fieldErrors?.consent).toContain("Datenschutz");
    }
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

describe("Kampagnenweg /verlosung (gemeinsamer Lostopf)", () => {
  it("speichert den serverseitig validierten Teilnahmeweg, den Gewinnumfang und die Bedingungen 1.3", async () => {
    const r = await submitSweepstakesEntry(validInput(), ctx({ landingPath: "/verlosung" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.persisted).toBe(true);
    expect(r.landingPath).toBe("/verlosung");
    expect(r.trackingEventId).toMatch(/^[0-9a-f-]{36}$/);
    const row = await prisma.sweepstakesEntry.findUnique({
      where: { referenceNumber: r.referenceNumber },
    });
    expect(row?.landingPath).toBe("/verlosung");
    expect(row?.prizeScope).toBe(PRIZE_SCOPE);
    expect(row?.termsVersion).toBe(TERMS_VERSION);
    expect(row?.termsVersion.startsWith("1.3")).toBe(true);
    // Die Ereignis-ID ist bewusst NICHT die Datensatz-ID (kein Bezug für Werbeplattformen)
    expect(r.trackingEventId).not.toBe(row?.id);
  });

  it("übernimmt keinen frei behaupteten Client-Pfad", async () => {
    const r = await submitSweepstakesEntry(
      validInput(),
      ctx({ landingPath: "/admin/../evil?x=1" }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = await prisma.sweepstakesEntry.findUnique({
      where: { referenceNumber: r.referenceNumber },
    });
    expect(row?.landingPath).toBeNull();
  });

  it("Honeypot-Scheinerfolg liefert KEINE Ereignis-ID (kein Conversion-Nachweis)", async () => {
    const r = await submitSweepstakesEntry(
      validInput(),
      ctx({ honeypot: "http://spam", landingPath: "/verlosung" }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.persisted).toBe(false);
    expect(r.trackingEventId).toBeNull();
    expect(await prisma.sweepstakesEntry.count()).toBe(0);
  });

  it("validiert das Wohnsitzland gegen die Werteliste DE/AT/CH", async () => {
    const fr = await submitSweepstakesEntry(validInput({ country: "Frankreich" }), ctx());
    expect(fr.ok).toBe(false);
    if (!fr.ok) expect(fr.fieldErrors?.country).toContain("Deutschland, Österreich oder der Schweiz");
    expect(await prisma.sweepstakesEntry.count()).toBe(0);

    const at = await submitSweepstakesEntry(validInput({ country: "  österreich " }), ctx());
    expect(at.ok).toBe(true);
    if (!at.ok) return;
    const row = await prisma.sweepstakesEntry.findUnique({
      where: { referenceNumber: at.referenceNumber },
    });
    expect(row?.country).toBe("Österreich");
  });

  it("dieselbe Person kann zwei verschiedene Bestellnummern registrieren – dieselbe nur einmal, egal über welchen Weg", async () => {
    const first = await submitSweepstakesEntry(
      validInput({ orderNumber: "306-1111111-2222222" }),
      ctx({ landingPath: "/verlosung" }),
    );
    const second = await submitSweepstakesEntry(
      validInput({ orderNumber: "306-3333333-4444444" }),
      ctx({ landingPath: "/verlosung" }),
    );
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(first.trackingEventId).not.toBe(second.trackingEventId);
    expect(await prisma.sweepstakesEntry.count()).toBe(2);

    const viaGewinn = await submitSweepstakesEntry(
      validInput({ orderNumber: "306-1111111-2222222", email: "zweite@beispiel.de" }),
      ctx({ landingPath: "/gewinn", submissionIdentifier: "anderer-client" }),
    );
    expect(viaGewinn.ok).toBe(false);
    if (!viaGewinn.ok) expect(viaGewinn.fieldErrors?.orderNumber).toContain("bereits");
    expect(await prisma.sweepstakesEntry.count()).toBe(2);
  });
});
