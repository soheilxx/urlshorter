import { describe, expect, it } from "vitest";
import { evaluateConsent } from "@/lib/consent";

describe("evaluateConsent", () => {
  it("Modus 'required': Consent nur bei exakt passendem Cookie-Wert", () => {
    const base = { mode: "required" as const, cookieName: "mc", acceptedValue: "accepted" };
    expect(evaluateConsent({ ...base, cookieValue: "accepted" }).hasMarketingConsent).toBe(true);
    expect(evaluateConsent({ ...base, cookieValue: "denied" }).hasMarketingConsent).toBe(false);
    expect(evaluateConsent({ ...base, cookieValue: "ACCEPTED" }).hasMarketingConsent).toBe(false);
    expect(evaluateConsent({ ...base, cookieValue: null }).hasMarketingConsent).toBe(false);
  });

  it("Modus 'required' ohne konfigurierten Cookie: niemals Marketing-Consent (sicherer Default)", () => {
    expect(
      evaluateConsent({
        mode: "required",
        cookieName: null,
        acceptedValue: null,
        cookieValue: "accepted",
      }).hasMarketingConsent,
    ).toBe(false);
  });

  it("Modus 'not-required': immer Marketing-Consent", () => {
    expect(
      evaluateConsent({
        mode: "not-required",
        cookieName: null,
        acceptedValue: null,
        cookieValue: null,
      }).hasMarketingConsent,
    ).toBe(true);
  });
});
