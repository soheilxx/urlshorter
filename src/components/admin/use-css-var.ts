"use client";

import { useEffect, useState } from "react";

/**
 * Liest eine CSS-Variable vom :root und aktualisiert sie beim Theme-Wechsel
 * (Beobachtung der class-Änderung an <html>). Nötig für Recharts, das Farben
 * als SVG-Attribute setzt – dort werden var()-Ausdrücke nicht aufgelöst.
 */
export function useCssVar(name: string, fallback: string): string {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    const read = () => {
      const resolved = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
      setValue(resolved || fallback);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [name, fallback]);

  return value;
}
