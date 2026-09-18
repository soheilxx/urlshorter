/**
 * Nicht-personenbezogene Tracking-Events der Gewinnspielseiten.
 * Es werden ausschließlich Event-NAMEN und feste fachliche Parameter
 * (z. B. giveaway_campaign, cta_position) übermittelt – niemals Formulardaten,
 * Bestellnummern, Referenzen oder sonstige personenbezogene Inhalte.
 */
const AMAZON_CLICK_EVENTS = new Set([
  "gewinnspiel_amazon_klick",
  "buch_amazon_klick",
  "verlosung_amazon_klick",
  "cards_amazon_klick",
]);

/**
 * Hilfsaktionen (Link kopieren, Teilen-Dialog, Formular geöffnet) sind
 * Interesse, keine Conversion: nur Analyse-Modell (dataLayer/GA4), keine
 * Werbe-Pixel-Events.
 */
const ANALYTICS_ONLY_EVENTS = new Set([
  "verlosung_link_kopiert",
  "verlosung_teilen_geoeffnet",
  "verlosung_weitere_bestellnummer",
  "verlosung_formular_geoeffnet",
  "cards_link_kopiert",
  "cards_teilen_geoeffnet",
  "cards_teilen_whatsapp",
  "cards_teilen_telegram",
  "cards_weitere_bestellnummer",
  "cards_formular_geoeffnet",
]);

/** Feste, nicht-personenbezogene Parameter (Allowlist-Werte, nie Formularinhalte). */
export type TrackingParams = Record<string, string | number | boolean>;

type TrackingWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  ttq?: { track?: (...args: unknown[]) => void };
};

export function trackGewinnEvent(name: string, params?: TrackingParams): void {
  if (typeof window === "undefined") return;
  try {
    const w = window as unknown as TrackingWindow;
    w.dataLayer?.push({ event: name, ...(params ?? {}) });
    w.gtag?.("event", name, params ?? {});
    // Amazon-Klicks laufen bei Meta als Standardevent "AddToCart" (Pixel + CAPI,
    // book-conversion-tracking.tsx) – kein zusätzliches Custom-Event.
    if (!AMAZON_CLICK_EVENTS.has(name) && !ANALYTICS_ONLY_EVENTS.has(name)) {
      w.fbq?.("trackCustom", name, params ?? {});
    }
  } catch {
    // Tracking darf niemals die Seite stören.
  }
}

/**
 * Registrierung tatsächlich gespeichert: Standardevent "CompleteRegistration"
 * bei Meta und TikTok mit der vom Server vergebenen Ereignis-ID (der Server
 * sendet dasselbe Event mit derselben ID an die Conversion-APIs → Dedup).
 * Bedeutung: Anmeldung eingegangen – KEINE Kaufverifikation.
 *
 * `params` trägt die fachliche Kampagne (giveaway_campaign, landing_path);
 * Meta erhält sie zusätzlich als content_category, TikTok als description.
 */
export function trackRegistrationCompleted(eventId: string, params?: TrackingParams): void {
  if (typeof window === "undefined") return;
  const campaign = typeof params?.giveaway_campaign === "string" ? params.giveaway_campaign : null;
  try {
    const w = window as unknown as TrackingWindow;
    w.dataLayer?.push({ event: "gewinnspiel_teilnahme", event_id: eventId, ...(params ?? {}) });
    w.gtag?.("event", "gewinnspiel_teilnahme", { event_id: eventId, ...(params ?? {}) });
  } catch {
    /* siehe oben */
  }
  try {
    (window as unknown as TrackingWindow).fbq?.(
      "track",
      "CompleteRegistration",
      {
        content_name: "Gewinnspiel-Teilnahme",
        status: "received",
        ...(campaign ? { content_category: campaign } : {}),
        ...(params ?? {}),
      },
      { eventID: eventId },
    );
  } catch {
    /* Ein blockiertes Pixel darf den Erfolg nicht stören. */
  }
  try {
    (window as unknown as TrackingWindow).ttq?.track?.(
      "CompleteRegistration",
      {
        content_name: "Gewinnspiel-Teilnahme",
        ...(campaign ? { description: `giveaway_campaign=${campaign}` } : {}),
      },
      { event_id: eventId },
    );
  } catch {
    /* siehe oben */
  }
}
