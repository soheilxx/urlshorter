import "server-only";
import { PROVIDER_HOST_ALLOWLIST } from "@/lib/amazon/constants";
import { ProviderError } from "@/lib/amazon/provider-types";
import { redactSecrets, safeErrorMessage } from "@/lib/amazon/redact";

/**
 * Gemeinsamer, gehärteter HTTP-Layer für Provider-Aufrufe:
 * - SSRF-Allowlist (nur bekannte Provider-Hosts)
 * - Timeout über AbortController
 * - Response-Größenlimit
 * - Fehlerklassifizierung ohne Secret-Leaks
 */

const MAX_RESPONSE_BYTES = 5_000_000; // 5 MB – Bestsellerlisten bleiben weit darunter

export function assertAllowedHost(url: string): void {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    throw new ProviderError({ message: "Ungültige Provider-URL.", errorClass: "validation" });
  }
  const allowed = (PROVIDER_HOST_ALLOWLIST as readonly string[]).some(
    (h) => hostname === h || hostname.endsWith(`.${h}`),
  );
  if (!allowed) {
    throw new ProviderError({
      message: `Host nicht in der Allowlist: ${hostname}`,
      errorClass: "validation",
    });
  }
}

/** HTTP-Status klassifizieren; bodySnippet ist bereits redigiert und gekürzt. */
export function classifyHttpStatus(status: number, bodySnippet?: string): ProviderError {
  const detail = bodySnippet ? ` – ${bodySnippet}` : "";
  if (status === 401 || status === 403) {
    return new ProviderError({
      message: `Authentifizierung fehlgeschlagen (HTTP ${status})${detail}.`,
      errorClass: "auth",
      httpStatus: status,
      retryable: false,
    });
  }
  if (status === 402) {
    return new ProviderError({
      message: `Kontingent erschöpft (HTTP 402)${detail}.`,
      errorClass: "quota",
      httpStatus: status,
      retryable: false,
    });
  }
  if (status === 404) {
    return new ProviderError({
      message: `Ressource nicht gefunden (HTTP 404)${detail}.`,
      errorClass: "not_found",
      httpStatus: status,
      retryable: false,
    });
  }
  if (status === 429) {
    return new ProviderError({
      message: "Rate Limit erreicht (HTTP 429).",
      errorClass: "rate_limit",
      httpStatus: status,
    });
  }
  if (status >= 500) {
    return new ProviderError({
      message: `Providerfehler (HTTP ${status}).`,
      errorClass: "server",
      httpStatus: status,
    });
  }
  return new ProviderError({
    message: `Unerwartete Antwort (HTTP ${status})${detail}.`,
    errorClass: "client",
    httpStatus: status,
    retryable: false,
  });
}

export interface ProviderFetchResult {
  json: unknown;
  httpStatus: number;
  latencyMs: number;
}

/** JSON-Request mit Timeout, Allowlist und Größenlimit. Wirft ProviderError. */
export async function providerFetchJson(
  url: string,
  init: RequestInit & { timeoutMs: number },
): Promise<ProviderFetchResult> {
  assertAllowedHost(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError({
        message: `Timeout nach ${init.timeoutMs} ms.`,
        errorClass: "timeout",
      });
    }
    throw new ProviderError({
      message: `Netzwerkfehler: ${safeErrorMessage(error, 120)}`,
      errorClass: "network",
    });
  }
  clearTimeout(timer);
  const latencyMs = Date.now() - started;

  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader && Number.parseInt(lengthHeader, 10) > MAX_RESPONSE_BYTES) {
    throw new ProviderError({
      message: "Antwort überschreitet das Größenlimit.",
      errorClass: "validation",
      retryable: false,
    });
  }

  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new ProviderError({
      message: "Antwort überschreitet das Größenlimit.",
      errorClass: "validation",
      retryable: false,
    });
  }

  if (!response.ok) {
    // Redigierter Auszug der Fehlerantwort (hilft z. B. bei 400ern der
    // Kategorien-API) – ohne Secrets, stark gekürzt.
    const snippet = redactSecrets(text).replace(/\s+/g, " ").slice(0, 160);
    throw classifyHttpStatus(response.status, snippet || undefined);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ProviderError({
      message: "Antwort ist kein gültiges JSON.",
      errorClass: "validation",
      retryable: false,
    });
  }
  return { json, httpStatus: response.status, latencyMs };
}

/** Retry mit exponentiellem Backoff + Jitter – nur für transiente Fehler. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelay = options.baseDelayMs ?? 500;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = error instanceof ProviderError ? error.retryable : false;
      if (!retryable || attempt === attempts) throw error;
      const jitter = Math.random() * 0.4 + 0.8; // 0.8–1.2
      const delay = baseDelay * 2 ** (attempt - 1) * jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
