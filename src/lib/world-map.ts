import "server-only";
import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import countriesMeta from "world-countries";
import worldTopology from "world-atlas/countries-110m.json";

/**
 * Serverseitige Weltkarten-Geometrie (TopoJSON aus dem npm-Paket world-atlas,
 * kein externer Fetch). Die Client-Komponente erhält ausschließlich fertige
 * SVG-Pfade und projizierte Punkte – d3/topojson landen nicht im Browser-Bundle.
 */

export const WORLD_MAP_WIDTH = 980;
export const WORLD_MAP_HEIGHT = 470;

export interface CountryShape {
  /** ISO-3166-1 alpha-2 (z. B. "DE"), null wenn nicht zuordenbar */
  iso2: string | null;
  /** Deutscher Anzeigename */
  name: string;
  /** SVG-Pfad */
  d: string;
}

interface WorldMap {
  countries: CountryShape[];
  projection: GeoProjection;
}

const numericToAlpha2 = new Map<string, string>(countriesMeta.map((c) => [c.ccn3, c.cca2]));
const metaByAlpha2 = new Map(countriesMeta.map((c) => [c.cca2, c]));

/** Deutscher Ländername zu einem ISO-2-Code (Fallback: Code selbst). */
export function countryNameDe(iso2: string | null): string {
  if (!iso2) return "Unbekannt";
  const meta = metaByAlpha2.get(iso2.toUpperCase());
  return meta?.translations.deu?.common ?? meta?.name.common ?? iso2.toUpperCase();
}

/** Länder-Zentroid (für Klicks ohne gespeicherte Koordinaten). */
export function countryCentroid(iso2: string | null): { latitude: number; longitude: number } | null {
  if (!iso2) return null;
  const meta = metaByAlpha2.get(iso2.toUpperCase());
  if (!meta || meta.latlng.length < 2) return null;
  return { latitude: meta.latlng[0] as number, longitude: meta.latlng[1] as number };
}

interface TopoGeometry {
  type: string;
  id?: string | number;
  properties?: { name?: string };
}

let cached: WorldMap | null = null;

function buildWorldMap(): WorldMap {
  if (cached) return cached;

  // Minimal typisiert – die TopoJSON-Struktur des Pakets ist stabil.
  const topology = worldTopology as unknown as Parameters<typeof feature>[0];
  const countriesObject = (topology.objects as Record<string, Parameters<typeof feature>[1]>)[
    "countries"
  ];
  if (!countriesObject) {
    throw new Error("world-atlas: Objekt 'countries' fehlt in countries-110m.json.");
  }
  const collection = feature(topology, countriesObject) as unknown as {
    features: Array<GeoPermissibleObjects & TopoGeometry>;
  };

  // Antarktis (010) ausblenden – gewinnt Platz und trägt nie Traffic.
  const features = collection.features.filter((f) => String(f.id) !== "010");

  const projection = geoNaturalEarth1();
  projection.fitSize([WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT], {
    type: "FeatureCollection",
    features,
  } as unknown as GeoPermissibleObjects);

  const path = geoPath(projection);
  const countries: CountryShape[] = features.map((f) => {
    const iso2 = numericToAlpha2.get(String(f.id).padStart(3, "0")) ?? null;
    return {
      iso2,
      name: iso2 ? countryNameDe(iso2) : (f.properties?.name ?? "Unbekannt"),
      d: path(f) ?? "",
    };
  });

  cached = { countries, projection };
  return cached;
}

export function getWorldCountryShapes(): CountryShape[] {
  return buildWorldMap().countries;
}

/** Projiziert Breiten-/Längengrad auf Karten-Koordinaten (oder null). */
export function projectCoordinate(
  latitude: number,
  longitude: number,
): { x: number; y: number } | null {
  const projected = buildWorldMap().projection([longitude, latitude]);
  if (!projected) return null;
  const [x, y] = projected;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}
