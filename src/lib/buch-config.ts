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
export const BUCH_VERLAG = "Deutscher Wirtschaftsbuch Verlag";
export const BUCH_FORMAT_LABEL = "Taschenbuch";
export const BUCH_PREIS_LABEL = "18 €";
export const BUCH_PREIS_SCHEMA = "18.00"; // für JSON-LD (Book/Offer)
export const BUCH_ISBN13 = "9783690662505";
export const BUCH_ERSCHEINT_LABEL = "06.10.2026";
export const BUCH_ERSCHEINT_ISO = "2026-10-06";

/** Musikvideo zum Buch (YouTube) und Song (Spotify) – beide heißen wie das Buch. */
export const YOUTUBE_VIDEO_ID = "TeSglGnghVE";
export const SPOTIFY_TRACK_ID = "1Nb1O1U1qC2V80Ztk3atTt";
export const SPOTIFY_TRACK_URL = `https://open.spotify.com/track/${SPOTIFY_TRACK_ID}`;
export const SONG_TITEL = "Die Lizenz zum Erfolg";
