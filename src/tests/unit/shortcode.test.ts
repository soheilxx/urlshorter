import { describe, expect, it } from "vitest";
import {
  generateShortCode,
  generateUniqueShortCode,
  isValidShortCode,
  SHORT_CODE_PATTERN,
} from "@/lib/shortcode";

describe("generateShortCode", () => {
  it("erzeugt exakt vier Kleinbuchstaben (a–z)", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateShortCode();
      expect(code).toHaveLength(4);
      expect(code).toMatch(SHORT_CODE_PATTERN);
    }
  });

  it("erzeugt niemals Zahlen oder Sonderzeichen", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateShortCode();
      expect(code).not.toMatch(/[0-9]/);
      expect(code).not.toMatch(/[^a-z]/);
    }
  });

  it("erzeugt keine offensichtlich fortlaufenden Codes", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateShortCode()));
    // Bei kryptografischer Zufälligkeit sind 200 Codes fast immer (nahezu) eindeutig
    expect(codes.size).toBeGreaterThan(190);
  });
});

describe("isValidShortCode", () => {
  it("akzeptiert gültige Codes", () => {
    expect(isValidShortCode("abcd")).toBe(true);
    expect(isValidShortCode("zzzz")).toBe(true);
  });

  it("lehnt ungültige Werte ab", () => {
    expect(isValidShortCode("abc")).toBe(false);
    expect(isValidShortCode("abcde")).toBe(false);
    expect(isValidShortCode("ABCD")).toBe(false);
    expect(isValidShortCode("ab1d")).toBe(false);
    expect(isValidShortCode("ab-d")).toBe(false);
    expect(isValidShortCode("")).toBe(false);
    expect(isValidShortCode(null)).toBe(false);
    expect(isValidShortCode(undefined)).toBe(false);
    expect(isValidShortCode(1234)).toBe(false);
  });
});

describe("generateUniqueShortCode", () => {
  it("versucht bei einer Kollision automatisch einen neuen Code", async () => {
    let calls = 0;
    const code = await generateUniqueShortCode(async () => {
      calls++;
      return calls <= 3; // die ersten drei Codes sind "belegt"
    });
    expect(calls).toBe(4);
    expect(code).toMatch(SHORT_CODE_PATTERN);
  });

  it("wirft nach Erreichen der Maximalversuche einen Fehler", async () => {
    await expect(generateUniqueShortCode(async () => true, 5)).rejects.toThrow(
      /Kein freier Kurzcode/,
    );
  });
});
