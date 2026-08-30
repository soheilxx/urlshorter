"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/utils";

/**
 * Interaktive Weltkarte (reines SVG, helles Design passend zum Dashboard).
 * Die Geometrie kommt fertig projiziert vom Server (lib/world-map.ts).
 *
 * Interaktion:
 * - Mausrad / Trackpad: hineinzoomen (zentriert auf den Cursor)
 * - Ziehen: Karte verschieben (auch Touch)
 * - Buttons: Zoom +/− und Zurücksetzen
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

interface ViewState {
  s: number;
  x: number;
  y: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 12;

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
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [view, setView] = useState<ViewState>({ s: 1, x: 0, y: 0 });
  const dragRef = useRef<{ clientX: number; clientY: number; moved: boolean } | null>(null);
  /** Aktive Pointer für Pinch-to-Zoom (Touch). */
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<number | null>(null);

  const clampView = useCallback(
    (next: ViewState): ViewState => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.s));
      // Inhalt muss den Ausschnitt immer abdecken (kein Weißraum am Rand)
      const x = Math.min(0, Math.max(width - width * s, next.x));
      const y = Math.min(0, Math.max(height - height * s, next.y));
      return { s, x, y };
    },
    [width, height],
  );

  /** Client-Koordinaten → SVG-Einheiten (unabhängig von der Darstellungsgröße). */
  const toSvgUnits = useCallback(
    (clientX: number, clientY: number): { ux: number; uy: number } | null => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return null;
      return {
        ux: ((clientX - rect.left) / rect.width) * width,
        uy: ((clientY - rect.top) / rect.height) * height,
      };
    },
    [width, height],
  );

  const zoomAt = useCallback(
    (ux: number, uy: number, factor: number) => {
      setView((prev) => {
        const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.s * factor));
        if (s === prev.s) return prev;
        // Punkt unter dem Cursor bleibt beim Zoomen fixiert
        const worldX = (ux - prev.x) / prev.s;
        const worldY = (uy - prev.y) / prev.s;
        return clampView({ s, x: ux - worldX * s, y: uy - worldY * s });
      });
    },
    [clampView],
  );

  // Mausrad-Zoom: nativer non-passive Listener (preventDefault gegen Seitenscroll)
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = toSvgUnits(event.clientX, event.clientY);
      if (!point) return;
      zoomAt(point.ux, point.uy, Math.exp(-event.deltaY * 0.0018));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [toSvgUnits, zoomAt]);

  const zoomCenter = (factor: number) => zoomAt(width / 2, height / 2, factor);
  const resetView = () => setView({ s: 1, x: 0, y: 0 });

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      dragRef.current = null;
      return;
    }
    dragRef.current = { clientX: event.clientX, clientY: event.clientY, moved: false };
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    // Pinch-to-Zoom mit zwei Fingern
    if (pointersRef.current.size === 2 && pinchRef.current !== null) {
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const factor = distance / pinchRef.current;
      pinchRef.current = distance;
      const mid = toSvgUnits((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      if (mid) zoomAt(mid.ux, mid.uy, factor);
      setTooltip(null);
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const dx = ((event.clientX - drag.clientX) / rect.width) * width;
    const dy = ((event.clientY - drag.clientY) / rect.height) * height;
    if (Math.abs(event.clientX - drag.clientX) + Math.abs(event.clientY - drag.clientY) > 2) {
      drag.moved = true;
      setTooltip(null);
    }
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    setView((prev) => clampView({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };

  const endDrag = (event?: React.PointerEvent<SVGSVGElement>) => {
    if (event) pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    dragRef.current = null;
  };

  const showTooltip = useCallback((event: React.MouseEvent, title: string, value: string) => {
    if (dragRef.current?.moved) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      title,
      value,
    });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const s = view.s;

  return (
    <div ref={containerRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Weltkarte der Besucherstandorte"
        className="block h-auto w-full cursor-grab overflow-hidden rounded-lg active:cursor-grabbing"
        // Keine Scroll-Falle: bei Zoomstufe 1 scrollt die Seite normal weiter
        // (pan-y); erst hineingezoomt übernimmt die Karte die Gesten komplett.
        style={{
          touchAction: view.s > 1 ? "none" : "pan-y",
          backgroundColor: "var(--map-sea)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => {
          endDrag(e);
          hideTooltip();
        }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${s})`}>
          {/* Länderflächen (Choropleth) */}
          <g>
            {countries.map((country) => (
              <path
                key={country.iso2 ?? country.name}
                d={country.d}
                // style statt Attribut: löst var(--map-ramp-N) im Dark Mode auf
                style={{ fill: country.fill, stroke: "var(--map-sea)" }}
                strokeWidth={0.6}
                vectorEffect="non-scaling-stroke"
                className="transition-[filter] duration-150 hover:brightness-95"
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

          {/* Standort-Marker mit Puls-Animation (Größe bleibt beim Zoomen konstant) */}
          <g>
            {markers.map((marker, index) => (
              <g key={`${marker.label}-${index}`}>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={(marker.r * 2.4) / s}
                  style={{ fill: "var(--map-marker)" }}
                  opacity={0.12}
                />
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={(marker.r * 2.1) / s}
                  fill="none"
                  strokeWidth={1 / s}
                  className="geo-pulse"
                  style={{
                    stroke: "var(--map-marker-ring)",
                    animationDelay: `${(index % 10) * 0.28}s`,
                  }}
                />
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={marker.r / s}
                  style={{ fill: "var(--map-marker)", stroke: "var(--map-marker-stroke)" }}
                  strokeWidth={1.2 / s}
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
        </g>
      </svg>

      {/* Zoom-Steuerung */}
      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => zoomCenter(1.6)}
          aria-label="Hineinzoomen"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-surface/95 text-zinc-700 shadow-sm transition hover:bg-zinc-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => zoomCenter(1 / 1.6)}
          aria-label="Herauszoomen"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-surface/95 text-zinc-700 shadow-sm transition hover:bg-zinc-50"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Ansicht zurücksetzen"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-surface/95 text-zinc-700 shadow-sm transition hover:bg-zinc-50"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 max-w-56 -translate-x-1/2 rounded-lg border border-zinc-200 bg-surface px-3 py-2 shadow-lg"
          style={{ left: tooltip.x, top: Math.max(0, tooltip.y - 58) }}
        >
          <p className="truncate text-xs font-medium text-zinc-900">{tooltip.title}</p>
          <p className="text-xs text-zinc-500 tabular-nums">{tooltip.value}</p>
        </div>
      ) : null}
    </div>
  );
}
