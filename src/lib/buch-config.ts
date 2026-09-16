/**
 * Zentrale Eckwerte der Buch-Landingpage /das-buch.
 * Alle Fakten AUSSCHLIESSLICH hier pflegen (Muster: gewinnspiel-config.ts).
 *
 * Bewusst getrennt von ANNOUNCEMENT_DATE_LABEL (Gewinnspiel): Erscheinungs-
 * termin und Gewinnerbekanntgabe fallen nur zufällig auf denselben Tag.
 */

export const BUCH_URL = "https://lizenzzumerfolg.com/das-buch";

export const BUCH_TITEL = "Die Lizenz zum Erfolg";
export const BUCH_UNTERTITEL = "Business ohne Plan, Ausreden oder Kompromisse";
export const BUCH_AUTOR = "Soheil Hosseini";

/**
 * Spendenzusage (Vorgabe von Soheil, 05.09.2026): Die gesamten Einnahmen des
 * Autors aus dem Buch fließen an den Kinderschutzbund – sichtbar im Hero,
 * in der Autor-/Dank-Sektion und in den FAQ, damit eine Bestellung auch als
 * Spende verstanden wird.
 */
export const SPENDEN_EMPFAENGER = "Kinderschutzbund";
export const SPENDEN_HINWEIS = `Die gesamten Einnahmen des Autors aus diesem Buch fließen an den ${SPENDEN_EMPFAENGER}.`;
/** Kein Spendenversprechen des Bestellers – nur der Autorenanteil fließt an den Empfänger. */
export const SPENDEN_WIRKUNG = `Mit jeder Bestellung unterstützt du damit automatisch den ${SPENDEN_EMPFAENGER}`;
export const BUCH_VERLAG = "Deutscher Wirtschaftsbuch Verlag";
export const BUCH_FORMAT_LABEL = "Taschenbuch";
export const BUCH_PREIS_LABEL = "18 €";
export const BUCH_PREIS_SCHEMA = "18.00"; // für JSON-LD (Book/Offer)
export const BUCH_ISBN13 = "9783690662505";
export const BUCH_ERSCHEINT_LABEL = "06.10.2026";
export const BUCH_ERSCHEINT_ISO = "2026-10-06";
/** Erscheinungstag als Zeitpunkt (Europe/Berlin, MESZ) – für zeitabhängige Kauf-Copy. */
export const BUCH_ERSCHEINT_AT = new Date(`${BUCH_ERSCHEINT_ISO}T00:00:00+02:00`);

/** Ist das Buch bereits erschienen? Steuert nur noch den Verfügbarkeitsstatus. */
export function isBookReleased(now: Date = new Date()): boolean {
  return now >= BUCH_ERSCHEINT_AT;
}

/** Bestell-Labels für die Buchseiten (Wortlaut fest, nur `availability` ist zeitabhängig). */
export function buchKaufLabels(now: Date = new Date()) {
  const released = isBookReleased(now);
  return {
    released,
    /**
     * Bestell-Labels – bewusst ohne „kaufen/vorbestellen“ (Vorgabe von Soheil:
     * Bestell-Sprache, kein Kaufzwang-Eindruck); eine Vorbestellung ist ebenfalls
     * eine Bestellung mit gültiger Bestellnummer. Nur `availability` ist zeitabhängig.
     */
    verb: "bestellen",
    primaryCta: "Jetzt bei Amazon bestellen",
    amazonCta: "Bei Amazon bestellen",
    /** Kurzstatus neben dem Preis. */
    availability: released ? "jetzt erhältlich" : `erscheint am ${BUCH_ERSCHEINT_LABEL}`,
  };
}

/** Musikvideo zum Buch (YouTube) und Song (Spotify) – beide heißen wie das Buch. */
export const YOUTUBE_VIDEO_ID = "TeSglGnghVE";
export const SPOTIFY_TRACK_ID = "1Nb1O1U1qC2V80Ztk3atTt";
export const SPOTIFY_TRACK_URL = `https://open.spotify.com/track/${SPOTIFY_TRACK_ID}`;
export const SONG_TITEL = "Die Lizenz zum Erfolg";
