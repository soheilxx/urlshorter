import { hmacSign, hmacVerify } from "@/lib/signing";

/**
 * Kurzlebige, signierte Event-Tokens.
 * Format: `<eventId>.<expiresAtEpochMs>.<hmacSignatur>`
 *
 * Die Bridge-Page erhält das Token und darf damit ausschließlich die
 * Client-Status-Flags des zugehörigen Click-Events aktualisieren.
 * Die Kenntnis einer Event-ID allein reicht NICHT aus – ohne gültige
 * Signatur wird jede Änderung abgelehnt.
 */

export const EVENT_TOKEN_TTL_MS = 15 * 60 * 1000;

export async function createEventToken(
  eventId: string,
  secret: string,
  ttlMs: number = EVENT_TOKEN_TTL_MS,
  now: number = Date.now(),
): Promise<string> {
  const expiresAt = now + ttlMs;
  const payload = `${eventId}.${expiresAt}`;
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

/**
 * Verifiziert ein Event-Token. Gibt bei Erfolg die Event-ID zurück,
 * sonst null (ungültige Signatur, abgelaufen oder fehlerhaftes Format).
 */
export async function verifyEventToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<string | null> {
  if (typeof token !== "string" || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [eventId, expiresRaw, signature] = parts as [string, string, string];
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  if (!/^\d{1,16}$/.test(expiresRaw)) return null;

  const valid = await hmacVerify(`${eventId}.${expiresRaw}`, signature, secret);
  if (!valid) return null;

  const expiresAt = Number.parseInt(expiresRaw, 10);
  if (!Number.isFinite(expiresAt) || now > expiresAt) return null;

  return eventId;
}
