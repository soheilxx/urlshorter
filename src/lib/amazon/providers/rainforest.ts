import "server-only";
import { RAINFOREST_CAPABILITIES } from "@/lib/amazon/constants";
import { providerFetchJson, withRetry } from "@/lib/amazon/providers/http";
import {
  parseRainforestAccount,
  parseRainforestBestsellers,
  parseRainforestCategories,
  parseRainforestProductMetadata,
  parseRainforestProductRanks,
  parseRequestInfo,
} from "@/lib/amazon/providers/rainforest-parse";
import {
  ProviderError,
  type NormalizedCategory,
  type NormalizedLeaderboard,
  type NormalizedProductMetadata,
  type NormalizedProductRanks,
  type ProviderQuotaStatus,
  type ProviderTestResult,
} from "@/lib/amazon/provider-types";
import { redactJson, safeErrorMessage } from "@/lib/amazon/redact";
import { getEnv } from "@/lib/env";

/**
 * Rainforest API (api.rainforestapi.com).
 *
 * Der API-Key wird ausschließlich hier serverseitig an die URL angehängt und
 * taucht in keinem Log, keiner Fehlermeldung und keinem gespeicherten Payload
 * auf (redactJson/safeErrorMessage). Alle Requests laufen mit
 * include_html=false; Roh-HTML wird niemals gespeichert.
 */

export interface RainforestCallResult<T> {
  data: T;
  creditsUsed: number | null;
  creditsRemaining: number | null;
  latencyMs: number;
  /** Redigierter Payload (für AmazonRawPayload, max. 30 Tage). */
  redactedPayload: unknown;
}

export function isRainforestConfigured(): boolean {
  return Boolean(getEnv().RAINFOREST_API_KEY);
}

function buildUrl(path: string, params: Record<string, string>): string {
  const env = getEnv();
  if (!env.RAINFOREST_API_KEY) {
    throw new ProviderError({
      message: "Rainforest API ist nicht konfiguriert (RAINFOREST_API_KEY fehlt).",
      errorClass: "not_configured",
      retryable: false,
    });
  }
  const url = new URL(`${env.RAINFOREST_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("api_key", env.RAINFOREST_API_KEY);
  return url.toString();
}

async function rainforestRequest(path: string, params: Record<string, string>): Promise<{
  json: unknown;
  latencyMs: number;
}> {
  const env = getEnv();
  const url = buildUrl(path, params);
  const { json, latencyMs } = await withRetry(
    () =>
      providerFetchJson(url, {
        method: "GET",
        timeoutMs: env.RAINFOREST_TIMEOUT_MS,
      }),
    { attempts: 2 },
  );
  // Rainforest meldet Fehler teils mit HTTP 200 + success:false
  const info = parseRequestInfo(json);
  const rootObj = json as { request_info?: { success?: unknown; message?: unknown } };
  if (rootObj.request_info && rootObj.request_info.success === false) {
    const message =
      typeof rootObj.request_info.message === "string"
        ? rootObj.request_info.message
        : "Rainforest meldet success=false.";
    const lowered = message.toLowerCase();
    const errorClass = lowered.includes("credit")
      ? "quota"
      : lowered.includes("api_key") || lowered.includes("api key")
        ? "auth"
        : lowered.includes("not found") || lowered.includes("invalid")
          ? "not_found"
          : "client";
    throw new ProviderError({
      message: safeErrorMessage(message, 200),
      errorClass,
      retryable: false,
    });
  }
  void info;
  return { json, latencyMs };
}

function wrap<T>(json: unknown, latencyMs: number, data: T): RainforestCallResult<T> {
  const info = parseRequestInfo(json);
  return {
    data,
    creditsUsed: info.creditsUsed,
    creditsRemaining: info.creditsRemaining,
    latencyMs,
    redactedPayload: redactJson(json),
  };
}

/** type=product – Ränge + Metadaten des eigenen Buchs. */
export async function rainforestGetProduct(asin: string): Promise<
  RainforestCallResult<{
    ranks: NormalizedProductRanks | null;
    metadata: NormalizedProductMetadata | null;
  }>
> {
  const env = getEnv();
  const params: Record<string, string> = {
    type: "product",
    amazon_domain: env.AMAZON_CREATORS_MARKETPLACE.replace(/^www\./, ""),
    asin,
    output: "json",
    include_html: "false",
  };
  if (env.AMAZON_CREATORS_PARTNER_TAG) params.associate_id = env.AMAZON_CREATORS_PARTNER_TAG;
  const { json, latencyMs } = await rainforestRequest("/request", params);
  return wrap(json, latencyMs, {
    ranks: parseRainforestProductRanks(json),
    metadata: parseRainforestProductMetadata(json),
  });
}

/**
 * type=bestsellers – Top-25-Liste. Primär über die Kategorie-ID; wenn diese
 * nicht mehr funktioniert, Fallback über die gespeicherte Bestseller-URL.
 */
export async function rainforestGetBestsellers(options: {
  categoryId?: string | null;
  categoryUrl?: string | null;
  limit?: number;
}): Promise<RainforestCallResult<NormalizedLeaderboard | null>> {
  const env = getEnv();
  const limit = options.limit ?? 25;
  const base: Record<string, string> = {
    type: "bestsellers",
    output: "json",
    include_html: "false",
    page: "1",
  };
  const byCategory: Record<string, string> | null = options.categoryId
    ? {
        ...base,
        amazon_domain: env.AMAZON_CREATORS_MARKETPLACE.replace(/^www\./, ""),
        category_id: options.categoryId,
      }
    : null;
  const byUrl: Record<string, string> | null = options.categoryUrl
    ? { ...base, url: options.categoryUrl }
    : null;

  if (!byCategory && !byUrl) {
    throw new ProviderError({
      message: "Weder Kategorie-ID noch Bestseller-URL vorhanden.",
      errorClass: "validation",
      retryable: false,
    });
  }

  try {
    const params = byCategory ?? byUrl!;
    const { json, latencyMs } = await rainforestRequest("/request", params);
    const parsed = parseRainforestBestsellers(json, limit);
    // Manche Kategorie-IDs (v. a. Browse-Node-IDs aus Produktantworten)
    // liefern success + leere Liste → Fallback über die Bestseller-URL.
    if (byCategory && byUrl && (!parsed || parsed.entries.length === 0)) {
      const viaUrl = await rainforestRequest("/request", byUrl);
      return wrap(viaUrl.json, latencyMs + viaUrl.latencyMs, parseRainforestBestsellers(viaUrl.json, limit));
    }
    return wrap(json, latencyMs, parsed);
  } catch (error) {
    // Fallback innerhalb von Rainforest: gespeicherte Bestseller-URL
    if (byCategory && byUrl && error instanceof ProviderError && !error.retryable) {
      const { json, latencyMs } = await rainforestRequest("/request", byUrl);
      return wrap(json, latencyMs, parseRainforestBestsellers(json, limit));
    }
    throw error;
  }
}

/**
 * Kategorienliste OHNE Suchbegriff (Wurzelkategorien bzw. Kinder von
 * parent_id). Umgeht die Suche, deren search_term-Parameter bei Umlauten
 * (z. B. "Sachbücher") mit HTTP 400 abgelehnt wird – der Abgleich erfolgt
 * dann lokal über normalisierte Namen.
 */
export async function rainforestListCategories(
  parentId?: string | null,
): Promise<RainforestCallResult<NormalizedCategory[]>> {
  const env = getEnv();
  const params: Record<string, string> = {
    domain: env.AMAZON_CREATORS_MARKETPLACE.replace(/^www\./, ""),
    type: "bestsellers",
  };
  if (parentId) params.parent_id = parentId;
  const { json, latencyMs } = await rainforestRequest("/categories", params);
  return wrap(json, latencyMs, parseRainforestCategories(json));
}

/** Categories API (type=bestsellers) – u. a. Sachbücher-Auflösung. */
export async function rainforestSearchCategories(
  searchTerm: string,
): Promise<RainforestCallResult<NormalizedCategory[]>> {
  const env = getEnv();
  const { json, latencyMs } = await rainforestRequest("/categories", {
    domain: env.AMAZON_CREATORS_MARKETPLACE.replace(/^www\./, ""),
    type: "bestsellers",
    search_term: searchTerm,
  });
  return wrap(json, latencyMs, parseRainforestCategories(json));
}

/** Account API (kostenlos) – Credits/Plan/Status; api_key wird nie übernommen. */
export async function rainforestGetAccount(): Promise<
  RainforestCallResult<ProviderQuotaStatus | null>
> {
  const { json, latencyMs } = await rainforestRequest("/account", {});
  return wrap(json, latencyMs, parseRainforestAccount(json));
}

/** Verbindungstest über die kostenlose Account API. */
export async function testRainforestConnection(): Promise<ProviderTestResult> {
  const testedAt = new Date();
  if (!isRainforestConfigured()) {
    return {
      configured: false,
      ok: false,
      latencyMs: null,
      capabilities: RAINFOREST_CAPABILITIES,
      message: "Nicht konfiguriert (RAINFOREST_API_KEY fehlt).",
      testedAt,
    };
  }
  const started = Date.now();
  try {
    const result = await rainforestGetAccount();
    const plan = result.data?.plan ?? "unbekannt";
    return {
      configured: true,
      ok: true,
      latencyMs: Date.now() - started,
      capabilities: RAINFOREST_CAPABILITIES,
      message: `Account erreichbar (Plan: ${plan}).`,
      testedAt,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - started,
      capabilities: RAINFOREST_CAPABILITIES,
      message: safeErrorMessage(error),
      testedAt,
    };
  }
}
