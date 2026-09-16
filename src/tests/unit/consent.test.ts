import { describe, expect, it } from "vitest";
import {
  consentDecisionFromValue,
  DEFAULT_CONSENT_COOKIE_NAME,
  evaluateConsent,
  readCookieValue,
  resolveConsentCookie,
} from "@/lib/consent";

describe("First-Party-Consent-Cookie (Banner)", () => {
  it("nutzt den Projekt-Default, wenn kein Cookie per Env konfiguriert ist", () => {
    expect(
      resolveConsentCookie({ CONSENT_COOKIE_NAME: null, CONSENT_COOKIE_ACCEPTED_VALUE: null }),
    ).toEqual({ name: DEFAULT_CONSENT_COOKIE_NAME, acceptedValue: "accepted" });
    // Nur ein halb konfigurierter Env-Cookie → Default (kein Cookie ohne Akzeptanzwert)
    expect(
      resolveConsentCookie({ CONSENT_COOKIE_NAME: "cmp", CONSENT_COOKIE_ACCEPTED_VALUE: null }).name,
    ).toBe(DEFAULT_CONSENT_COOKIE_NAME);
  });
  it("bevorzugt eine vollständige Env-Konfiguration (externe Consent-Lösung)", () => {
    expect(
      resolveConsentCookie({ CONSENT_COOKIE_NAME: "cmp", CONSENT_COOKIE_ACCEPTED_VALUE: "ok" }),
    ).toEqual({ name: "cmp", acceptedValue: "ok" });
  });
  it("liest Cookie-Werte aus dem Header (URL-dekodiert, exakter Name)", () => {
    const header = "a=1; lze_marketing_consent=accepted; lze_marketing_consent_x=denied; b=%20x";
    expect(readCookieValue(header, "lze_marketing_consent")).toBe("accepted");
    expect(readCookieValue(header, "lze_marketing_consent_x")).toBe("denied");
    expect(readCookieValue(header, "b")).toBe(" x");
    expect(readCookieValue(header, "missing")).toBeNull();
    expect(readCookieValue(null, "a")).toBeNull();
  });
  it("übersetzt den Cookie-Wert in eine Entscheidung", () => {
    expect(consentDecisionFromValue(null, "accepted")).toBe("undecided");
    expect(consentDecisionFromValue("accepted", "accepted")).toBe("accepted");
    expect(consentDecisionFromValue("denied", "accepted")).toBe("denied");
    expect(consentDecisionFromValue("irgendwas", "accepted")).toBe("denied");
  });
});

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
