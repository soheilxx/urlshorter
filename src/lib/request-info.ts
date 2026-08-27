/**
 * Extraktion datensparsamer Request-Informationen.
 * Es werden nur explizit definierte Werte übernommen (keine wahllosen
 * Query-Parameter, keine vollständigen IPs in der Datenbank).
 */

const MAX_VALUE_LENGTH = 300;

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

function sanitize(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, MAX_VALUE_LENGTH);
}

/** Client-IP aus Proxy-Headern (nur zur Hash-Bildung, wird nie gespeichert). */
export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}

export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
  /** Auf eine Nachkommastelle gerundet (~11 km, Stadt-Niveau) – Datensparsamkeit. */
  latitude: number | null;
  longitude: number | null;
}

/** Koordinate parsen, validieren und auf eine Nachkommastelle runden. */
function parseCoordinate(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 10) / 10;
}

/** Geo-Informationen aus den Vercel-Hosting-Headern (falls vorhanden). */
export function getGeoInfo(headers: Headers): GeoInfo {
  const decode = (v: string | null): string | null => {
    if (!v) return null;
    try {
      return sanitize(decodeURIComponent(v));
    } catch {
      return sanitize(v);
    }
  };
  return {
    country: decode(headers.get("x-vercel-ip-country")),
    region: decode(headers.get("x-vercel-ip-country-region")),
    city: decode(headers.get("x-vercel-ip-city")),
    latitude: parseCoordinate(headers.get("x-vercel-ip-latitude"), -90, 90),
    longitude: parseCoordinate(headers.get("x-vercel-ip-longitude"), -180, 180),
  };
}

export interface UtmParams {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

/**
 * Übernimmt AUSSCHLIESSLICH die fünf definierten UTM-Parameter.
 * Alle anderen Query-Parameter werden bewusst ignoriert, damit keine
 * unbeabsichtigten personenbezogenen Daten gespeichert werden.
 */
export function extractUtmParams(searchParams: URLSearchParams): UtmParams {
  return {
    utmSource: sanitize(searchParams.get("utm_source")),
    utmMedium: sanitize(searchParams.get("utm_medium")),
    utmCampaign: sanitize(searchParams.get("utm_campaign")),
    utmContent: sanitize(searchParams.get("utm_content")),
    utmTerm: sanitize(searchParams.get("utm_term")),
  };
}

/** Referrer (gekürzt und bereinigt). */
export function getReferrer(headers: Headers): string | null {
  return sanitize(headers.get("referer"));
}

export { sanitize };
