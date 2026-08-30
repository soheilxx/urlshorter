"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Filterbereich: auf Desktop immer sichtbar, auf Mobil hinter einem
 * „Filter“-Button einklappbar (Badge zeigt die Anzahl aktiver Filter).
 * Kein doppeltes Rendern – E2E-Selektoren (Desktop) bleiben eindeutig.
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
        className="flex h-11 w-full items-center justify-between rounded-xl border border-zinc-200 bg-surface px-3.5 text-sm font-medium text-zinc-700 md:hidden"
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
      <div className={cn("mt-3 md:mt-0", open ? "block" : "hidden", "md:block")}>{children}</div>
    </div>
  );
}
