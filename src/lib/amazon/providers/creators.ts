import "server-only";
import { CREATORS_CAPABILITIES } from "@/lib/amazon/constants";
import {
  parseCreatorsGetItems,
  type CreatorsParseResult,
} from "@/lib/amazon/providers/creators-parse";
import { providerFetchJson, withRetry } from "@/lib/amazon/providers/http";
import { ProviderError, type ProviderTestResult } from "@/lib/amazon/provider-types";
import { safeErrorMessage } from "@/lib/amazon/redact";
import { getEnv } from "@/lib/env";

/**
 * Amazon Creators API (Nachfolger der PA-API 5).
 *
 * - OAuth 2.0 Client Credentials gegen AMAZON_CREATORS_TOKEN_URL
 *   (Scope "creatorsapi::default", Token 3600 s)
 * - Katalog-Operationen: POST {BASE_URL}/getItems mit Bearer-Token und
 *   Header "x-marketplace" (z. B. www.amazon.de), lowerCamelCase-Felder,
 *   max. 10 ASINs pro Batch.
 *
 * Tokens und Credential Secret verlassen dieses Modul NIE: kein Logging,
 * keine Speicherung, keine Fehlerobjekte mit Secrets (safeErrorMessage).
 */

const GETITEMS_RESOURCES = [
  "browseNodeInfo.browseNodes",
  "browseNodeInfo.browseNodes.ancestor",
  "browseNodeInfo.browseNodes.salesRank",
  "browseNodeInfo.websiteSalesRank",
  "images.primary.small",
  "images.primary.medium",
  "images.primary.large",
  "itemInfo.title",
  "itemInfo.byLineInfo",
  "itemInfo.classifications",
  "itemInfo.contentInfo",
  "itemInfo.externalIds",
  "itemInfo.features",
  "itemInfo.manufactureInfo",
  "itemInfo.productInfo",
  "parentASIN",
  "offersV2.listings.availability",
  "offersV2.listings.price",
  "offersV2.listings.isBuyBoxWinner",
];

const MAX_ITEMS_PER_BATCH = 10;

interface TokenCache {
  token: string;
  expiresAt: number;
}

// Modulweiter Token-Cache mit Single-Flight-Lock gegen parallele Erneuerungen.
let tokenCache: TokenCache | null = null;
let tokenInflight: Promise<string> | null = null;

export function isCreatorsConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.AMAZON_CREATORS_CREDENTIAL_ID &&
      env.AMAZON_CREATORS_CREDENTIAL_SECRET &&
      env.AMAZON_CREATORS_PARTNER_TAG,
  );
}

/** Nur für Tests: Token-Cache zurücksetzen. */
export function resetCreatorsTokenCache(): void {
  tokenCache = null;
  tokenInflight = null;
}

/**
 * Regionaler OAuth-Endpoint nach Credential-Version (überschreibbar via
 * AMAZON_CREATORS_TOKEN_URL): 3.1 = US/CA/MX/BR, 3.2 = UK/DE/FR/IT/ES,
 * 3.3 = JP/IN/AU.
 */
export function resolveTokenUrl(): string {
  const env = getEnv();
  if (process.env.AMAZON_CREATORS_TOKEN_URL?.trim()) return env.AMAZON_CREATORS_TOKEN_URL;
  const version = env.AMAZON_CREATORS_CREDENTIAL_VERSION;
  if (version?.startsWith("3.2")) return "https://api.amazon.co.uk/auth/o2/token";
  if (version?.startsWith("3.3")) return "https://api.amazon.co.jp/auth/o2/token";
  return env.AMAZON_CREATORS_TOKEN_URL;
}

async function fetchAccessToken(): Promise<string> {
  const env = getEnv();
  if (!isCreatorsConfigured()) {
    throw new ProviderError({
      message: "Amazon Creators API ist nicht konfiguriert.",
      errorClass: "not_configured",
      retryable: false,
    });
  }
  const { json, httpStatus } = await providerFetchJson(resolveTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.AMAZON_CREATORS_CREDENTIAL_ID,
      client_secret: env.AMAZON_CREATORS_CREDENTIAL_SECRET,
      scope: "creatorsapi::default",
    }),
    timeoutMs: env.AMAZON_PROVIDER_TIMEOUT_MS,
  });
  const body = json as { access_token?: unknown; expires_in?: unknown };
  const token = typeof body.access_token === "string" ? body.access_token : null;
  if (!token) {
    throw new ProviderError({
      message: `OAuth-Antwort ohne access_token (HTTP ${httpStatus}).`,
      errorClass: "auth",
      retryable: false,
    });
  }
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  // 120 s Sicherheitsabstand vor Ablauf
  tokenCache = { token, expiresAt: Date.now() + Math.max(60, expiresIn - 120) * 1000 };
  return token;
}

/** Access-Token mit Cache + Single-Flight (verhindert parallele Erneuerungen). */
export async function getCreatorsAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  if (tokenInflight) return tokenInflight;
  tokenInflight = withRetry(() => fetchAccessToken(), { attempts: 2 }).finally(() => {
    tokenInflight = null;
  });
  return tokenInflight;
}

export interface CreatorsGetItemsResult extends CreatorsParseResult {
  latencyMs: number;
  requestCount: number;
  rawPayloads: unknown[];
}

/**
 * GetItems für bis zu N ASINs (automatisch in 10er-Batches).
 * Bei abgelaufenem Token wird genau einmal transparent erneuert.
 */
export async function creatorsGetItems(asins: string[]): Promise<CreatorsGetItemsResult> {
  const env = getEnv();
  const unique = [...new Set(asins.map((a) => a.trim().toUpperCase()))].filter(Boolean);
  const result: CreatorsGetItemsResult = {
    ranks: [],
    metadata: [],
    errors: [],
    latencyMs: 0,
    requestCount: 0,
    rawPayloads: [],
  };

  for (let i = 0; i < unique.length; i += MAX_ITEMS_PER_BATCH) {
    const batch = unique.slice(i, i + MAX_ITEMS_PER_BATCH);
    const call = async (forceFreshToken: boolean): Promise<void> => {
      if (forceFreshToken) tokenCache = null;
      const token = await getCreatorsAccessToken();
      const { json, latencyMs } = await providerFetchJson(
        `${env.AMAZON_CREATORS_BASE_URL}/getItems`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-marketplace": env.AMAZON_CREATORS_MARKETPLACE,
          },
          body: JSON.stringify({
            itemIds: batch,
            partnerTag: env.AMAZON_CREATORS_PARTNER_TAG,
            resources: GETITEMS_RESOURCES,
            languagesOfPreference: [env.AMAZON_CREATORS_LOCALE],
            currencyOfPreference: env.AMAZON_CREATORS_CURRENCY,
          }),
          timeoutMs: env.AMAZON_PROVIDER_TIMEOUT_MS,
        },
      );
      const parsed = parseCreatorsGetItems(json);
      result.ranks.push(...parsed.ranks);
      result.metadata.push(...parsed.metadata);
      result.errors.push(...parsed.errors);
      result.latencyMs += latencyMs;
      result.requestCount += 1;
      result.rawPayloads.push(json);
    };

    try {
      await withRetry(() => call(false), { attempts: 2 });
    } catch (error) {
      // Abgelaufener/ungültiger Token: einmalig mit frischem Token wiederholen
      if (error instanceof ProviderError && error.errorClass === "auth") {
        await call(true);
      } else {
        throw error;
      }
    }
  }

  return result;
}

/** Verbindungstest ohne Secret-Ausgabe (nur konfiguriert/ok/Latenz). */
export async function testCreatorsConnection(): Promise<ProviderTestResult> {
  const testedAt = new Date();
  if (!isCreatorsConfigured()) {
    return {
      configured: false,
      ok: false,
      latencyMs: null,
      capabilities: CREATORS_CAPABILITIES,
      message: "Nicht konfiguriert (AMAZON_CREATORS_CREDENTIAL_ID/SECRET/PARTNER_TAG fehlen).",
      testedAt,
    };
  }
  const started = Date.now();
  try {
    tokenCache = null; // echter End-zu-End-Test inkl. Token-Abruf
    await getCreatorsAccessToken();
    return {
      configured: true,
      ok: true,
      latencyMs: Date.now() - started,
      capabilities: CREATORS_CAPABILITIES,
      message: "OAuth-Token erfolgreich abgerufen.",
      testedAt,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - started,
      capabilities: CREATORS_CAPABILITIES,
      message: safeErrorMessage(error),
      testedAt,
    };
  }
}
