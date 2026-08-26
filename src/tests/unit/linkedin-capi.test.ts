import { describe, expect, it } from "vitest";
import { buildLinkedInCapiPayload, isValidLiFatId, toConversionUrn } from "@/lib/linkedin-capi";

describe("toConversionUrn", () => {
  it("baut aus einer numerischen ID die vollständige URN", () => {
    expect(toConversionUrn("1234567")).toBe("urn:lla:llaPartnerConversion:1234567");
  });

  it("reicht eine vollständige URN unverändert durch", () => {
    expect(toConversionUrn("urn:lla:llaPartnerConversion:987")).toBe(
      "urn:lla:llaPartnerConversion:987",
    );
  });
});

describe("isValidLiFatId", () => {
  it("akzeptiert plausible li_fat_id-Werte", () => {
    expect(isValidLiFatId("AQEXAMPLE-1234_abc.def")).toBe(true);
    expect(isValidLiFatId("12345678")).toBe(true);
  });

  it("verwirft leere, zu kurze und unsichere Werte", () => {
    expect(isValidLiFatId(null)).toBe(false);
    expect(isValidLiFatId(undefined)).toBe(false);
    expect(isValidLiFatId("")).toBe(false);
    expect(isValidLiFatId("kurz")).toBe(false);
    expect(isValidLiFatId('böse"<script>alert(1)</script>')).toBe(false);
    expect(isValidLiFatId("x".repeat(250))).toBe(false);
  });
});

describe("buildLinkedInCapiPayload", () => {
  it("baut das Conversion-Event mit eventId und li_fat_id", () => {
    const payload = buildLinkedInCapiPayload({
      conversionRuleId: "1234567",
      accessToken: "test-li-token",
      eventId: "11111111-2222-3333-4444-555555555555",
      eventTimeMs: 1_756_000_000_123,
      liFatId: "AQEXAMPLE-1234",
    });
    expect(payload).toEqual({
      conversion: "urn:lla:llaPartnerConversion:1234567",
      conversionHappenedAt: 1_756_000_000_123,
      eventId: "11111111-2222-3333-4444-555555555555",
      user: {
        userIds: [
          {
            idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID",
            idValue: "AQEXAMPLE-1234",
          },
        ],
      },
    });
  });

  it("enthält das Access Token NICHT im Payload (wird als Header gesendet)", () => {
    const payload = buildLinkedInCapiPayload({
      conversionRuleId: "1",
      accessToken: "test-li-token",
      eventId: "id",
      eventTimeMs: 1,
      liFatId: "AQEXAMPLE-1234",
    });
    expect(JSON.stringify(payload)).not.toContain("test-li-token");
  });
});
