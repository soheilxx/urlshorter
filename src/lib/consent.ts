export type ConsentMode = "required" | "not-required";

export interface ConsentState {
  /** Dürfen Marketing-Pixel (GTM/GA4/Meta) ausgelöst werden? */
  hasMarketingConsent: boolean;
  mode: ConsentMode;
}

/**
 * Bewertet den Consent-Status eines Requests.
 *
 * - Modus "required" (Standard): Marketing-Pixel nur, wenn der konfigurierte
 *   Consent-Cookie exakt den akzeptierten Wert trägt. Ist kein Cookie
 *   konfiguriert, gibt es NIE Marketing-Consent (sicherer Default).
 * - Modus "not-required": Pixel feuern immer. Die rechtliche Bewertung liegt
 *   beim Betreiber (siehe README, Abschnitt Datenschutz).
 */
export function evaluateConsent(opts: {
  mode: ConsentMode;
  cookieName: string | null;
  acceptedValue: string | null;
  cookieValue: string | null;
}): ConsentState {
  if (opts.mode === "not-required") {
    return { hasMarketingConsent: true, mode: opts.mode };
  }
  const configured = Boolean(opts.cookieName && opts.acceptedValue);
  const accepted = configured && opts.cookieValue === opts.acceptedValue;
  return { hasMarketingConsent: accepted, mode: opts.mode };
}

/* --------------------------------------------------------------------------
 * First-Party-Consent-Cookie der Kampagnenseiten (Browser + Server nutzen
 * dieselben Konstanten). Ist in den Environment Variables ein eigener Cookie
 * konfiguriert (CONSENT_COOKIE_NAME / CONSENT_COOKIE_ACCEPTED_VALUE), hat
 * dieser Vorrang – so lässt sich eine externe Consent-Lösung anschließen.
 * ------------------------------------------------------------------------ */

export const DEFAULT_CONSENT_COOKIE_NAME = "lze_marketing_consent";
export const CONSENT_ACCEPTED_VALUE = "accepted";
export const CONSENT_DENIED_VALUE = "denied";
/** Gültigkeit der Entscheidung (Tage). */
export const CONSENT_COOKIE_MAX_AGE_DAYS = 180;
/** Browser-Event, das Zustimmung/Widerruf ohne Reload signalisiert. */
export const CONSENT_CHANGE_EVENT = "lze-consent-change";
/** Browser-Event, mit dem der Footer-Link das Banner erneut öffnet. */
export const CONSENT_OPEN_EVENT = "lze-consent-open";

export interface ConsentCookieConfig {
  name: string;
  acceptedValue: string;
}

/** Wirksamer Cookie (Env-Konfiguration vor Projekt-Default). */
export function resolveConsentCookie(env: {
  CONSENT_COOKIE_NAME: string | null;
  CONSENT_COOKIE_ACCEPTED_VALUE: string | null;
}): ConsentCookieConfig {
  if (env.CONSENT_COOKIE_NAME && env.CONSENT_COOKIE_ACCEPTED_VALUE) {
    return { name: env.CONSENT_COOKIE_NAME, acceptedValue: env.CONSENT_COOKIE_ACCEPTED_VALUE };
  }
  return { name: DEFAULT_CONSENT_COOKIE_NAME, acceptedValue: CONSENT_ACCEPTED_VALUE };
}

/** Wert eines Cookies aus einem Cookie-Header (serverseitig, ohne Framework). */
export function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export type ConsentDecision = "accepted" | "denied" | "undecided";

/** Interpretiert den Cookie-Wert als Entscheidung (nur für die Banner-Logik). */
export function consentDecisionFromValue(
  value: string | null,
  acceptedValue: string,
): ConsentDecision {
  if (value === null) return "undecided";
  if (value === acceptedValue) return "accepted";
  return "denied";
}
