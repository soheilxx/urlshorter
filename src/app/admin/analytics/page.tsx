import type { Metadata } from "next";
import Link from "next/link";
import { BucketBarChart } from "@/components/admin/charts";
import { GeoMap, type MapCountry, type MapMarker } from "@/components/admin/geo-map";
import { GeoBarList, LiveFeed } from "@/components/admin/geo-panels";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { CHANNEL_COLORS, CHANNEL_LABELS } from "@/lib/channels";
import {
  getAttributionBreakdown,
  getClicksByCountry,
  getGeoMarkers,
  getGeoOverview,
  getHourlyActivity,
  getRecentClicks,
  getTopLinks,
  getVisitorProfile,
} from "@/lib/geo-stats";
import { resolveRange } from "@/lib/date-range";
import { cn, formatNumber } from "@/lib/utils";
import {
  countryNameDe,
  getWorldCountryShapes,
  projectCoordinate,
  WORLD_MAP_HEIGHT,
  WORLD_MAP_WIDTH,
} from "@/lib/world-map";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const RANGE_OPTIONS = [
  { key: "today", label: "Heute" },
  { key: "yesterday", label: "Gestern" },
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "90d", label: "90 Tage" },
  { key: "all", label: "Gesamt" },
];

/**
 * Choroplethen-Füllung über Theme-Variablen (--map-ramp-0…8): passt sich dem
 * Hell-/Dunkel-Modus an; die Auflösung übernimmt die GeoMap per style-Attribut.
 */
const RAMP_STEPS = 9;
const LAND_WITHOUT_DATA = "var(--map-land)";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const params = await searchParams;
  const rangeParam = typeof params.range === "string" ? params.range : undefined;
  const range = resolveRange(rangeParam);
  const scope = { from: range.from, to: range.to };

  const [overview, byCountry, geoMarkers, attribution, recentClicks, profile, topLinks, hourly] =
    await Promise.all([
      getGeoOverview(scope),
      getClicksByCountry(scope),
      getGeoMarkers(scope),
      getAttributionBreakdown(scope),
      getRecentClicks(12),
      getVisitorProfile(scope),
      getTopLinks(scope, 8),
      getHourlyActivity(scope),
    ]);

  // Choroplethen-Füllung: Wurzel-Skalierung, damit kleinere Länder neben dem
  // Spitzenreiter sichtbar bleiben.
  const clicksByIso2 = new Map(byCountry.map((c) => [c.iso2, c.clicks]));
  const maxCountryClicks = Math.max(...byCountry.map((c) => c.clicks), 1);
  const countries: MapCountry[] = getWorldCountryShapes().map((shape) => {
    const clicks = shape.iso2 ? (clicksByIso2.get(shape.iso2) ?? 0) : 0;
    let fill = LAND_WITHOUT_DATA;
    if (clicks > 0) {
      const t = Math.sqrt(clicks / maxCountryClicks);
      const step = Math.min(RAMP_STEPS - 1, Math.floor(t * RAMP_STEPS));
      fill = `var(--map-ramp-${step})`;
    }
    return { iso2: shape.iso2, name: shape.name, d: shape.d, clicks, fill };
  });

  const maxMarkerClicks = Math.max(...geoMarkers.map((m) => m.clicks), 1);
  const markers: MapMarker[] = [];
  for (const marker of geoMarkers) {
    const point = projectCoordinate(marker.latitude, marker.longitude);
    if (!point) continue;
    markers.push({
      label: marker.label,
      sublabel: marker.iso2 ? countryNameDe(marker.iso2) : null,
      x: point.x,
      y: point.y,
      r: 3.5 + Math.sqrt(marker.clicks / maxMarkerClicks) * 10.5,
      clicks: marker.clicks,
    });
  }
  // Kleine Marker zuerst zeichnen, große (mit Tooltip-Priorität) oben.
  markers.sort((a, b) => b.clicks - a.clicks).reverse();

  const buildHref = (nextRange: string) =>
    nextRange === "30d" ? "/admin/analytics" : `/admin/analytics?range=${nextRange}`;

  const topCountries = byCountry.slice(0, 8).map((c) => ({
    label: countryNameDe(c.iso2),
    clicks: c.clicks,
    hint: `· ${formatNumber(c.uniques)} Besucher`,
  }));
  const topCities = geoMarkers
    .filter((m) => m.label && m.iso2 !== m.label)
    .slice(0, 8)
    .map((m) => ({
      label: m.label,
      sublabel: m.iso2 ? countryNameDe(m.iso2) : null,
      clicks: m.clicks,
    }));

  // Besucher-Details: Anteile für Geräte/Browser/OS
  const deviceTotal = profile.devices.reduce((sum, d) => sum + d.clicks, 0);
  const share = (clicks: number): string | null =>
    deviceTotal > 0 ? `· ${Math.round((clicks / deviceTotal) * 100)} %` : null;
  const mobileClicks = profile.devices
    .filter((d) => /mobil|phone|smartphone/i.test(d.label))
    .reduce((sum, d) => sum + d.clicks, 0);
  const topChannel = attribution.channels[0] ?? null;

  const hourlyData = hourly.map((h) => ({
    label: `${String(h.hour).padStart(2, "0")}`,
    clicks: h.clicks,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-xl font-bold tracking-tight">Analytics</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              Live
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Besucherstandorte, Geräte und Kanäle · {range.label} · Ohne Bots · Zeitzone
            Europe/Berlin
          </p>
        </div>
        <div className="flex rounded-lg border border-zinc-200 bg-surface p-0.5 shadow-sm">
          {RANGE_OPTIONS.map((opt) => (
            <Link
              key={opt.key}
              href={buildHref(opt.key)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                range.key === opt.key
                  ? "bg-primary text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Klicks" value={formatNumber(overview.clicks)} hint={range.label} />
        <StatCard
          label="Unique Visitors"
          value={formatNumber(overview.uniqueVisitors)}
          hint="anonymisiert"
        />
        <StatCard label="Länder" value={formatNumber(overview.countries)} />
        <StatCard label="Städte" value={formatNumber(overview.cities)} />
        <StatCard
          label="Mobil-Anteil"
          value={deviceTotal > 0 ? `${Math.round((mobileClicks / deviceTotal) * 100)} %` : "–"}
          hint="der Klicks"
        />
        <StatCard
          label="Top-Kanal"
          value={topChannel ? CHANNEL_LABELS[topChannel.channel] : "–"}
          hint={topChannel ? `${formatNumber(topChannel.clicks)} Klicks` : undefined}
        />
      </div>

      {/* Karte + Live-Feed */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Geo-Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <GeoMap
              width={WORLD_MAP_WIDTH}
              height={WORLD_MAP_HEIGHT}
              countries={countries}
              markers={markers}
            />
            <p className="mt-2 text-[11px] text-zinc-400">
              Mausrad oder Buttons zum Zoomen, Ziehen zum Verschieben · Punktgröße = Klickvolumen
              · Standorte auf Stadt-Ebene (≈ 11 km) · Länderfärbung nach Klickzahl
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live-Feed · Letzte Klicks</CardTitle>
          </CardHeader>
          <CardContent>
            <LiveFeed clicks={recentClicks} />
          </CardContent>
        </Card>
      </div>

      {/* Besucher-Details */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Geräte</CardTitle>
          </CardHeader>
          <CardContent>
            <GeoBarList
              items={profile.devices.map((d) => ({
                label: d.label,
                clicks: d.clicks,
                hint: share(d.clicks),
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Browser</CardTitle>
          </CardHeader>
          <CardContent>
            <GeoBarList
              items={profile.browsers.map((d) => ({
                label: d.label,
                clicks: d.clicks,
                hint: share(d.clicks),
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Betriebssysteme</CardTitle>
          </CardHeader>
          <CardContent>
            <GeoBarList
              items={profile.operatingSystems.map((d) => ({
                label: d.label,
                clicks: d.clicks,
                hint: share(d.clicks),
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Aktivität + Top-Links */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aktivität nach Uhrzeit</CardTitle>
          </CardHeader>
          <CardContent>
            <BucketBarChart data={hourlyData} title="Klicks nach Tagesstunde (Europe/Berlin)" />
            <p className="mt-1 text-[11px] text-zinc-400">
              Klicks je Tagesstunde (Europe/Berlin) im gewählten Zeitraum
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Kurzlinks</CardTitle>
          </CardHeader>
          <CardContent>
            <GeoBarList
              items={topLinks.map((link) => ({
                label: link.linkName,
                sublabel: `/${link.code}`,
                clicks: link.clicks,
                hint: `· ${formatNumber(link.uniques)} Besucher`,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Kanäle, Länder, Städte, Referrer */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Kanäle</CardTitle>
          </CardHeader>
          <CardContent>
            <GeoBarList
              items={attribution.channels.map((c) => ({
                label: CHANNEL_LABELS[c.channel],
                clicks: c.clicks,
                color: CHANNEL_COLORS[c.channel],
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Länder</CardTitle>
          </CardHeader>
          <CardContent>
            <GeoBarList items={topCountries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Städte</CardTitle>
          </CardHeader>
          <CardContent>
            <GeoBarList items={topCities} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Referrer</CardTitle>
          </CardHeader>
          <CardContent>
            <GeoBarList
              items={attribution.referrers.map((r) => ({ label: r.host, clicks: r.clicks }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
