/**
 * Nicht-personenbezogene Tracking-Events der Gewinnspielseite.
 * Es werden ausschließlich Event-NAMEN übermittelt – niemals Formulardaten,
 * Bestellnummern, Referenzen oder sonstige personenbezogene Inhalte.
 */
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
    w.fbq?.("trackCustom", name);
  } catch {
    // Tracking darf niemals die Seite stören.
  }
}
