import { base64UrlDecode, base64UrlEncode, hmacSign, hmacVerify } from "@/lib/signing";

/**
 * Zustandslose, HMAC-signierte Admin-Session.
 * Läuft in Edge (Middleware) und Node identisch (Web Crypto).
 *
 * Format: base64url(JSON-Payload) + "." + HMAC-Signatur
 */

export const SESSION_COOKIE_NAME = "urlshorter_session";
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 Stunden

export interface SessionPayload {
  /** E-Mail des Administrators */
  sub: string;
  /** Ausgestellt (Epoch-Sekunden) */
  iat: number;
  /** Ablauf (Epoch-Sekunden) */
  exp: number;
}

export async function createSessionToken(
  email: string,
  authSecret: string,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS,
  now: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: SessionPayload = { sub: email, iat: now, exp: now + maxAgeSeconds };
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSign(`session.${encoded}`, authSecret);
  return `${encoded}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  authSecret: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<SessionPayload | null> {
  if (!token || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts as [string, string];

  const valid = await hmacVerify(`session.${encoded}`, signature, authSecret);
  if (!valid) return null;

  const bytes = base64UrlDecode(encoded);
  if (!bytes) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as SessionPayload;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.exp !== "number" ||
      typeof payload.iat !== "number"
    ) {
      return null;
    }
    if (now >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
