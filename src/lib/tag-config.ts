/**
 * Zentrale Konfiguration des Tracking-Snippets (t.js).
 *
 * Jede angebundene Website bekommt eine Site-ID und eine Domain-Allowlist.
 * Die Allowlist verhindert, dass Fremde das Snippet auf ihren Seiten
 * einbetten und damit unsere Pixel/Daten verfälschen: t.js prüft die
 * Hostname-Zugehörigkeit im Browser UND der Collect-Endpoint erzwingt sie
 * serverseitig (Origin + gemeldete URL).
 *
 * Neue Website anbinden: Eintrag ergänzen, deployen, Snippet einbauen:
 *   <script async src="https://lizenzzumerfolg.com/t.js" data-site="SITE_ID"></script>
 */

export interface TagSite {
  id: string;
  label: string;
  /** Erlaubte Hostnames (Subdomains sind automatisch eingeschlossen). */
  domains: string[];
}

export const TAG_SITES: TagSite[] = [
  {
    id: "lizenzzumerfolg",
    label: "lizenzzumerfolg.com",
    domains: ["lizenzzumerfolg.com"],
  },
  {
    id: "soheil-hosseini",
    label: "soheil-hosseini.de",
    domains: ["soheil-hosseini.de"],
  },
  {
    // Für lokale Funktionstests; kann nach dem Rollout entfernt werden.
    id: "test",
    label: "Lokale Tests",
    domains: ["localhost", "127.0.0.1"],
  },
];

export function findTagSite(siteId: string): TagSite | null {
  return TAG_SITES.find((s) => s.id === siteId) ?? null;
}

/** Komma-separierte Domain-Liste normalisieren. */
export function parseDomainList(raw: string): string[] {
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/\.$/, ""))
    .filter((d) => d.length > 0);
}

/** Hostname-Prüfung inkl. Subdomains ("www.example.de" passt zu "example.de"). */
export function domainsAllowHostname(domains: string[], hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function hostnameAllowed(site: TagSite, hostname: string): boolean {
  return domainsAllowHostname(site.domains, hostname);
}

/** Site-ID → Domains als kompaktes Objekt fürs generierte Script. */
export function siteDomainMap(): Record<string, string[]> {
  return Object.fromEntries(TAG_SITES.map((s) => [s.id, s.domains]));
}
