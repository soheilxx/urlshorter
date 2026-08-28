import "server-only";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { decryptSecret } from "@/lib/secrets";
import { parseDomainList, TAG_SITES } from "@/lib/tag-config";
export { domainsAllowHostname, parseDomainList } from "@/lib/tag-config";

/**
 * Auflösung der Site-Konfiguration für TRACK.SITE:
 * 1. Datenbank (Dashboard-Verwaltung, per-Site Pixel-IDs + Tokens)
 * 2. Code-Bootstrap (TAG_SITES) mit globalen Env-Werten als Fallback
 *
 * Nicht gesetzte DB-Felder fallen pro Feld auf die Env-Werte zurück, damit
 * die eigenen Bestands-Sites ohne doppelte Pflege weiterlaufen.
 */

export interface ResolvedTagSite {
  id: string;
  label: string;
  domains: string[];
  active: boolean;
  source: "db" | "code";
  pixels: {
    ga4: string | null;
    gtm: string | null;
    meta: string | null;
    tiktok: string | null;
    reddit: string | null;
    linkedin: string | null;
  };
  capi: {
    metaToken: string | null;
    metaTestEventCode: string | null;
    tiktokToken: string | null;
    tiktokTestEventCode: string | null;
  };
}

function envPixels() {
  const env = getEnv();
  return {
    ga4: env.GA4_MEASUREMENT_ID ?? null,
    gtm: env.GTM_CONTAINER_ID ?? null,
    meta: env.META_PIXEL_ID ?? null,
    tiktok: env.TIKTOK_PIXEL_ID ?? null,
    reddit: env.REDDIT_PIXEL_ID ?? null,
    linkedin: env.LINKEDIN_PARTNER_ID ?? null,
  };
}

function envCapi() {
  const env = getEnv();
  return {
    metaToken: env.META_CAPI_ACCESS_TOKEN ?? null,
    metaTestEventCode: env.META_CAPI_TEST_EVENT_CODE ?? null,
    tiktokToken: env.TIKTOK_EVENTS_API_TOKEN ?? null,
    tiktokTestEventCode: env.TIKTOK_TEST_EVENT_CODE ?? null,
  };
}

export async function resolveTagSite(siteId: string): Promise<ResolvedTagSite | null> {
  if (!/^[a-z0-9-]{1,50}$/.test(siteId)) return null;

  const db = await prisma.tagSiteConfig.findUnique({ where: { id: siteId } });
  if (db) {
    const fallbackPixels = envPixels();
    const fallbackCapi = envCapi();
    return {
      id: db.id,
      label: db.label,
      domains: parseDomainList(db.domains),
      active: db.active,
      source: "db",
      pixels: {
        ga4: db.ga4MeasurementId ?? fallbackPixels.ga4,
        gtm: db.gtmContainerId ?? fallbackPixels.gtm,
        meta: db.metaPixelId ?? fallbackPixels.meta,
        tiktok: db.tiktokPixelId ?? fallbackPixels.tiktok,
        reddit: db.redditPixelId ?? fallbackPixels.reddit,
        linkedin: db.linkedinPartnerId ?? fallbackPixels.linkedin,
      },
      capi: {
        metaToken: decryptSecret(db.metaCapiTokenEncrypted) ?? fallbackCapi.metaToken,
        metaTestEventCode: fallbackCapi.metaTestEventCode,
        tiktokToken: decryptSecret(db.tiktokTokenEncrypted) ?? fallbackCapi.tiktokToken,
        tiktokTestEventCode: fallbackCapi.tiktokTestEventCode,
      },
    };
  }

  const code = TAG_SITES.find((s) => s.id === siteId);
  if (!code) return null;
  return {
    id: code.id,
    label: code.label,
    domains: code.domains,
    active: true,
    source: "code",
    pixels: envPixels(),
    capi: envCapi(),
  };
}

/** Alle Sites für Verwaltung/Statistik (DB überschreibt gleichnamige Code-Sites). */
export async function listTagSites(): Promise<ResolvedTagSite[]> {
  const dbSites = await prisma.tagSiteConfig.findMany({ orderBy: { createdAt: "asc" } });
  const resolved = new Map<string, ResolvedTagSite>();
  for (const code of TAG_SITES) {
    resolved.set(code.id, {
      id: code.id,
      label: code.label,
      domains: code.domains,
      active: true,
      source: "code",
      pixels: envPixels(),
      capi: envCapi(),
    });
  }
  for (const db of dbSites) {
    const fallbackPixels = envPixels();
    const fallbackCapi = envCapi();
    resolved.set(db.id, {
      id: db.id,
      label: db.label,
      domains: parseDomainList(db.domains),
      active: db.active,
      source: "db",
      pixels: {
        ga4: db.ga4MeasurementId ?? fallbackPixels.ga4,
        gtm: db.gtmContainerId ?? fallbackPixels.gtm,
        meta: db.metaPixelId ?? fallbackPixels.meta,
        tiktok: db.tiktokPixelId ?? fallbackPixels.tiktok,
        reddit: db.redditPixelId ?? fallbackPixels.reddit,
        linkedin: db.linkedinPartnerId ?? fallbackPixels.linkedin,
      },
      capi: {
        metaToken: decryptSecret(db.metaCapiTokenEncrypted) ?? fallbackCapi.metaToken,
        metaTestEventCode: fallbackCapi.metaTestEventCode,
        tiktokToken: decryptSecret(db.tiktokTokenEncrypted) ?? fallbackCapi.tiktokToken,
        tiktokTestEventCode: fallbackCapi.tiktokTestEventCode,
      },
    });
  }
  return Array.from(resolved.values());
}
