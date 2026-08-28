import { z } from "zod";
import { findTagSite, hostnameAllowed, type TagSite } from "@/lib/tag-config";

/**
 * Validierung + Normalisierung der Collect-Payloads des Tracking-Snippets.
 * Bewusst ohne Server-Abhängigkeiten (unit-testbar).
 *
 * Datensparsamkeit: URLs werden ohne Query-String gespeichert (UTM wird
 * separat als geprüfte Einzelfelder übernommen), Event-Namen sind auf ein
 * enges Format begrenzt, Vendor-Cookies (fbp/fbc/ttp) werden nur transient
 * für die Conversion-APIs genutzt.
 */

const vendorId = z
  .string()
  .trim()
  .max(200)
  .regex(/^[A-Za-z0-9._-]+$/, "ungültig")
  .optional();

const utmValue = z.string().trim().min(1).max(120).optional();

const payloadSchema = z.object({
  site: z.string().min(1).max(50),
  id: z.string().uuid(),
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{1,64}$/, "Ungültiger Event-Name."),
  url: z.string().trim().max(2000).url(),
  ref: z.string().trim().max(300).optional(),
  cid: z.string().uuid().optional(),
  fbp: vendorId,
  fbc: vendorId,
  ttp: vendorId,
  ttclid: vendorId,
  utm: z
    .object({
      source: utmValue,
      medium: utmValue,
      campaign: utmValue,
      content: utmValue,
      term: utmValue,
    })
    .partial()
    .optional(),
});

export interface TagCollectData {
  site: TagSite;
  eventId: string;
  eventName: string;
  /** Volle URL ohne Query/Fragment */
  url: string;
  path: string;
  referrer: string | null;
  cookieId: string | null;
  fbp: string | null;
  fbc: string | null;
  ttp: string | null;
  ttclid: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  };
}

export type TagCollectResult =
  | { ok: true; data: TagCollectData }
  | { ok: false; reason: string };

export function parseTagCollectPayload(raw: unknown): TagCollectResult {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const input = parsed.data;

  const site = findTagSite(input.site);
  if (!site) return { ok: false, reason: "unknown_site" };

  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "invalid_url" };
  }
  // Serverseitige Durchsetzung der Domain-Allowlist (gegen Fremdeinbettung)
  if (!hostnameAllowed(site, url.hostname)) {
    return { ok: false, reason: "host_not_allowed" };
  }

  return {
    ok: true,
    data: {
      site,
      eventId: input.id,
      eventName: input.name,
      url: `${url.origin}${url.pathname}`,
      path: url.pathname || "/",
      referrer: input.ref?.slice(0, 300) || null,
      cookieId: input.cid ?? null,
      fbp: input.fbp ?? null,
      fbc: input.fbc ?? null,
      ttp: input.ttp ?? null,
      ttclid: input.ttclid ?? null,
      utm: {
        source: input.utm?.source ?? null,
        medium: input.utm?.medium ?? null,
        campaign: input.utm?.campaign ?? null,
        content: input.utm?.content ?? null,
        term: input.utm?.term ?? null,
      },
    },
  };
}

/** Origin-/Referer-Header gegen die Site-Allowlist prüfen (Defense in Depth). */
export function originAllowed(site: TagSite, originHeader: string | null): boolean {
  if (!originHeader) return true; // ältere Browser/sendBeacon-Sonderfälle
  try {
    return hostnameAllowed(site, new URL(originHeader).hostname);
  } catch {
    return false;
  }
}
