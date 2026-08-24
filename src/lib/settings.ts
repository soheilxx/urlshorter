import "server-only";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

/**
 * Anwendungseinstellungen (AppSetting-Tabelle) mit kurzem In-Memory-Cache.
 * Die Redirect-Verzögerung kann im Dashboard geändert werden und überschreibt
 * den Env-Standardwert DEFAULT_REDIRECT_DELAY_MS.
 */

export const SETTING_REDIRECT_DELAY = "redirect_delay_ms";

export const REDIRECT_DELAY_MIN = 300;
export const REDIRECT_DELAY_MAX = 2000;

interface CacheEntry {
  value: string | null;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

export async function getSetting(key: string): Promise<string | null> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }
  const row = await prisma.appSetting.findUnique({ where: { key } });
  const value = row?.value ?? null;
  cache.set(key, { value, fetchedAt: Date.now() });
  return value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  cache.set(key, { value, fetchedAt: Date.now() });
}

/** Nur für Tests. */
export function clearSettingsCache(): void {
  cache.clear();
}

export function clampRedirectDelay(value: number): number {
  if (!Number.isFinite(value)) return getEnv().DEFAULT_REDIRECT_DELAY_MS;
  return Math.min(REDIRECT_DELAY_MAX, Math.max(REDIRECT_DELAY_MIN, Math.round(value)));
}

/**
 * Effektive Redirect-Verzögerung: DB-Einstellung, sonst Env-Standard.
 * Fällt bei DB-Fehlern sicher auf den Env-Wert zurück, damit die
 * Weiterleitung nie an einer Einstellung scheitert.
 */
export async function getRedirectDelayMs(): Promise<number> {
  try {
    const raw = await getSetting(SETTING_REDIRECT_DELAY);
    if (raw !== null) {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) return clampRedirectDelay(parsed);
    }
  } catch {
    // bewusst ignorieren – Fallback auf Env
  }
  return getEnv().DEFAULT_REDIRECT_DELAY_MS;
}
