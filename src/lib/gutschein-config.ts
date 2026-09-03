/**
 * Eckwerte der Newsletter-Gutscheinaktion (/gutschein):
 * Jede registrierte Buchbestellung erhält einen 50-%-Gutschein für den
 * Wiresoft Software Shop. Alle Texte/Fakten ausschließlich hier pflegen.
 */

export const GUTSCHEIN_URL = "https://lizenzzumerfolg.com/gutschein";

export const GUTSCHEIN_RABATT_LABEL = "50 %";
export const GUTSCHEIN_SHOP_NAME = "Wiresoft Software Shop";
export const GUTSCHEIN_SHOP_URL = "https://www.wiresoft.com";

/** Version der Aktionsbedingungen (wird je Ausstellung gespeichert). */
export const GUTSCHEIN_TERMS_VERSION = "1.0 (31.08.2026)";

/** Kurzfassung der Bedingungen – auf der Landingpage sichtbar. */
export const GUTSCHEIN_BEDINGUNGEN = [
  `${GUTSCHEIN_RABATT_LABEL} Rabatt auf das gesamte Sortiment im ${GUTSCHEIN_SHOP_NAME}.`,
  "Ein Gutschein pro Buchbestellung; die Bestellnummer wird bei der Ausstellung geprüft.",
  "Der Code wird nur einmal angezeigt und nicht per E-Mail versendet – bitte sofort kopieren oder notieren.",
  "Nicht mit anderen Aktionen kombinierbar, keine Barauszahlung.",
] as const;

/** Rate Limit der Ausstellungen pro Client-Kennung (wie Gewinnspiel). */
export const GUTSCHEIN_RATE_LIMIT = { maxPerWindow: 5, windowMinutes: 60 };

/** Unterhalb dieses Restbestands warnt das Dashboard. */
export const GUTSCHEIN_LOW_STOCK = 100;

/** Erlaubtes Code-Format beim Import (tolerant: Buchstaben/Ziffern/Bindestrich). */
export const GUTSCHEIN_CODE_PATTERN = /^[A-Za-z0-9-]{4,64}$/;
