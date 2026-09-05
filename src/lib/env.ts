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

const stringWithDefault = (def: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : def));

const urlWithDefault = (def: string) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = v?.trim().replace(/\/+$/, "");
      return trimmed && /^https:\/\/[^\s]+$/.test(trimmed) ? trimmed : def;
    });

const boolFlag = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v.trim() === "") return def;
      return ["true", "1", "yes", "on"].includes(v.trim().toLowerCase());
    });

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
  /// GA4-Property lizenzzumerfolg.com (Stream-ID 15519163707). Öffentliche
  /// Measurement-ID als Code-Standard, per Env-Variable überschreibbar.
  GA4_MEASUREMENT_ID: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : "G-4EK7Q83FJ6")),
  META_PIXEL_ID: optionalString,
  META_CAPI_ACCESS_TOKEN: optionalString,
  META_CAPI_TEST_EVENT_CODE: optionalString,
  REDDIT_PIXEL_ID: optionalString,
  REDDIT_CAPI_ACCESS_TOKEN: optionalString,
  REDDIT_CAPI_TEST_ID: optionalString,
  TIKTOK_PIXEL_ID: optionalString,
  TIKTOK_EVENTS_API_TOKEN: optionalString,
  TIKTOK_TEST_EVENT_CODE: optionalString,
  LINKEDIN_PARTNER_ID: optionalString,
  LINKEDIN_CONVERSION_RULE_ID: optionalString,
  LINKEDIN_CAPI_ACCESS_TOKEN: optionalString,
  LINKEDIN_API_VERSION: optionalString,
  TRACKING_CONSENT_MODE: z
    .string()
    .optional()
    .transform((v) => (v === "not-required" ? ("not-required" as const) : ("required" as const))),
  CONSENT_COOKIE_NAME: optionalString,
  CONSENT_COOKIE_ACCEPTED_VALUE: optionalString,
  PRIVACY_URL: optionalString,
  IMPRINT_URL: optionalString,
  ROOT_REDIRECT_URL: z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = v?.trim();
      if (trimmed && /^https:\/\/[^\s]+$/.test(trimmed)) return trimmed;
      return "https://soheil-hosseini.de";
    }),
  BRIDGE_EXTRA_CSP_HOSTS: z.string().optional(),
  SENTRY_DSN: optionalString,

  // --------------------------------------------------------------------------
  // Modul "Amazon Buchrankings" – Secrets NUR serverseitig, niemals loggen.
  // Alle Werte sind Standardwerte; Intervalle etc. sind zusätzlich im
  // Dashboard (AppSetting "amazon.*") ohne Deployment änderbar.
  // --------------------------------------------------------------------------
  AMAZON_RANKING_ENABLED: boolFlag(false),
  RAINFOREST_API_KEY: optionalString,
  RAINFOREST_BASE_URL: urlWithDefault("https://api.rainforestapi.com"),
  RAINFOREST_TIMEOUT_MS: intWithDefault(30_000, 5_000, 120_000),
  AMAZON_CREATORS_CREDENTIAL_ID: optionalString,
  AMAZON_CREATORS_CREDENTIAL_SECRET: optionalString,
  /// Credential-Version bestimmt den regionalen OAuth-Endpoint
  /// (3.1 = US/CA/MX/BR, 3.2 = UK/DE/FR/IT/ES, 3.3 = JP/IN/AU)
  AMAZON_CREATORS_CREDENTIAL_VERSION: optionalString,
  AMAZON_CREATORS_PARTNER_TAG: optionalString,
  AMAZON_CREATORS_MARKETPLACE: stringWithDefault("www.amazon.de"),
  AMAZON_CREATORS_LOCALE: stringWithDefault("de_DE"),
  AMAZON_CREATORS_CURRENCY: stringWithDefault("EUR"),
  /// Basis-URL der Creators API (Katalog-Operationen, POST + Bearer)
  AMAZON_CREATORS_BASE_URL: urlWithDefault("https://creatorsapi.amazon/catalog/v1"),
  /// OAuth-Token-Endpoint (client_credentials; je Credential-Version regional)
  AMAZON_CREATORS_TOKEN_URL: urlWithDefault("https://api.amazon.com/auth/o2/token"),
  AMAZON_PRIMARY_BOOK_ASIN: stringWithDefault("3690662508"),
  AMAZON_PRIMARY_BOOK_ISBN13: stringWithDefault("9783690662505"),
  AMAZON_RANK_DEFAULT_INTERVAL_MINUTES: intWithDefault(60, 15, 1_440),
  AMAZON_LEADERBOARD_DEFAULT_INTERVAL_MINUTES: intWithDefault(180, 15, 10_080),
  AMAZON_METADATA_INTERVAL_MINUTES: intWithDefault(1_440, 60, 10_080),
  AMAZON_PROVIDER_HEALTH_INTERVAL_MINUTES: intWithDefault(15, 5, 1_440),
  AMAZON_ACCOUNT_STATUS_INTERVAL_MINUTES: intWithDefault(360, 60, 1_440),
  AMAZON_DIGEST_TIME: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{2}:\d{2}$/.test(v.trim()) ? v.trim() : "08:00")),
  AMAZON_TIMEZONE: stringWithDefault("Europe/Berlin"),
  AMAZON_PROVIDER_TIMEOUT_MS: intWithDefault(30_000, 5_000, 120_000),
  AMAZON_RAW_PAYLOAD_RETENTION_DAYS: intWithDefault(30, 1, 90),
  /// 0 = unbegrenzt aufbewahren
  AMAZON_RANK_RETENTION_DAYS: intWithDefault(0, 0, 36_500),
  AMAZON_RANKING_DAILY_CREDIT_BUDGET: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number.parseInt(v, 10) : Number.NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    }),
  AMAZON_SALES_ESTIMATION_ENABLED: boolFlag(false),
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
