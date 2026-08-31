"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Filterbereich: auf Desktop immer sichtbar, auf Mobil hinter einer flachen
 * Kopfzeile einklappbar (Badge zeigt die Anzahl aktiver Filter). Bringt sein
 * Innen-Padding selbst mit und wird DIREKT in eine <Card> gesetzt – keine
 * Kasten-im-Kasten-Optik. Kein doppeltes Rendern, E2E-Selektoren bleiben
 * eindeutig.
 */
export function FilterPanel({
  activeCount = 0,
  defaultOpen = false,
  children,
}: {
  activeCount?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 md:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          Filter
          {activeCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
              {activeCount}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-zinc-400 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <div
        className={cn(
          "border-t border-zinc-100 px-4 pt-3 pb-4 md:border-t-0 md:px-5 md:py-4",
          open ? "block" : "hidden",
          "md:block",
        )}
      >
        {children}
      </div>
    </div>
  );
}
