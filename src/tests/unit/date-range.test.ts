import { describe, expect, it } from "vitest";
import { addDays, berlinDayStartUtc, resolveRange, todayBerlin } from "@/lib/date-range";

describe("berlinDayStartUtc", () => {
  it("liefert im Sommer (CEST) 22:00 UTC des Vortags", () => {
    const start = berlinDayStartUtc("2026-08-24");
    expect(start.toISOString()).toBe("2026-08-23T22:00:00.000Z");
  });

  it("liefert im Winter (CET) 23:00 UTC des Vortags", () => {
    const start = berlinDayStartUtc("2026-01-15");
    expect(start.toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("wirft bei ungültigem Format", () => {
    expect(() => berlinDayStartUtc("24.08.2026")).toThrow();
    expect(() => berlinDayStartUtc("2026-8-1")).toThrow();
  });
});

describe("addDays", () => {
  it("verschiebt Kalendertage korrekt (inkl. Monats-/Jahreswechsel)", () => {
    expect(addDays("2026-08-24", 1)).toBe("2026-08-25");
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("todayBerlin", () => {
  it("liefert ein YYYY-MM-DD-Datum", () => {
    expect(todayBerlin()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("kippt um Mitternacht Berliner Zeit, nicht UTC", () => {
    // 23:30 UTC am 23.08. ist bereits der 24.08. in Berlin (CEST, +2)
    expect(todayBerlin(new Date("2026-08-23T23:30:00.000Z"))).toBe("2026-08-24");
    // 21:30 UTC ist noch der 23.08. in Berlin
    expect(todayBerlin(new Date("2026-08-23T21:30:00.000Z"))).toBe("2026-08-23");
  });
});

describe("resolveRange", () => {
  it("fällt bei unbekannten Werten auf 30 Tage zurück", () => {
    expect(resolveRange(undefined).key).toBe("30d");
    expect(resolveRange("quatsch").key).toBe("30d");
  });

  it("berechnet 'today' und 'yesterday' korrekt", () => {
    const now = new Date("2026-08-24T10:00:00.000Z");
    const today = resolveRange("today", now);
    expect(today.fromDay).toBe("2026-08-24");
    expect(today.toDay).toBe("2026-08-25");

    const yesterday = resolveRange("yesterday", now);
    expect(yesterday.fromDay).toBe("2026-08-23");
    expect(yesterday.toDay).toBe("2026-08-24");
  });

  it("umfasst bei '7d' sieben Kalendertage", () => {
    const now = new Date("2026-08-24T10:00:00.000Z");
    const range = resolveRange("7d", now);
    expect(range.fromDay).toBe("2026-08-18");
    expect(range.toDay).toBe("2026-08-25");
  });
});
