import { describe, expect, it } from "vitest";
import {
  calendarDateInTimezone,
  isDigestTimeReached,
  timeInTimezone,
} from "@/lib/amazon/digest-time";

/**
 * Zeitzonen-Logik der täglichen Zusammenfassung (Europe/Berlin, inkl.
 * Sommer-/Winterzeit). Speicherung ist UTC – die Fälligkeit richtet sich
 * nach der lokalen Berliner Uhrzeit.
 */

describe("calendarDateInTimezone", () => {
  it("liefert den lokalen Kalendertag", () => {
    // 23:30 UTC am 28.08. = 01:30 Berlin am 29.08. (Sommerzeit, UTC+2)
    expect(calendarDateInTimezone(new Date("2026-08-28T23:30:00Z"), "Europe/Berlin")).toBe(
      "2026-08-29",
    );
    // 23:30 UTC am 15.01. = 00:30 Berlin am 16.01. (Winterzeit, UTC+1)
    expect(calendarDateInTimezone(new Date("2026-01-15T23:30:00Z"), "Europe/Berlin")).toBe(
      "2026-01-16",
    );
    expect(calendarDateInTimezone(new Date("2026-01-15T22:30:00Z"), "Europe/Berlin")).toBe(
      "2026-01-15",
    );
  });
});

describe("isDigestTimeReached (08:00 Europe/Berlin)", () => {
  it("Sommerzeit: 06:00 UTC = 08:00 Berlin → fällig; 05:59 UTC → nicht fällig", () => {
    expect(isDigestTimeReached(new Date("2026-08-29T06:00:00Z"), "08:00", "Europe/Berlin")).toBe(
      true,
    );
    expect(isDigestTimeReached(new Date("2026-08-29T05:59:00Z"), "08:00", "Europe/Berlin")).toBe(
      false,
    );
  });

  it("Winterzeit: 07:00 UTC = 08:00 Berlin → fällig; 06:59 UTC → nicht fällig", () => {
    expect(isDigestTimeReached(new Date("2026-01-15T07:00:00Z"), "08:00", "Europe/Berlin")).toBe(
      true,
    );
    expect(isDigestTimeReached(new Date("2026-01-15T06:59:00Z"), "08:00", "Europe/Berlin")).toBe(
      false,
    );
  });

  it("Tag der Zeitumstellung (29.03.2026, CET→CEST): 06:30 UTC = 08:30 CEST → fällig", () => {
    expect(isDigestTimeReached(new Date("2026-03-29T06:30:00Z"), "08:00", "Europe/Berlin")).toBe(
      true,
    );
    expect(isDigestTimeReached(new Date("2026-03-29T05:30:00Z"), "08:00", "Europe/Berlin")).toBe(
      false,
    );
  });
});

describe("timeInTimezone", () => {
  it("formatiert HH:MM in der Zielzeitzone", () => {
    expect(timeInTimezone(new Date("2026-08-29T06:15:00Z"), "Europe/Berlin")).toBe("08:15");
  });
});
