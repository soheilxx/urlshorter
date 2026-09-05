/**
 * Nicht-personenbezogene Tracking-Events der Gewinnspielseite.
 * Es werden ausschließlich Event-NAMEN übermittelt – niemals Formulardaten,
 * Bestellnummern, Referenzen oder sonstige personenbezogene Inhalte.
 */
const AMAZON_CLICK_EVENTS = new Set(["gewinnspiel_amazon_klick", "buch_amazon_klick"]);

export function trackGewinnEvent(name: string): void {
  if (typeof window === "undefined") return;
  try {
    const w = window as unknown as {
      dataLayer?: Array<Record<string, unknown>>;
      fbq?: (...args: unknown[]) => void;
      gtag?: (...args: unknown[]) => void;
    };
    w.dataLayer?.push({ event: name });
    w.gtag?.("event", name);
    // Amazon-Klicks laufen bei Meta als Standardevent "AddToCart" (Pixel + CAPI,
    // book-conversion-tracking.tsx) – kein zusätzliches Custom-Event.
    if (!AMAZON_CLICK_EVENTS.has(name)) w.fbq?.("trackCustom", name);
  } catch {
    // Tracking darf niemals die Seite stören.
  }
}
