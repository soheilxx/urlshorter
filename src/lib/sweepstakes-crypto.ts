import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { requireAppSecret } from "@/lib/env";

/**
 * Kryptografie für das Gewinnspiel:
 * - HMAC-Hash der normalisierten Bestellnummer (Duplikaterkennung, nicht rückrechenbar)
 * - AES-256-GCM-Verschlüsselung der Original-Bestellnummer (spätere Händler-Prüfung)
 * - Teilnahme-Referenznummern (kryptografisch zufällig, verwechslungsarm)
 *
 * Schlüssel werden per HKDF aus APP_SECRET abgeleitet (kein zweites Secret nötig).
 */

const HKDF_SALT = "urlshorter-sweepstakes";

function deriveKey(info: string): Buffer {
  return Buffer.from(hkdfSync("sha256", requireAppSecret(), HKDF_SALT, info, 32));
}

/** Nicht rückrechenbarer Hash der normalisierten Bestellnummer. */
export function hashOrderNumber(normalizedOrderNumber: string): string {
  return createHmac("sha256", deriveKey("order-hash-v1"))
    .update(normalizedOrderNumber, "utf8")
    .digest("hex");
}

/** AES-256-GCM: "v1:<iv>:<tag>:<ciphertext>" (alles base64). */
export function encryptOrderNumber(plaintext: string): string {
  const key = deriveKey("order-encrypt-v1");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptOrderNumber(payload: string): string | null {
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(":");
    if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const key = deriveKey("order-encrypt-v1");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Verwechslungsarmes Alphabet (ohne 0/O/1/I/L). */
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Erzeugt eine Teilnahme-Referenz, z. B. "K7M2X9AB" (8 Zeichen, ohne Präfix). */
export function generateReferenceNumber(): string {
  const bytes = randomBytes(8);
  let reference = "";
  for (let i = 0; i < 8; i++) {
    reference += REFERENCE_ALPHABET[(bytes[i] as number) % REFERENCE_ALPHABET.length];
  }
  return reference;
}

export function newEntryId(): string {
  return randomUUID();
}

/**
 * Signiertes Formular-Token (Ausgabezeitpunkt): schützt gegen Sofort-Submits
 * von Bots und abgestandene Formulare. Format: base64url(iat).hmac
 */
export function createFormToken(now: number = Date.now()): string {
  const payload = Buffer.from(String(now), "utf8").toString("base64url");
  const sig = createHmac("sha256", deriveKey("form-token-v1")).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyFormToken(
  token: string | null | undefined,
  minAgeMs: number,
  maxAgeMs: number,
  now: number = Date.now(),
): boolean {
  if (!token || token.length > 128) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", deriveKey("form-token-v1"))
    .update(payload)
    .digest("base64url");
  if (sig !== expected) return false;
  const iat = Number.parseInt(Buffer.from(payload, "base64url").toString("utf8"), 10);
  if (!Number.isFinite(iat)) return false;
  const age = now - iat;
  return age >= minAgeMs && age <= maxAgeMs;
}
