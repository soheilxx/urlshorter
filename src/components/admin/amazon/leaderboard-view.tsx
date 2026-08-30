"use client";

import { LayoutGrid, Table as TableIcon } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Top-25-Ansicht: Cover-Grid (5/3/2 Spalten) ↔ kompakte Tabelle, Suche,
 * Filter (Neueinsteiger/Aufsteiger/eigene Titel). Die Reihenfolge stammt
 * ausschließlich aus dem gespeicherten Snapshot und wird nie umsortiert.
 */

export interface LeaderboardViewEntry {
  position: number;
  bestsellerRank: number;
  asin: string;
  title: string;
  author: string | null;
  format: string | null;
  imageUrl: string | null;
  amazonUrl: string | null;
  price: string | null;
  rating: number | null;
  reviewCount: number | null;
  preorder: boolean | null;
  isOwn: boolean;
  change:
    | { kind: "new" }
    | { kind: "reentry" }
    | { kind: "up"; movement: number }
    | { kind: "down"; movement: number }
    | { kind: "same" }
    | { kind: "unknown" };
  /** Beste beobachtete Platzierung + Anzahl Snapshots in Top 25 (falls bekannt). */
  bestPosition: number | null;
  appearances: number | null;
}

type FilterKey = "all" | "new" | "up" | "down" | "own";

function ChangeBadge({ change }: { change: LeaderboardViewEntry["change"] }) {
  switch (change.kind) {
    case "new":
      return (
        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
          NEU
        </span>
      );
    case "reentry":
      return (
        <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-600/20">
          WIEDER
        </span>
      );
    case "up":
      return (
        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          ▲ +{change.movement}
          <span className="sr-only"> Plätze aufgestiegen</span>
        </span>
      );
    case "down":
      return (
        <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
          ▼ {change.movement}
          <span className="sr-only"> Plätze abgestiegen</span>
        </span>
      );
    case "same":
      return (
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
          =
          <span className="sr-only">unverändert</span>
        </span>
      );
    default:
      return null;
  }
}

function Cover({ entry }: { entry: LeaderboardViewEntry }) {
  if (!entry.imageUrl) {
    return (
      <div
        className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-zinc-100 p-2 text-center text-[10px] text-zinc-400"
        role="img"
        aria-label={`Kein Cover verfügbar: ${entry.title}`}
      >
        Kein Cover
      </div>
    );
  }
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-zinc-50">
      <Image
        src={entry.imageUrl}
        alt={`Buchcover: ${entry.title}${entry.author ? ` von ${entry.author}` : ""}`}
        fill
        loading="lazy"
        unoptimized
        className="object-contain"
        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
      />
    </div>
  );
}

export function LeaderboardView({
  entries,
  exportBase,
}: {
  entries: LeaderboardViewEntry[];
  /** Basis-URL für Exporte, z. B. /api/export/amazon?type=leaderboard&snapshotId=… */
  exportBase: string | null;
}) {
  const [mode, setMode] = useState<"grid" | "table">("grid");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter === "new" && entry.change.kind !== "new" && entry.change.kind !== "reentry")
        return false;
      if (filter === "up" && entry.change.kind !== "up") return false;
      if (filter === "down" && entry.change.kind !== "down") return false;
      if (filter === "own" && !entry.isOwn) return false;
      if (
        term &&
        !entry.title.toLowerCase().includes(term) &&
        !(entry.author ?? "").toLowerCase().includes(term) &&
        !entry.asin.toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [entries, filter, search]);

  const filterButtons: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "Alle" },
    { key: "new", label: "Neu/Wieder" },
    { key: "up", label: "Aufsteiger" },
    { key: "down", label: "Absteiger" },
    { key: "own", label: "Eigene Titel" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-zinc-200 p-0.5" role="group" aria-label="Ansicht">
          <button
            type="button"
            onClick={() => setMode("grid")}
            aria-pressed={mode === "grid"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium sm:py-1",
              mode === "grid" ? "bg-primary text-white" : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /> Grid
          </button>
          <button
            type="button"
            onClick={() => setMode("table")}
            aria-pressed={mode === "table"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium sm:py-1",
              mode === "table" ? "bg-primary text-white" : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            <TableIcon className="h-3.5 w-3.5" aria-hidden="true" /> Tabelle
          </button>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter">
          {filterButtons.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "rounded-lg px-2.5 py-2 text-xs font-medium sm:py-1",
                filter === f.key ? "bg-zinc-200 text-zinc-900" : "text-zinc-500 hover:bg-zinc-100",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Titel, Autor, ASIN …"
          aria-label="In der Liste suchen"
          className="w-full rounded-xl border border-zinc-200 bg-surface px-3 py-2 text-base focus:border-zinc-400 focus:outline-none sm:ml-auto sm:w-44 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-xs"
        />
        {exportBase ? (
          <div className="flex gap-1">
            <a
              href={`${exportBase}&format=csv`}
              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              CSV
            </a>
            <a
              href={`${exportBase}&format=json`}
              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              JSON
            </a>
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-400">Keine Einträge für diesen Filter.</p>
      ) : mode === "grid" ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" role="list">
          {filtered.map((entry) => (
            <li
              key={entry.asin}
              className={cn(
                "relative rounded-xl border bg-surface p-3 transition-shadow hover:shadow-md",
                entry.isOwn
                  ? "border-zinc-900 ring-2 ring-zinc-900/10"
                  : "border-zinc-200",
              )}
            >
              <div className="absolute -left-1.5 -top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow">
                {entry.bestsellerRank}
              </div>
              {entry.isOwn ? (
                <div className="absolute -right-1.5 -top-1.5 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                  Dein Buch
                </div>
              ) : null}
              <Cover entry={entry} />
              <div className="mt-2 space-y-1">
                <p className="line-clamp-2 text-xs font-semibold text-zinc-900">{entry.title}</p>
                {entry.author ? (
                  <p className="line-clamp-1 text-[11px] text-zinc-500">{entry.author}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-1">
                  <ChangeBadge change={entry.change} />
                  {entry.preorder === true ? (
                    <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                      Vorbestellung
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{entry.price ?? "–"}</span>
                  {entry.rating !== null ? (
                    <span aria-label={`Bewertung ${entry.rating} von 5`}>
                      ★ {entry.rating.toLocaleString("de-DE")}
                      {entry.reviewCount !== null
                        ? ` (${entry.reviewCount.toLocaleString("de-DE")})`
                        : ""}
                    </span>
                  ) : null}
                </div>
                {entry.amazonUrl ? (
                  <a
                    href={entry.amazonUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="block text-[11px] font-medium text-zinc-600 underline-offset-2 hover:underline"
                  >
                    Bei Amazon ansehen ↗
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="scroll-x-fade overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="py-2 pr-3">Rang</th>
                <th className="py-2 pr-3">Titel</th>
                <th className="py-2 pr-3">Autor</th>
                <th className="py-2 pr-3">ASIN</th>
                <th className="py-2 pr-3">Preis</th>
                <th className="py-2 pr-3">Bewertung</th>
                <th className="py-2 pr-3">Bewegung</th>
                <th className="py-2 pr-3">Beste Pos.</th>
                <th className="py-2 pr-3">Snapshots</th>
                <th className="py-2">Link</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr
                  key={entry.asin}
                  className={cn(
                    "border-b border-zinc-100",
                    entry.isOwn ? "bg-zinc-50 font-medium" : "hover:bg-zinc-50/60",
                  )}
                >
                  <td className="py-2 pr-3 tabular-nums">{entry.bestsellerRank}</td>
                  <td className="max-w-[280px] truncate py-2 pr-3">
                    {entry.title}
                    {entry.isOwn ? (
                      <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Dein Buch
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[160px] truncate py-2 pr-3 text-zinc-500">
                    {entry.author ?? "–"}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{entry.asin}</td>
                  <td className="py-2 pr-3">{entry.price ?? "–"}</td>
                  <td className="py-2 pr-3">
                    {entry.rating !== null
                      ? `★ ${entry.rating.toLocaleString("de-DE")}${entry.reviewCount !== null ? ` (${entry.reviewCount.toLocaleString("de-DE")})` : ""}`
                      : "–"}
                  </td>
                  <td className="py-2 pr-3">
                    <ChangeBadge change={entry.change} />
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{entry.bestPosition ?? "–"}</td>
                  <td className="py-2 pr-3 tabular-nums">{entry.appearances ?? "–"}</td>
                  <td className="py-2">
                    {entry.amazonUrl ? (
                      <a
                        href={entry.amazonUrl}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="text-xs text-zinc-500 underline-offset-2 hover:underline"
                      >
                        Amazon ↗
                      </a>
                    ) : (
                      "–"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
