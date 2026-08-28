import { beforeAll, describe, expect, it } from "vitest";
import { getSweepstakesPhase } from "@/lib/gewinnspiel-config";
import {
  csvCell,
  maskEmail,
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

  it("erzeugt Referenzen im Format GEWINN-XXXXXXXX", async () => {
    const { generateReferenceNumber } = await import("@/lib/sweepstakes-crypto");
    for (let i = 0; i < 20; i++) {
      expect(generateReferenceNumber()).toMatch(/^GEWINN-[2-9A-HJKMNP-Z]{8}$/);
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

describe("getSweepstakesPhase", () => {
  it("ist vor der Gewinnerbekanntgabe offen", () => {
    expect(getSweepstakesPhase(new Date("2026-09-01T12:00:00+02:00"))).toBe("open");
  });
  it("gilt ab der Gewinnerbekanntgabe als announced", () => {
    expect(getSweepstakesPhase(new Date("2026-10-06T00:00:01+02:00"))).toBe("announced");
    expect(getSweepstakesPhase(new Date("2026-11-01T00:00:00+01:00"))).toBe("announced");
  });
});
