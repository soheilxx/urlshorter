import { describe, expect, it } from "vitest";
import { computeVisitorHash, computeRateLimitIdentifier } from "@/lib/visitor-hash";

const SECRET = "hash-test-secret-123456789012345678901234";

describe("computeVisitorHash", () => {
  const base = {
    secret: SECRET,
    ip: "203.0.113.10",
    userAgent: "Mozilla/5.0 Test",
    acceptLanguage: "de-DE",
  };

  it("ist deterministisch für identische Eingaben am selben Tag", () => {
    const day = new Date("2026-08-24T10:00:00Z");
    expect(computeVisitorHash({ ...base, now: day })).toBe(
      computeVisitorHash({ ...base, now: day }),
    );
  });

  it("rotiert täglich (gleiche Eingaben, anderer Tag → anderer Hash)", () => {
    const hashA = computeVisitorHash({ ...base, now: new Date("2026-08-24T10:00:00Z") });
    const hashB = computeVisitorHash({ ...base, now: new Date("2026-08-25T10:00:00Z") });
    expect(hashA).not.toBe(hashB);
  });

  it("enthält die IP-Adresse nicht im Klartext", () => {
    const hash = computeVisitorHash(base);
    expect(hash).not.toContain("203");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("unterscheidet verschiedene Besucher", () => {
    const other = computeVisitorHash({ ...base, ip: "198.51.100.7" });
    expect(other).not.toBe(computeVisitorHash(base));
  });

  it("liefert null ohne verwertbare Merkmale", () => {
    expect(
      computeVisitorHash({ secret: SECRET, ip: null, userAgent: null, acceptLanguage: null }),
    ).toBeNull();
  });
});

describe("computeRateLimitIdentifier", () => {
  it("liefert einen stabilen, anonymen Hash", () => {
    const a = computeRateLimitIdentifier({ secret: SECRET, ip: "1.2.3.4", userAgent: "UA" });
    const b = computeRateLimitIdentifier({ secret: SECRET, ip: "1.2.3.4", userAgent: "UA" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain("1.2.3.4");
  });
});
