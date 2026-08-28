"use client";

import { useEffect } from "react";

/**
 * Clientseitige Weiterleitung nach kurzer Verzögerung – gibt den zuvor
 * geladenen Tracking-Pixeln Zeit zum Feuern (GA4 nutzt sendBeacon und
 * überlebt die Navigation). Muster analog zur Kurzlink-Bridge.
 */
export function DelayedRedirect({ url, delayMs }: { url: string; delayMs: number }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.replace(url);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [url, delayMs]);
  return null;
}
