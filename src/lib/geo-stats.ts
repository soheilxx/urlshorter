import "server-only";
import { Prisma } from "@prisma/client";
import {
  classifyChannel,
  referrerHost,
  type ChannelId,
} from "@/lib/channels";
import { prisma } from "@/lib/db";
import { getPublicHostname } from "@/lib/env";
import { countryCentroid } from "@/lib/world-map";

/**
 * Aggregationen für den Analytics-Tab (Geo + Kanäle).
 * Es zählen ausschließlich menschliche Klicks (isBot = false).
 */

export interface GeoScope {
  from: Date;
  to: Date;
}

function rangeCond(scope: GeoScope): Prisma.Sql {
  return Prisma.sql`NOT ce."isBot" AND ce."ts" >= ${scope.from} AND ce."ts" < ${scope.to}`;
}

export interface GeoOverview {
  clicks: number;
  uniqueVisitors: number;
  countries: number;
  cities: number;
}

export async function getGeoOverview(scope: GeoScope): Promise<GeoOverview> {
  const rows = await prisma.$queryRaw<
    Array<{ clicks: number; uniques: number; countries: number; cities: number }>
  >(Prisma.sql`
    SELECT count(*)::int AS clicks,
           count(DISTINCT ce."visitorHash")::int AS uniques,
           count(DISTINCT ce."country")::int AS countries,
           count(DISTINCT ce."city")::int AS cities
    FROM "ClickEvent" ce
    WHERE ${rangeCond(scope)}
  `);
  const row = rows[0];
  return {
    clicks: row?.clicks ?? 0,
    uniqueVisitors: row?.uniques ?? 0,
    countries: row?.countries ?? 0,
    cities: row?.cities ?? 0,
  };
}

export interface CountryClicks {
  iso2: string;
  clicks: number;
  uniques: number;
}

export async function getClicksByCountry(scope: GeoScope): Promise<CountryClicks[]> {
  const rows = await prisma.$queryRaw<Array<{ iso2: string; clicks: number; uniques: number }>>(
    Prisma.sql`
      SELECT upper(ce."country") AS iso2,
             count(*)::int AS clicks,
             count(DISTINCT ce."visitorHash")::int AS uniques
      FROM "ClickEvent" ce
      WHERE ${rangeCond(scope)} AND ce."country" IS NOT NULL
      GROUP BY 1
      ORDER BY 2 DESC
    `,
  );
  return rows;
}

export interface GeoMarker {
  /** Anzeige, z. B. "Berlin" oder Ländername bei Klicks ohne Stadt */
  label: string;
  iso2: string | null;
  latitude: number;
  longitude: number;
  clicks: number;
}

/**
 * Standort-Marker: Städte mit Durchschnittskoordinaten; Klicks ohne
 * gespeicherte Koordinaten fallen auf den Länder-Zentroid zurück.
 */
export async function getGeoMarkers(scope: GeoScope, limit = 80): Promise<GeoMarker[]> {
  const cityRows = await prisma.$queryRaw<
    Array<{
      city: string;
      iso2: string | null;
      lat: number | null;
      lng: number | null;
      clicks: number;
    }>
  >(Prisma.sql`
    SELECT ce."city" AS city,
           upper(ce."country") AS iso2,
           avg(ce."latitude") AS lat,
           avg(ce."longitude") AS lng,
           count(*)::int AS clicks
    FROM "ClickEvent" ce
    WHERE ${rangeCond(scope)} AND ce."city" IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 5 DESC
    LIMIT ${limit}
  `);

  // Klicks ganz ohne Stadt: pro Land am Zentroid sammeln.
  const countryOnlyRows = await prisma.$queryRaw<Array<{ iso2: string; clicks: number }>>(
    Prisma.sql`
      SELECT upper(ce."country") AS iso2, count(*)::int AS clicks
      FROM "ClickEvent" ce
      WHERE ${rangeCond(scope)} AND ce."city" IS NULL AND ce."country" IS NOT NULL
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 40
    `,
  );

  const markers: GeoMarker[] = [];
  for (const row of cityRows) {
    let latitude = row.lat;
    let longitude = row.lng;
    if (latitude === null || longitude === null) {
      const centroid = countryCentroid(row.iso2);
      if (!centroid) continue;
      latitude = centroid.latitude;
      longitude = centroid.longitude;
    }
    markers.push({ label: row.city, iso2: row.iso2, latitude, longitude, clicks: row.clicks });
  }
  for (const row of countryOnlyRows) {
    const centroid = countryCentroid(row.iso2);
    if (!centroid) continue;
    markers.push({
      label: row.iso2,
      iso2: row.iso2,
      latitude: centroid.latitude,
      longitude: centroid.longitude,
      clicks: row.clicks,
    });
  }
  return markers.slice(0, limit);
}

interface AttributionRow {
  source: string | null;
  medium: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  referrer: string | null;
  clicks: number;
}

async function getAttributionRows(scope: GeoScope): Promise<AttributionRow[]> {
  return prisma.$queryRaw<AttributionRow[]>(Prisma.sql`
    SELECT ce."source" AS source,
           ce."medium" AS medium,
           ce."utmSource" AS "utmSource",
           ce."utmMedium" AS "utmMedium",
           ce."referrer" AS referrer,
           count(*)::int AS clicks
    FROM "ClickEvent" ce
    WHERE ${rangeCond(scope)}
    GROUP BY 1, 2, 3, 4, 5
    ORDER BY 6 DESC
    LIMIT 5000
  `);
}

export interface ChannelClicks {
  channel: ChannelId;
  clicks: number;
}

export interface ReferrerClicks {
  host: string;
  clicks: number;
}

export interface AttributionBreakdown {
  channels: ChannelClicks[];
  referrers: ReferrerClicks[];
}

/** Kanal-Verteilung + Top-Referrer aus einer gemeinsamen Gruppierung. */
export async function getAttributionBreakdown(scope: GeoScope): Promise<AttributionBreakdown> {
  const rows = await getAttributionRows(scope);
  const ownHost = getPublicHostname();

  const byChannel = new Map<ChannelId, number>();
  const byReferrer = new Map<string, number>();
  for (const row of rows) {
    const channel = classifyChannel(row, ownHost);
    byChannel.set(channel, (byChannel.get(channel) ?? 0) + row.clicks);

    const host = referrerHost(row.referrer);
    if (host && host !== ownHost) {
      byReferrer.set(host, (byReferrer.get(host) ?? 0) + row.clicks);
    }
  }

  const channels = Array.from(byChannel.entries())
    .map(([channel, clicks]) => ({ channel, clicks }))
    .sort((a, b) => b.clicks - a.clicks);
  const referrers = Array.from(byReferrer.entries())
    .map(([host, clicks]) => ({ host, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  return { channels, referrers };
}

export interface ProfileEntry {
  label: string;
  clicks: number;
}

export interface VisitorProfile {
  devices: ProfileEntry[];
  browsers: ProfileEntry[];
  operatingSystems: ProfileEntry[];
}

/** Geräte-/Browser-/OS-Verteilung der Besucher (ohne Bots). */
export async function getVisitorProfile(scope: GeoScope): Promise<VisitorProfile> {
  const where = { isBot: false, ts: { gte: scope.from, lt: scope.to } };
  const [devices, browsers, operatingSystems] = await Promise.all([
    prisma.clickEvent.groupBy({
      by: ["deviceType"],
      _count: { _all: true },
      where,
      orderBy: { _count: { deviceType: "desc" } },
    }),
    prisma.clickEvent.groupBy({
      by: ["browser"],
      _count: { _all: true },
      where,
      orderBy: { _count: { browser: "desc" } },
      take: 6,
    }),
    prisma.clickEvent.groupBy({
      by: ["os"],
      _count: { _all: true },
      where,
      orderBy: { _count: { os: "desc" } },
      take: 6,
    }),
  ]);
  const label = (v: string | null): string => v ?? "Unbekannt";
  return {
    devices: devices.map((d) => ({ label: label(d.deviceType), clicks: d._count._all })),
    browsers: browsers.map((d) => ({ label: label(d.browser), clicks: d._count._all })),
    operatingSystems: operatingSystems.map((d) => ({ label: label(d.os), clicks: d._count._all })),
  };
}

export interface TopLink {
  code: string;
  linkName: string;
  clicks: number;
  uniques: number;
}

/** Meistgeklickte Kurzlinks im Zeitraum (inkl. Unique Visitors). */
export async function getTopLinks(scope: GeoScope, limit = 8): Promise<TopLink[]> {
  return prisma.$queryRaw<TopLink[]>(Prisma.sql`
    SELECT ce."code" AS code,
           ce."linkName" AS "linkName",
           count(*)::int AS clicks,
           count(DISTINCT ce."visitorHash")::int AS uniques
    FROM "ClickEvent" ce
    WHERE ${rangeCond(scope)}
    GROUP BY 1, 2
    ORDER BY 3 DESC
    LIMIT ${limit}
  `);
}

export interface HourActivity {
  hour: number;
  clicks: number;
}

/** Klicks nach Tagesstunde (Europe/Berlin) – zeigt die aktivsten Uhrzeiten. */
export async function getHourlyActivity(scope: GeoScope): Promise<HourActivity[]> {
  const rows = await prisma.$queryRaw<Array<{ hour: number; clicks: number }>>(Prisma.sql`
    SELECT extract(hour FROM ce."ts" AT TIME ZONE 'Europe/Berlin')::int AS hour,
           count(*)::int AS clicks
    FROM "ClickEvent" ce
    WHERE ${rangeCond(scope)}
    GROUP BY 1
    ORDER BY 1
  `);
  const byHour = new Map(rows.map((r) => [r.hour, r.clicks]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    clicks: byHour.get(hour) ?? 0,
  }));
}

export interface RecentClick {
  id: string;
  ts: Date;
  city: string | null;
  iso2: string | null;
  code: string;
  linkName: string;
  deviceType: string | null;
  channel: ChannelId;
}

/** Die letzten menschlichen Klicks (unabhängig vom gewählten Zeitraum). */
export async function getRecentClicks(limit = 12): Promise<RecentClick[]> {
  const rows = await prisma.clickEvent.findMany({
    where: { isBot: false },
    orderBy: { ts: "desc" },
    take: limit,
    select: {
      id: true,
      ts: true,
      city: true,
      country: true,
      code: true,
      linkName: true,
      deviceType: true,
      source: true,
      medium: true,
      utmSource: true,
      utmMedium: true,
      referrer: true,
    },
  });
  const ownHost = getPublicHostname();
  return rows.map((row) => ({
    id: row.id,
    ts: row.ts,
    city: row.city,
    iso2: row.country ? row.country.toUpperCase() : null,
    code: row.code,
    linkName: row.linkName,
    deviceType: row.deviceType,
    channel: classifyChannel(row, ownHost),
  }));
}
