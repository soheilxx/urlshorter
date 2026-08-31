import { SPOTIFY_TRACK_ID } from "@/lib/buch-config";

/**
 * Kompakter Spotify-Player (lazy iframe). Bewusst OHNE Klick-Facade: Das
 * Embed ist selbst click-to-play – eine Facade würde einen Doppelklick
 * erzwingen. Hinweis: Auf dieser Kampagnenseite laden Marketing-Pixel per
 * dokumentierter Betreiber-Entscheidung ohne Consent-Gate (siehe Kommentar
 * in das-buch/page.tsx); wird später ein Consent-Banner ergänzt, dieses
 * Embed mitgaten (dann ebenfalls Click-to-Load).
 */
export function SpotifyEmbed({ title }: { title: string }) {
  return (
    <iframe
      src={`https://open.spotify.com/embed/track/${SPOTIFY_TRACK_ID}?utm_source=generator&theme=0`}
      title={title}
      width="100%"
      height={152}
      loading="lazy"
      allow="encrypted-media; picture-in-picture"
      className="w-full rounded-xl"
    />
  );
}
