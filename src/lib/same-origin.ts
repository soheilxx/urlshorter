/**
 * Same-Origin-Prüfung für First-Party-Beacons (Buch-/Reddit-Collector).
 * `request.url` trägt hinter Proxys (Vercel) bzw. bei lokalem `next start`
 * nicht immer den vom Browser gesehenen Host (z. B. localhost vs. 127.0.0.1),
 * deshalb zählen zusätzlich der Host-Header (inkl. x-forwarded-*) und die
 * kanonische PUBLIC_BASE_URL. Die eigentliche Absicherung ist der signierte
 * Tracking-Kontext im Body.
 */
export function isSameOrigin(request: Request, publicBaseUrl: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const url = new URL(request.url);
  const allowed = new Set<string>([url.origin]);
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  if (host) allowed.add(`${proto}://${host}`);
  try {
    allowed.add(new URL(publicBaseUrl).origin);
  } catch {
    /* ungültige Basis-URL zählt nicht */
  }
  return allowed.has(origin);
}
