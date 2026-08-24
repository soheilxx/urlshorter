import { createHmac } from "node:crypto";

/**
 * Anonymisierter, NICHT rückrechenbarer Besucher-Hash für Unique-Visitor-
 * Zählungen (ähnlich dem Verfahren von Plausible Analytics):
 *
 *   Tagesschlüssel = HMAC(APP_SECRET, "visitor-rotation:" + <UTC-Datum>)
 *   Hash           = HMAC(Tagesschlüssel, ip + "|" + userAgent + "|" + sprache)
 *
 * - Die vollständige IP-Adresse wird NIE gespeichert.
 * - Der Schlüssel rotiert täglich; ein Hash lässt sich über Tage hinweg nicht
 *   verketten und die IP nicht rekonstruieren.
 */
export function computeVisitorHash(opts: {
  secret: string;
  ip: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
  now?: Date;
}): string | null {
  const { secret, ip, userAgent, acceptLanguage } = opts;
  if (!ip && !userAgent) return null;

  const day = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const dailyKey = createHmac("sha256", secret).update(`visitor-rotation:${day}`).digest();
  return createHmac("sha256", dailyKey)
    .update(`${ip ?? ""}|${userAgent ?? ""}|${acceptLanguage ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * HMAC-Hash einer Client-Kennung für das Login-Rate-Limiting.
 * Auch hier wird keine IP-Adresse im Klartext gespeichert.
 */
export function computeRateLimitIdentifier(opts: {
  secret: string;
  ip: string | null;
  userAgent: string | null;
}): string {
  return createHmac("sha256", opts.secret)
    .update(`ratelimit:${opts.ip ?? "unknown"}|${opts.userAgent ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}
