/**
 * Ziel-URL-Validierung.
 *
 * Standardmäßig sind ALLE HTTPS-Ziele erlaubt ("*"). Über die Environment
 * Variable ALLOWED_DESTINATION_HOSTS kann optional eine Host-Allowlist
 * aktiviert werden (kommagetrennt, Subdomains automatisch eingeschlossen) –
 * z. B. "amazon.de,www.amazon.de,amzn.eu".
 *
 * Unabhängig davon gilt immer: nur HTTPS, keine eingebetteten Zugangsdaten.
 * Ein Open-Redirect-Risiko besteht nicht, da ausschließlich authentifizierte
 * Administratoren Ziele anlegen können und eingehende Query-Parameter die
 * gespeicherte Ziel-URL niemals ersetzen.
 */

/** Platzhalter für "alle Hosts erlaubt". */
export const ALLOW_ALL_HOSTS = "*";

/** Standard: alle HTTPS-Hosts erlaubt. */
export const DEFAULT_ALLOWED_HOSTS = [ALLOW_ALL_HOSTS];

/** Beispiel-Allowlist für eine Beschränkung auf Amazon (siehe README). */
export const AMAZON_HOSTS = ["amazon.de", "www.amazon.de", "amzn.eu"];

/** Parst die kommagetrennte Host-Liste aus der Environment Variable. */
export function parseAllowedHosts(envValue: string | undefined | null): string[] {
  if (!envValue || envValue.trim().length === 0) return [...DEFAULT_ALLOWED_HOSTS];
  if (envValue.trim() === ALLOW_ALL_HOSTS) return [ALLOW_ALL_HOSTS];
  const hosts = envValue
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\.+$/, ""))
    .filter((h) => h.length > 0 && (h === ALLOW_ALL_HOSTS || /^[a-z0-9.-]+$/.test(h)));
  if (hosts.includes(ALLOW_ALL_HOSTS)) return [ALLOW_ALL_HOSTS];
  return hosts.length > 0 ? hosts : [...DEFAULT_ALLOWED_HOSTS];
}

/** Ist die Konfiguration "alle Hosts erlaubt"? */
export function allowsAllHosts(allowedHosts: string[]): boolean {
  return allowedHosts.includes(ALLOW_ALL_HOSTS);
}

/**
 * Sichere Host-Prüfung: exakter Treffer oder echte Subdomain
 * (`hostname` endet auf `"." + allowedHost`).
 * Ein Host wie "amazon.de.example.com" wird bei aktiver Allowlist sicher
 * abgelehnt.
 */
export function isHostAllowed(hostname: string, allowedHosts: string[]): boolean {
  if (allowsAllHosts(allowedHosts)) return true;
  const normalized = hostname.toLowerCase().replace(/\.+$/, "");
  return allowedHosts.some(
    (allowed) => normalized === allowed || normalized.endsWith("." + allowed),
  );
}

export type UrlValidationResult =
  { ok: true; url: string; host: string } | { ok: false; error: string };

/**
 * Validiert eine Ziel-URL für eine Destination:
 * - muss parsebar sein
 * - nur HTTPS
 * - keine eingebetteten Zugangsdaten (user:pass@)
 * - Host muss auf der Allowlist stehen, sofern eine konfiguriert ist
 */
export function validateDestinationUrl(raw: string, allowedHosts: string[]): UrlValidationResult {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Bitte eine Ziel-URL angeben." };
  }
  if (trimmed.length > 2000) {
    return { ok: false, error: "Die Ziel-URL ist zu lang (max. 2000 Zeichen)." };
  }
  if (/\s/.test(trimmed)) {
    return { ok: false, error: "Die Ziel-URL darf keine Leerzeichen enthalten." };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "Die Ziel-URL ist keine gültige URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "Nur HTTPS-Ziel-URLs sind erlaubt." };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, error: "Die Ziel-URL darf keine Zugangsdaten enthalten." };
  }
  if (url.hostname.length === 0 || !url.hostname.includes(".")) {
    return { ok: false, error: "Die Ziel-URL muss einen gültigen Hostnamen enthalten." };
  }
  if (!isHostAllowed(url.hostname, allowedHosts)) {
    return {
      ok: false,
      error: `Der Host "${url.hostname}" ist nicht erlaubt. Zugelassen sind: ${allowedHosts.join(", ")} (inkl. Subdomains).`,
    };
  }

  return { ok: true, url: url.toString(), host: url.hostname.toLowerCase() };
}
