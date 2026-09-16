import { beforeAll, describe, expect, it } from "vitest";
import {
  getSweepstakesPhase,
  isEntryPath,
  PRIZE_VALUE_EUR,
  SECONDARY_PRIZES,
  SECONDARY_PRIZES_COUNT,
  SECONDARY_PRIZES_TOTAL_EUR,
  SECONDARY_PRIZES_TOTAL_LABEL,
  TERMS_VERSION,
  TOTAL_PRIZE_VALUE_EUR,
  TOTAL_PRIZE_VALUE_LABEL,
  VERLOSUNG_SHARE_TEXT,
  VERLOSUNG_URL,
  VOUCHER_BRANDS,
  VOUCHER_TOTAL_COUNT,
  VOUCHER_TOTAL_EUR,
  VOUCHER_TOTAL_LABEL,
  voucherBrandCount,
  voucherBrandTotalEur,
  voucherTiersLabel,
} from "@/lib/gewinnspiel-config";
import {
  csvCell,
  maskEmail,
  normalizeCountry,
  normalizeEmail,
  normalizeOrderNumber,
  normalizePhone,
} from "@/lib/sweepstakes-validation";

beforeAll(() => {
  process.env.APP_SECRET = "unit-test-app-secret-000000000000000000000000";
});

describe("normalizeOrderNumber", () => {
  it("akzeptiert typische Amazon-Bestellnummern", () => {
    const r = normalizeOrderNumber(" 306-1234567-1234567 ");
    expect(r.ok).toBe(true);
    expect(r.value).toBe("306-1234567-1234567");
  });

  it("normalisiert Kleinschreibung und Mehrfach-Leerzeichen", () => {
    const r = normalizeOrderNumber("ab  12\t34-x");
    expect(r.ok).toBe(true);
    expect(r.value).toBe("AB 12 34-X");
  });

  it("lehnt zu kurze und zu lange Eingaben ab", () => {
    expect(normalizeOrderNumber("a1").ok).toBe(false);
    expect(normalizeOrderNumber("9".repeat(41)).ok).toBe(false);
  });

  it("lehnt unzulässige Zeichen ab", () => {
    expect(normalizeOrderNumber("1234!@€").ok).toBe(false);
  });

  it("verlangt mindestens zwei Ziffern", () => {
    expect(normalizeOrderNumber("ABCDEF").ok).toBe(false);
    expect(normalizeOrderNumber("ABC1").ok).toBe(false);
    expect(normalizeOrderNumber("AB12").ok).toBe(true);
  });

  it("lehnt offensichtlich unvollständige Eingaben ab", () => {
    expect(normalizeOrderNumber("0000").ok).toBe(false);
    expect(normalizeOrderNumber("11-11").ok).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("akzeptiert +49 mit Trennzeichen", () => {
    const r = normalizePhone("+49 (151) 123-45678");
    expect(r).toMatchObject({ ok: true, value: "+4915112345678" });
  });

  it("wandelt 00-Präfix in + um", () => {
    expect(normalizePhone("0049 151 1234567").value).toBe("+491511234567");
  });

  it("verlangt eine Ländervorwahl", () => {
    expect(normalizePhone("0151 1234567").ok).toBe(false);
  });

  it("prüft die Ziffernlänge", () => {
    expect(normalizePhone("+49123").ok).toBe(false);
    expect(normalizePhone(`+${"9".repeat(16)}`).ok).toBe(false);
  });
});

describe("normalizeEmail / maskEmail", () => {
  it("normalisiert auf Kleinschreibung", () => {
    expect(normalizeEmail("  Max@Beispiel.DE ")).toBe("max@beispiel.de");
  });
  it("maskiert für Übersichten", () => {
    expect(maskEmail("max@beispiel.de")).toBe("m***@beispiel.de");
    expect(maskEmail("kaputt")).toBe("***");
  });
});

describe("csvCell (CSV-Injection-Schutz)", () => {
  it("neutralisiert Formel-Präfixe", () => {
    expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
    expect(csvCell("+49 151")).toBe('"\'+49 151"');
    expect(csvCell("-1")).toBe('"\'-1"');
    expect(csvCell("@cmd")).toBe('"\'@cmd"');
  });
  it("verdoppelt Anführungszeichen und quotet immer", () => {
    expect(csvCell('Sagte "Hallo"')).toBe('"Sagte ""Hallo"""');
    expect(csvCell(null)).toBe('""');
  });
});

describe("Gewinnspiel-Krypto", () => {
  it("verschlüsselt und entschlüsselt Bestellnummern (Roundtrip)", async () => {
    const { decryptOrderNumber, encryptOrderNumber } = await import("@/lib/sweepstakes-crypto");
    const payload = encryptOrderNumber("306-1234567-1234567");
    expect(payload.startsWith("v1:")).toBe(true);
    expect(decryptOrderNumber(payload)).toBe("306-1234567-1234567");
  });

  it("erkennt Manipulation am Ciphertext", async () => {
    const { decryptOrderNumber, encryptOrderNumber } = await import("@/lib/sweepstakes-crypto");
    const payload = encryptOrderNumber("GEHEIM-123");
    const parts = payload.split(":");
    parts[3] = Buffer.from("manipuliert!").toString("base64");
    expect(decryptOrderNumber(parts.join(":"))).toBeNull();
  });

  it("hasht deterministisch und kollisionsarm", async () => {
    const { hashOrderNumber } = await import("@/lib/sweepstakes-crypto");
    expect(hashOrderNumber("ABC-123")).toBe(hashOrderNumber("ABC-123"));
    expect(hashOrderNumber("ABC-123")).not.toBe(hashOrderNumber("ABC-124"));
    expect(hashOrderNumber("ABC-123")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("erzeugt 8-stellige Referenzen aus dem verwechslungsarmen Alphabet", async () => {
    const { generateReferenceNumber } = await import("@/lib/sweepstakes-crypto");
    for (let i = 0; i < 20; i++) {
      expect(generateReferenceNumber()).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    }
  });

  it("validiert Formular-Tokens (Mindest- und Höchstalter, Signatur)", async () => {
    const { createFormToken, verifyFormToken } = await import("@/lib/sweepstakes-crypto");
    const now = Date.now();
    const token = createFormToken(now - 5000);
    expect(verifyFormToken(token, 3000, 60_000, now)).toBe(true);
    // zu frisch
    expect(verifyFormToken(createFormToken(now - 1000), 3000, 60_000, now)).toBe(false);
    // zu alt
    expect(verifyFormToken(createFormToken(now - 120_000), 3000, 60_000, now)).toBe(false);
    // manipuliert
    expect(verifyFormToken(`${token}x`, 3000, 60_000, now)).toBe(false);
    expect(verifyFormToken(null, 3000, 60_000, now)).toBe(false);
  });
});

describe("Zusatzgewinne (SECONDARY_PRIZES)", () => {
  it("ergibt 100 Gutscheine im Gesamtwert von 13.500 € – Label und Summe stimmen überein", () => {
    expect(SECONDARY_PRIZES_COUNT).toBe(100);
    expect(SECONDARY_PRIZES_TOTAL_EUR).toBe(13_500);
    expect(SECONDARY_PRIZES_TOTAL_LABEL).toBe("13.500 €");
  });
  it("sind exakt die Wiresoft-Staffeln der Kampagne (nicht doppelt konfiguriert)", () => {
    expect(SECONDARY_PRIZES).toBe(VOUCHER_BRANDS[0]!.tiers);
    expect(VOUCHER_BRANDS.filter((b) => b.id === "wiresoft")).toHaveLength(1);
  });
});

describe("Kampagne /verlosung: 300 Gutscheine (VOUCHER_BRANDS)", () => {
  it("enthält genau neun Staffeln in der Reihenfolge Wiresoft, Bikinilista, Amazon", () => {
    expect(VOUCHER_BRANDS.map((b) => b.id)).toEqual(["wiresoft", "bikinilista", "amazon"]);
    expect(VOUCHER_BRANDS.flatMap((b) => b.tiers)).toHaveLength(9);
    expect(VOUCHER_BRANDS.map((b) => b.tiers.map((t) => [t.count, t.valueEur]))).toEqual([
      [[10, 500], [40, 150], [50, 50]],
      [[10, 500], [40, 150], [50, 50]],
      [[10, 250], [40, 100], [50, 20]],
    ]);
  });
  it("berechnet je Marke 100 Gutscheine mit 13.500 / 13.500 / 7.500 €", () => {
    expect(VOUCHER_BRANDS.map(voucherBrandCount)).toEqual([100, 100, 100]);
    expect(VOUCHER_BRANDS.map(voucherBrandTotalEur)).toEqual([13_500, 13_500, 7_500]);
    expect(voucherTiersLabel(VOUCHER_BRANDS[2]!)).toBe("10 × 250 € · 40 × 100 € · 50 × 20 €");
  });
  it("summiert 300 Gutscheine, 34.500 € und mit der Reise 54.500 €", () => {
    expect(VOUCHER_TOTAL_COUNT).toBe(300);
    expect(VOUCHER_TOTAL_EUR).toBe(34_500);
    expect(VOUCHER_TOTAL_LABEL).toBe("34.500 €");
    expect(PRIZE_VALUE_EUR).toBe(20_000);
    expect(TOTAL_PRIZE_VALUE_EUR).toBe(54_500);
    expect(TOTAL_PRIZE_VALUE_LABEL).toBe("54.500 €");
  });
  it("hat Teilnahmebedingungen in Version 1.3 und die kanonische Teilen-URL ohne Parameter", () => {
    expect(TERMS_VERSION.startsWith("1.3")).toBe(true);
    expect(VERLOSUNG_URL).toBe("https://lizenzzumerfolg.com/verlosung");
    expect(VERLOSUNG_SHARE_TEXT).toContain("300 Gutscheine");
    expect(VERLOSUNG_SHARE_TEXT.endsWith(VERLOSUNG_URL)).toBe(true);
    expect(VERLOSUNG_SHARE_TEXT).not.toContain("utm_");
  });
  it("kennt nur die beiden Teilnahmewege", () => {
    expect(isEntryPath("/verlosung")).toBe(true);
    expect(isEntryPath("/gewinn")).toBe(true);
    expect(isEntryPath("/admin")).toBe(false);
    expect(isEntryPath("verlosung")).toBe(false);
    expect(isEntryPath(null)).toBe(false);
  });
});

describe("normalizeCountry (Werteliste DE/AT/CH)", () => {
  it("erkennt zulässige Länder tolerant und liefert das kanonische Label", () => {
    expect(normalizeCountry("Deutschland")).toEqual({ code: "DE", label: "Deutschland" });
    expect(normalizeCountry("  germany ")).toEqual({ code: "DE", label: "Deutschland" });
    expect(normalizeCountry("österreich")).toEqual({ code: "AT", label: "Österreich" });
    expect(normalizeCountry("OESTERREICH")).toEqual({ code: "AT", label: "Österreich" });
    expect(normalizeCountry("Schweiz")).toEqual({ code: "CH", label: "Schweiz" });
    expect(normalizeCountry("CH")).toEqual({ code: "CH", label: "Schweiz" });
  });
  it("lehnt andere Länder und leere Eingaben ab", () => {
    expect(normalizeCountry("Frankreich")).toBeNull();
    expect(normalizeCountry("Deutschland/Frankreich")).toBeNull();
    expect(normalizeCountry("")).toBeNull();
    expect(normalizeCountry("   ")).toBeNull();
  });
});

describe("getSweepstakesPhase", () => {
  it("ist vor der Gewinnerbekanntgabe offen", () => {
    expect(getSweepstakesPhase(new Date("2026-09-01T12:00:00+02:00"))).toBe("open");
  });
  it("ist bis zum Registrierungsschluss 11.10.2026 23:59 Uhr offen und danach geschlossen", () => {
    expect(getSweepstakesPhase(new Date("2026-10-11T23:59:00+02:00"))).toBe("open");
    expect(getSweepstakesPhase(new Date("2026-10-12T00:00:00+02:00"))).toBe("closed");
    expect(getSweepstakesPhase(new Date("2026-10-12T11:59:59+02:00"))).toBe("closed");
  });
  it("gilt ab der Gewinnerbekanntgabe 12.10.2026 12 Uhr als announced", () => {
    expect(getSweepstakesPhase(new Date("2026-10-12T12:00:00+02:00"))).toBe("announced");
    expect(getSweepstakesPhase(new Date("2026-11-01T00:00:00+01:00"))).toBe("announced");
  });
});
