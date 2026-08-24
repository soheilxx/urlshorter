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
