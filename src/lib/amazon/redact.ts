/**
 * Secret-Redaktion für Logs, Fehlermeldungen und gespeicherte Payloads.
 * Rainforest-API-Keys stehen als Query-Parameter in URLs, Amazon-Tokens in
 * Authorization-Headern – beides darf niemals gespeichert oder geloggt werden.
 */

const QUERY_SECRET_PARAMS = ["api_key", "client_secret", "access_token", "token"];

/** Entfernt Secrets aus beliebigem Text (URLs, Fehlermeldungen). */
export function redactSecrets(text: string): string {
  let result = text;
  for (const param of QUERY_SECRET_PARAMS) {
    result = result.replace(
      new RegExp(`([?&]${param}=)[^&\\s"']*`, "gi"),
      "$1REDACTED",
    );
  }
  // Bearer-Token und JSON-Felder mit Secrets
  result = result
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer REDACTED")
    .replace(/("(?:client_secret|access_token|refresh_token|api_key)"\s*:\s*")[^"]*(")/gi, "$1REDACTED$2");
  return result;
}

/** Sichere Fehlermeldung: redigiert und längenbegrenzt. */
export function safeErrorMessage(error: unknown, maxLength = 300): string {
  const raw = error instanceof Error ? error.message : String(error);
  return redactSecrets(raw).slice(0, maxLength);
}

/**
 * Redigiert ein JSON-Objekt rekursiv: entfernt bekannte Secret-Felder und
 * bereinigt String-Werte (z. B. request_metadata-URLs mit api_key).
 */
export function redactJson(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[max_depth]";
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map((v) => redactJson(v, depth + 1));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (/^(api_key|client_secret|access_token|refresh_token|authorization|email)$/i.test(key)) {
        result[key] = "REDACTED";
      } else {
        result[key] = redactJson(v, depth + 1);
      }
    }
    return result;
  }
  return value;
}
