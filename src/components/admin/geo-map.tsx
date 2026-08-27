"use client";

import { useCallback, useRef, useState } from "react";
import { formatNumber } from "@/lib/utils";

/**
 * Interaktive Weltkarte (reines SVG). Die Geometrie kommt fertig projiziert
 * vom Server (lib/world-map.ts) – hier gibt es nur Hover-Interaktion und die
 * Puls-Animation der Standort-Marker (CSS in globals.css: .geo-pulse).
 */

export interface MapCountry {
  iso2: string | null;
  name: string;
  d: string;
  clicks: number;
  fill: string;
}

export interface MapMarker {
  label: string;
  sublabel: string | null;
  x: number;
  y: number;
  r: number;
  clicks: number;
}

interface TooltipState {
  x: number;
  y: number;
  title: string;
  value: string;
}

export function GeoMap({
  width,
  height,
  countries,
  markers,
}: {
  width: number;
  height: number;
  countries: MapCountry[];
  markers: MapMarker[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTooltip = useCallback(
    (event: React.MouseEvent, title: string, value: string) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        title,
        value,
      });
    },
    [],
  );

  const hideTooltip = useCallback(() => setTooltip(null), []);

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Weltkarte der Besucherstandorte"
        className="block h-auto w-full"
      >
        {/* Länderflächen (Choropleth) */}
        <g>
          {countries.map((country) => (
            <path
              key={country.iso2 ?? country.name}
              d={country.d}
              fill={country.fill}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={0.6}
              className="transition-[filter] duration-150 hover:brightness-150"
              onMouseMove={(e) =>
                showTooltip(
                  e,
                  country.name,
                  country.clicks > 0 ? `${formatNumber(country.clicks)} Klicks` : "Keine Klicks",
                )
              }
              onMouseLeave={hideTooltip}
            />
          ))}
        </g>

        {/* Standort-Marker mit Puls-Animation */}
        <g>
          {markers.map((marker, index) => (
            <g key={`${marker.label}-${index}`}>
              <circle
                cx={marker.x}
                cy={marker.y}
                r={marker.r * 2.4}
                fill="#3987e5"
                opacity={0.14}
              />
              <circle
                cx={marker.x}
                cy={marker.y}
                r={marker.r * 2.1}
                fill="none"
                stroke="#5598e7"
                strokeWidth={1}
                className="geo-pulse"
                style={{ animationDelay: `${(index % 10) * 0.28}s` }}
              />
              <circle
                cx={marker.x}
                cy={marker.y}
                r={marker.r}
                fill="#3987e5"
                stroke="#b7d3f6"
                strokeWidth={1.2}
                className="cursor-pointer"
                onMouseMove={(e) =>
                  showTooltip(
                    e,
                    marker.sublabel ? `${marker.label} · ${marker.sublabel}` : marker.label,
                    `${formatNumber(marker.clicks)} Klicks`,
                  )
                }
                onMouseLeave={hideTooltip}
              />
            </g>
          ))}
        </g>
      </svg>

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 max-w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-[#0d0d0d]/95 px-3 py-2 shadow-xl"
          style={{ left: tooltip.x, top: Math.max(0, tooltip.y - 58) }}
        >
          <p className="truncate text-xs font-medium text-white">{tooltip.title}</p>
          <p className="text-xs text-[#c3c2b7] tabular-nums">{tooltip.value}</p>
        </div>
      ) : null}
    </div>
  );
}
