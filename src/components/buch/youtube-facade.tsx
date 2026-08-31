"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Click-to-Load-Facade für ein YouTube-Video: Vor dem Klick wird nur ein
 * LOKALES Posterbild gerendert (kein Drittanbieter-Request, schnelle Seite,
 * kein Autoplay-Sound – wichtig für Ads-Landingpages). Erst der Klick lädt
 * das privacy-freundliche youtube-nocookie-Embed mit Autoplay.
 * Beide Zustände sind aspect-video → kein Layout-Shift beim Umschalten.
 */
export function YoutubeFacade({
  videoId,
  title,
  posterSrc,
  posterWidth,
  posterHeight,
  eventName,
}: {
  videoId: string;
  title: string;
  posterSrc: string;
  posterWidth: number;
  posterHeight: number;
  /** data-gw-event für das delegierte Klick-Tracking (GewinnTracking). */
  eventName?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Tastatur-Nutzer landen nach dem Start direkt im Player
  useEffect(() => {
    if (playing) iframeRef.current?.focus();
  }, [playing]);

  if (playing) {
    return (
      <iframe
        ref={iframeRef}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="aspect-video w-full rounded-2xl border gw-hairline bg-black"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      data-gw-event={eventName}
      aria-label={`Video abspielen: ${title}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-2xl border gw-hairline outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gw-bg)]"
    >
      <Image
        src={posterSrc}
        alt={`Vorschaubild: ${title}`}
        width={posterWidth}
        height={posterHeight}
        sizes="(min-width: 1024px) 896px, 100vw"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />
      {/* Abdunklung + goldener Play-Button */}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10 transition-colors group-hover:from-black/50"
      />
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-b from-[var(--gw-gold-strong)] to-[var(--gw-gold-deep)] shadow-lg shadow-black/50 transition-transform group-hover:scale-110 sm:h-20 sm:w-20"
      >
        <svg
          viewBox="0 0 24 24"
          className="ml-1 h-7 w-7 fill-[#181207] sm:h-8 sm:w-8"
          aria-hidden="true"
        >
          <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.03 1.03 0 0 0 0-1.76L9.56 4.26A1.03 1.03 0 0 0 8 5.14z" />
        </svg>
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 p-4 text-left text-sm font-medium text-white/90 sm:p-5"
      >
        ▶ Musikvideo abspielen
      </span>
    </button>
  );
}
