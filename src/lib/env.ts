import "server-only";
import { z } from "zod";
import { allowsAllHosts, DEFAULT_ALLOWED_HOSTS, parseAllowedHosts } from "@/lib/url-validation";

/**
 * Zentrale, defensive Env-Verarbeitung.
 * Wichtig: Der Zugriff erfolgt lazy (erst zur Laufzeit im Request), damit der
 * Produktions-Build auch ohne gesetzte Secrets funktioniert.
 */

const intWithDefault = (def: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number.parseInt(v, 10) : def;
      if (!Number.isFinite(n)) return def;
      return Math.min(max, Math.max(min, n));
    });

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : null));

const envSchema = z.object({
  DATABASE_URL: optionalString,
  PUBLIC_BASE_URL: z
    .string()
    .optional()
    .transform((v) =>
      v && v.trim() ? v.trim().replace(/\/+$/, "") : "https://lizenzzumerfolg.com",
    ),
  AUTH_SECRET: optionalString,
  APP_SECRET: optionalString,
  ADMIN_EMAIL: optionalString,
  ADMIN_PASSWORD_HASH: optionalString,
  ADMIN_PASSWORD_HASH_BASE64: optionalString,
  ALLOWED_DESTINATION_HOSTS: z.string().optional(),
  DEFAULT_REDIRECT_DELAY_MS: intWithDefault(900, 300, 2000),
  EVENT_RETENTION_DAYS: intWithDefault(90, 1, 3650),
  CRON_SECRET: optionalString,
  GTM_CONTAINER_ID: optionalString,
  GA4_MEASUREMENT_ID: optionalString,
  META_PIXEL_ID: optionalString,
  META_CAPI_ACCESS_TOKEN: optionalString,
  META_CAPI_TEST_EVENT_CODE: optionalString,
  REDDIT_PIXEL_ID: optionalString,
  TRACKING_CONSENT_MODE: z
    .string()
    .optional()
    .transform((v) => (v === "not-required" ? ("not-required" as const) : ("required" as const))),
  CONSENT_COOKIE_NAME: optionalString,
  CONSENT_COOKIE_ACCEPTED_VALUE: optionalString,
  PRIVACY_URL: optionalString,
  IMPRINT_URL: optionalString,
  BRIDGE_EXTRA_CSP_HOSTS: z.string().optional(),
  SENTRY_DSN: optionalString,
});

export type AppEnv = z.infer<typeof envSchema> & {
  allowedDestinationHosts: string[];
  bridgeExtraCspHosts: string[];
};

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.parse(process.env);
  cached = {
    ...parsed,
    allowedDestinationHosts: parseAllowedHosts(parsed.ALLOWED_DESTINATION_HOSTS),
    bridgeExtraCspHosts: (parsed.BRIDGE_EXTRA_CSP_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter((h) => /^[a-z0-9.*-]+$/i.test(h)),
  };
  return cached;
}

/** Nur für Tests: Cache zurücksetzen. */
export function resetEnvCache(): void {
  cached = null;
}

export { DEFAULT_ALLOWED_HOSTS };

/** Hinweistext zur Ziel-URL-Beschränkung für die Admin-Formulare. */
export function getDestinationHostsHint(): string {
  const env = getEnv();
  return allowsAllHosts(env.allowedDestinationHosts)
    ? "Beliebige HTTPS-Ziel-URL erlaubt (Amazon, Landingpages, Shops …)."
    : `Erlaubte Hosts: ${env.allowedDestinationHosts.join(", ")} (inkl. Subdomains).`;
}

/** Anzeigename der Anwendung (Hostname der PUBLIC_BASE_URL, z. B. "lizenzzumerfolg.com"). */
export function getPublicHostname(): string {
  try {
    return new URL(getEnv().PUBLIC_BASE_URL).hostname;
  } catch {
    return "lizenzzumerfolg.com";
  }
}

export interface AuthEnv {
  adminEmail: string;
  adminPasswordHash: string;
  authSecret: string;
}

/**
 * Liefert den konfigurierten bcrypt-Hash. Bevorzugt wird die Base64-Variante
 * (ADMIN_PASSWORD_HASH_BASE64), da bcrypt-Hashes "$"-Zeichen enthalten, die
 * von manchen Env-Loadern als Variablenreferenz interpretiert und dadurch
 * zerstört werden.
 */
function resolveAdminPasswordHash(env: {
  ADMIN_PASSWORD_HASH: string | null;
  ADMIN_PASSWORD_HASH_BASE64: string | null;
}): string | null {
  if (env.ADMIN_PASSWORD_HASH_BASE64) {
    try {
      const decoded = Buffer.from(env.ADMIN_PASSWORD_HASH_BASE64, "base64").toString("utf8");
      if (decoded.startsWith("$2")) return decoded;
    } catch {
      // ignorieren – Fallback auf Klartext-Variante
    }
  }
  if (env.ADMIN_PASSWORD_HASH && env.ADMIN_PASSWORD_HASH.startsWith("$2")) {
    return env.ADMIN_PASSWORD_HASH;
  }
  return null;
}

/**
 * Prüft, ob der Admin-Zugang vollständig konfiguriert ist.
 * Fehlende Variablen führen NIE zu einem unsicheren Fallback, sondern zu einer
 * verständlichen Setup-Meldung auf der Login-Seite.
 */
export function getAuthEnv(): { ok: true; auth: AuthEnv } | { ok: false; missing: string[] } {
  const env = getEnv();
  const missing: string[] = [];
  if (!env.ADMIN_EMAIL) missing.push("ADMIN_EMAIL");
  const passwordHash = resolveAdminPasswordHash(env);
  if (!passwordHash) {
    missing.push("ADMIN_PASSWORD_HASH_BASE64 (oder ADMIN_PASSWORD_HASH; gültiger bcrypt-Hash)");
  }
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32)
    missing.push("AUTH_SECRET (min. 32 Zeichen)");
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    auth: {
      adminEmail: env.ADMIN_EMAIL as string,
      adminPasswordHash: passwordHash as string,
      authSecret: env.AUTH_SECRET as string,
    },
  };
}

/** APP_SECRET für Event-Tokens/Visitor-Hashes; wirft mit klarer Meldung, wenn nicht gesetzt. */
export function requireAppSecret(): string {
  const env = getEnv();
  if (!env.APP_SECRET || env.APP_SECRET.length < 32) {
    throw new Error(
      "APP_SECRET ist nicht gesetzt oder zu kurz (min. 32 Zeichen). Bitte in den Environment Variables hinterlegen.",
    );
  }
  return env.APP_SECRET;
}
