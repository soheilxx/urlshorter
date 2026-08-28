import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { requireAppSecret } from "@/lib/env";

/**
 * Verschlüsselte Ablage von Anbieter-Tokens (TRACK.SITE Site-Konfiguration).
 * AES-256-GCM mit per HKDF aus APP_SECRET abgeleitetem Schlüssel – gleiches
 * Muster wie die Bestellnummern des Gewinnspiels, eigener Ableitungs-Kontext.
 */

function deriveKey(): Buffer {
  return Buffer.from(
    hkdfSync("sha256", requireAppSecret(), "urlshorter-tag-secrets", "site-secret-v1", 32),
  );
}

/** "v1:<iv>:<tag>:<ciphertext>" (alles base64). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(":");
    if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Maskierte Anzeige für die Admin-UI, z. B. "••••4f2a". */
export function maskSecret(payload: string | null | undefined): string | null {
  const plain = decryptSecret(payload);
  if (!plain) return null;
  return `••••${plain.slice(-4)}`;
}
