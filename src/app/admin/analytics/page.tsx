import type { Metadata } from "next";
import Link from "next/link";
import { GeoMap, type MapCountry, type MapMarker } from "@/components/admin/geo-map";
import { DarkBarList, DarkStatCard, LiveFeed } from "@/components/admin/geo-panels";
import { requireSession } from "@/lib/auth";
import { CHANNEL_COLORS, CHANNEL_LABELS } from "@/lib/channels";
import {
  getAttributionBreakdown,
  getClicksByCountry,
  getGeoMarkers,
  getGeoOverview,
  getRecentClicks,
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

/** Sequentielle Blau-Rampe (dunkel → hell) für die Choroplethen-Füllung. */
const CHOROPLETH_RAMP = [
  "#104281",
  "#184f95",
  "#1c5cab",
  "#256abf",
  "#2a78d6",
  "#3987e5",
  "#5598e7",
  "#6da7ec",
  "#86b6ef",
];
const LAND_WITHOUT_DATA = "#262625";

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

  const [overview, byCountry, geoMarkers, attribution, recentClicks] = await Promise.all([
    getGeoOverview(scope),
    getClicksByCountry(scope),
    getGeoMarkers(scope),
    getAttributionBreakdown(scope),
    getRecentClicks(12),
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
      fill = CHOROPLETH_RAMP[Math.min(CHOROPLETH_RAMP.length - 1, Math.floor(t * CHOROPLETH_RAMP.length))] as string;
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
  }));
  const topCities = geoMarkers
    .filter((m) => m.label && m.iso2 !== m.label)
    .slice(0, 8)
    .map((m) => ({
      label: m.label,
      sublabel: m.iso2 ? countryNameDe(m.iso2) : null,
      clicks: m.clicks,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-zinc-500">
            Besucherstandorte und Kanäle · {range.label} · Ohne Bots · Zeitzone Europe/Berlin
          </p>
        </div>
      </div>

      {/* Dunkles Geo-Panel („Command Center“) */}
      <div className="rounded-2xl bg-[#0d0d0d] p-4 ring-1 ring-white/10 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold tracking-wide text-white">Geo-Tracking</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium tracking-wider text-[#c3c2b7] uppercase">
              <span
                className="size-2 animate-pulse rounded-full bg-[#0ca30c]"
                aria-hidden="true"
              />
              Live
            </span>
          </div>
          <div className="flex rounded-lg bg-white/5 p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <Link
                key={opt.key}
                href={buildHref(opt.key)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  range.key === opt.key
                    ? "bg-[#2a78d6] text-white"
                    : "text-[#c3c2b7] hover:bg-white/10 hover:text-white",
                )}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DarkStatCard label="Klicks" value={formatNumber(overview.clicks)} hint={range.label} />
          <DarkStatCard
            label="Unique Visitors"
            value={formatNumber(overview.uniqueVisitors)}
            hint="anonymisiert"
          />
          <DarkStatCard label="Länder" value={formatNumber(overview.countries)} />
          <DarkStatCard label="Städte" value={formatNumber(overview.cities)} />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-xl bg-[#1a1a19] p-4 ring-1 ring-white/10 xl:col-span-2">
            <GeoMap
              width={WORLD_MAP_WIDTH}
              height={WORLD_MAP_HEIGHT}
              countries={countries}
              markers={markers}
            />
            <p className="mt-2 text-[11px] text-[#898781]">
              Punktgröße = Klickvolumen · Standorte auf Stadt-Ebene (≈ 11 km) · Länderfärbung nach
              Klickzahl
            </p>
          </div>

          <div className="rounded-xl bg-[#1a1a19] p-4 ring-1 ring-white/10">
            <h2 className="mb-2 text-[11px] font-medium tracking-wider text-[#898781] uppercase">
              Live-Feed · Letzte Klicks
            </h2>
            <LiveFeed clicks={recentClicks} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-[#1a1a19] p-4 ring-1 ring-white/10">
            <h2 className="mb-3 text-[11px] font-medium tracking-wider text-[#898781] uppercase">
              Kanäle
            </h2>
            <DarkBarList
              items={attribution.channels.map((c) => ({
                label: CHANNEL_LABELS[c.channel],
                clicks: c.clicks,
                color: CHANNEL_COLORS[c.channel],
              }))}
            />
          </div>
          <div className="rounded-xl bg-[#1a1a19] p-4 ring-1 ring-white/10">
            <h2 className="mb-3 text-[11px] font-medium tracking-wider text-[#898781] uppercase">
              Top Länder
            </h2>
            <DarkBarList items={topCountries} />
          </div>
          <div className="rounded-xl bg-[#1a1a19] p-4 ring-1 ring-white/10">
            <h2 className="mb-3 text-[11px] font-medium tracking-wider text-[#898781] uppercase">
              Top Städte
            </h2>
            <DarkBarList items={topCities} />
          </div>
          <div className="rounded-xl bg-[#1a1a19] p-4 ring-1 ring-white/10">
            <h2 className="mb-3 text-[11px] font-medium tracking-wider text-[#898781] uppercase">
              Top Referrer
            </h2>
            <DarkBarList
              items={attribution.referrers.map((r) => ({ label: r.host, clicks: r.clicks }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
