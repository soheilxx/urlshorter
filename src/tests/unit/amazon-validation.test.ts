import { describe, expect, it } from "vitest";
import {
  asinMatchesIsbn13,
  isbn13ToIsbn10,
  isValidAsin,
  isValidIsbn10,
  isValidIsbn13,
  isValidProviderCategoryId,
  normalizeIsbn,
} from "@/lib/amazon/validation";

describe("ASIN-Validierung", () => {
  it("akzeptiert gültige ASINs (auch ISBN-10-Form bei Büchern)", () => {
    expect(isValidAsin("3690662508")).toBe(true);
    expect(isValidAsin("B0EYHVAQW1")).toBe(true);
    expect(isValidAsin(" 3690662508 ")).toBe(true);
  });

  it("lehnt ungültige ASINs ab", () => {
    expect(isValidAsin("123")).toBe(false);
    expect(isValidAsin("36906625081")).toBe(false);
    expect(isValidAsin("3690-62508")).toBe(false);
    expect(isValidAsin("")).toBe(false);
  });
});

describe("ISBN-Prüfziffern", () => {
  it("validiert die ISBN-10 des Buchs (3690662508)", () => {
    expect(isValidIsbn10("3690662508")).toBe(true);
    expect(isValidIsbn10("3-690-66250-8")).toBe(true);
  });

  it("validiert die ISBN-13 des Buchs (978-3690662505)", () => {
    expect(isValidIsbn13("9783690662505")).toBe(true);
    expect(isValidIsbn13("978-3-690-66250-5")).toBe(true);
  });

  it("erkennt falsche Prüfziffern", () => {
    expect(isValidIsbn10("3690662509")).toBe(false);
    expect(isValidIsbn13("9783690662506")).toBe(false);
  });

  it("akzeptiert ISBN-10 mit X-Prüfziffer", () => {
    expect(isValidIsbn10("097522980X")).toBe(true);
  });

  it("konvertiert ISBN-13 → ISBN-10", () => {
    expect(isbn13ToIsbn10("9783690662505")).toBe("3690662508");
    expect(isbn13ToIsbn10("9793690662505")).toBeNull(); // kein 978-Präfix
  });

  it("prüft ASIN ↔ ISBN-13-Zugehörigkeit", () => {
    expect(asinMatchesIsbn13("3690662508", "9783690662505")).toBe(true);
    expect(asinMatchesIsbn13("B0EYHVAQW1", "9783690662505")).toBe(false);
  });

  it("normalisiert Bindestriche und Leerzeichen", () => {
    expect(normalizeIsbn("978-3 690 66250-5")).toBe("9783690662505");
  });
});

describe("Kategorie-IDs", () => {
  it("akzeptiert Browse-Node- und Rainforest-IDs", () => {
    expect(isValidProviderCategoryId("686022031")).toBe(true);
    expect(isValidProviderCategoryId("bestsellers_books_sachbuch")).toBe(true);
  });

  it("lehnt gefährliche Werte ab", () => {
    expect(isValidProviderCategoryId("a b")).toBe(false);
    expect(isValidProviderCategoryId("x".repeat(65))).toBe(false);
    expect(isValidProviderCategoryId("../etc")).toBe(false);
  });
});
