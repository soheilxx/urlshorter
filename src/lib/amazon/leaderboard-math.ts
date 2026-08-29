import { median } from "@/lib/amazon/rank-math";

/**
 * Top-25-Bewegungslogik (rein, unit-getestet).
 *
 * leaderboardMovement = previousPosition - currentPosition
 *   > 0 = Aufstieg, < 0 = Abstieg
 *   vorher nicht vorhanden = Neueinsteiger
 *   aktuell nicht vorhanden = Aussteiger
 *
 * Die Reihenfolge der Einträge stammt ausschließlich aus dem Provider-Snapshot
 * und wird hier NIE verändert.
 */

export interface LeaderboardEntryInput {
  position: number;
  bestsellerRank: number;
  asin: string;
  title?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  price?: number | null;
  preorder?: boolean | null;
  imageUrl?: string | null;
}

export type EntryChange =
  | { kind: "new" }
  | { kind: "reentry" }
  | { kind: "up"; movement: number }
  | { kind: "down"; movement: number }
  | { kind: "same" };

export interface DiffedEntry extends LeaderboardEntryInput {
  change: EntryChange;
  previousPosition: number | null;
}

export interface LeaderboardDiff {
  entries: DiffedEntry[];
  newEntries: string[];
  reEntries: string[];
  exits: string[];
  biggestClimber: { asin: string; movement: number } | null;
  biggestFaller: { asin: string; movement: number } | null;
  /** Anteil ausgetauschter Plätze gegenüber dem Vorgänger-Snapshot (0–1). */
  turnover: number | null;
}

/**
 * Vergleicht den aktuellen Snapshot mit dem vorherigen.
 * `historicalAsins`: ASINs, die in älteren Snapshots (vor dem vorherigen)
 * enthalten waren – unterscheidet Neueinsteiger von Wiedereinsteigern.
 */
export function diffLeaderboard(
  current: LeaderboardEntryInput[],
  previous: LeaderboardEntryInput[] | null,
  historicalAsins: ReadonlySet<string> = new Set(),
): LeaderboardDiff {
  const prevByAsin = new Map<string, number>();
  for (const e of previous ?? []) prevByAsin.set(e.asin, e.position);

  const entries: DiffedEntry[] = current.map((entry) => {
    const prevPos = prevByAsin.get(entry.asin);
    if (prevPos === undefined) {
      const change: EntryChange =
        previous !== null && historicalAsins.has(entry.asin) ? { kind: "reentry" } : { kind: "new" };
      return { ...entry, change, previousPosition: null };
    }
    const movement = prevPos - entry.position;
    const change: EntryChange =
      movement > 0
        ? { kind: "up", movement }
        : movement < 0
          ? { kind: "down", movement }
          : { kind: "same" };
    return { ...entry, change, previousPosition: prevPos };
  });

  const currentAsins = new Set(current.map((e) => e.asin));
  const exits = (previous ?? []).filter((e) => !currentAsins.has(e.asin)).map((e) => e.asin);
  const newEntries = entries.filter((e) => e.change.kind === "new").map((e) => e.asin);
  const reEntries = entries.filter((e) => e.change.kind === "reentry").map((e) => e.asin);

  let biggestClimber: { asin: string; movement: number } | null = null;
  let biggestFaller: { asin: string; movement: number } | null = null;
  for (const e of entries) {
    if (e.change.kind === "up") {
      if (biggestClimber === null || e.change.movement > biggestClimber.movement) {
        biggestClimber = { asin: e.asin, movement: e.change.movement };
      }
    } else if (e.change.kind === "down") {
      if (biggestFaller === null || e.change.movement < biggestFaller.movement) {
        biggestFaller = { asin: e.asin, movement: e.change.movement };
      }
    }
  }

  const turnover =
    previous === null || previous.length === 0
      ? null
      : (newEntries.length + reEntries.length) / previous.length;

  return { entries, newEntries, reEntries, exits, biggestClimber, biggestFaller, turnover };
}

export interface LeaderboardAggregates {
  averageRating: number | null;
  medianReviewCount: number | null;
  averagePrice: number | null;
  medianPrice: number | null;
  priceRange: { min: number; max: number } | null;
  preorderShare: number | null;
  missingCovers: number;
  completeness: number;
}

/** Aggregierte Kennzahlen einer Top-25-Liste. */
export function leaderboardAggregates(
  entries: LeaderboardEntryInput[],
  requestedLimit = 25,
): LeaderboardAggregates {
  const ratings = entries.map((e) => e.rating).filter((v): v is number => typeof v === "number");
  const reviews = entries
    .map((e) => e.reviewCount)
    .filter((v): v is number => typeof v === "number");
  const prices = entries.map((e) => e.price).filter((v): v is number => typeof v === "number");
  const preorderKnown = entries.filter((e) => typeof e.preorder === "boolean");

  return {
    averageRating:
      ratings.length > 0 ? ratings.reduce((s, v) => s + v, 0) / ratings.length : null,
    medianReviewCount: median(reviews),
    averagePrice: prices.length > 0 ? prices.reduce((s, v) => s + v, 0) / prices.length : null,
    medianPrice: median(prices),
    priceRange:
      prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    preorderShare:
      preorderKnown.length > 0
        ? preorderKnown.filter((e) => e.preorder === true).length / preorderKnown.length
        : null,
    missingCovers: entries.filter((e) => !e.imageUrl).length,
    completeness: requestedLimit > 0 ? entries.length / requestedLimit : 0,
  };
}

/**
 * Entfernt doppelte ASINs OHNE die Reihenfolge zu verändern und begrenzt auf
 * `limit` eindeutige Einträge. Fehlende Plätze werden nicht erfunden.
 */
export function dedupeEntries<T extends { asin: string }>(entries: T[], limit = 25): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const entry of entries) {
    if (seen.has(entry.asin)) continue;
    seen.add(entry.asin);
    result.push(entry);
    if (result.length >= limit) break;
  }
  return result;
}
