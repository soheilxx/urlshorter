"use client";

import { CornerDownLeft, Link2, Loader2, Search, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Befehls-Palette (Cmd/Ctrl-K): Seitennavigation, Schnellaktionen und
 * Live-Suche über Kurzlinks/Ziele (GET /api/search, session-geschützt).
 * Eine Instanz im Admin-Layout; Trigger-Buttons öffnen sie per Custom-Event.
 */

const OPEN_EVENT = "tracksite:open-palette";

export interface PaletteEntry {
  href: string;
  label: string;
  /** Gruppenüberschrift in der Liste (z. B. "Seiten", "Aktionen"). */
  group: string;
}

interface SearchResults {
  links: Array<{ id: string; code: string; name: string; active: boolean }>;
  destinations: Array<{ id: string; name: string; host: string }>;
}

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Sidebar-Trigger im Look eines Suchfelds (Desktop). */
export function CommandPaletteTrigger({ variant }: { variant: "field" | "icon" }) {
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label="Suchen (Strg+K)"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="mb-4 flex h-9 w-full items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-600"
    >
      <Search className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="flex-1 text-left">Suchen …</span>
      <kbd className="rounded border border-zinc-200 bg-surface px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
        Strg K
      </kbd>
    </button>
  );
}

export function CommandPalette({ entries }: { entries: PaletteEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Öffnen per Hotkey oder Trigger-Event
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
      if (event.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Beim Öffnen fokussieren und Zustand zurücksetzen
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    return undefined;
  }, [open]);

  // Live-Suche (debounced)
  useEffect(() => {
    if (!open) return undefined;
    const term = query.trim();
    if (term.length < 2) {
      setResults(null);
      setLoading(false);
      abortRef.current?.abort();
      return undefined;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (res.ok) setResults((await res.json()) as SearchResults);
      } catch {
        /* abgebrochen oder offline – Ergebnisliste bleibt leer */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  // Sichtbare Einträge: statische Seiten gefiltert + Suchtreffer
  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    const staticItems = entries
      .filter((e) => !term || e.label.toLowerCase().includes(term))
      .map((e) => ({ key: e.href + e.label, group: e.group, label: e.label, href: e.href, icon: "page" as const }));
    const linkItems = (results?.links ?? []).map((l) => ({
      key: `link-${l.id}`,
      group: "Kurzlinks",
      label: `/${l.code} – ${l.name}`,
      href: `/admin/links/${l.id}`,
      icon: "link" as const,
    }));
    const destItems = (results?.destinations ?? []).map((d) => ({
      key: `dest-${d.id}`,
      group: "Ziele",
      label: `${d.name} (${d.host})`,
      href: `/admin/destinations/${d.id}`,
      icon: "dest" as const,
    }));
    return [...staticItems, ...linkItems, ...destItems];
  }, [entries, query, results]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const onInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) go(item.href);
    }
  };

  if (!open) return null;

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Suche schließen"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Befehls-Palette"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Seite, Kurzlink oder Ziel suchen …"
            aria-label="Suchbegriff"
            className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400 md:text-sm"
          />
          <kbd className="hidden rounded border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 md:block">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-2" role="listbox" aria-label="Ergebnisse">
          {items.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-400">
              {query.trim().length >= 2 ? "Keine Treffer." : "Tippe, um zu suchen."}
            </li>
          ) : (
            items.map((item, index) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <li key={item.key} role="option" aria-selected={index === activeIndex}>
                  {showGroup ? (
                    <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      {item.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => go(item.href)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm",
                      index === activeIndex
                        ? "bg-primary-soft text-zinc-900"
                        : "text-zinc-700",
                    )}
                  >
                    {item.icon === "link" ? (
                      <Link2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                    ) : item.icon === "dest" ? (
                      <Target className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                    ) : (
                      <Search className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {index === activeIndex ? (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
