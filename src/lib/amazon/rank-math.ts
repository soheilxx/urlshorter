/**
 * Zentrale Rangmathematik (rein, unit-getestet).
 *
 * Grundregeln:
 * - Ein KLEINERER Rang ist BESSER.
 * - movement = previousRank - currentRank  (> 0 = Verbesserung)
 * - improvementPercent = ((previous - current) / previous) * 100
 * - Fehlende Werte (null) erzeugen NIE eine Berechnung (keine Division durch 0,
 *   kein Rang 0, keine stillschweigende Interpolation).
 */

export interface RankPoint {
  observedAt: Date;
  /** Positiver Rang oder null (Datenlücke / Provider ohne Rang). */
  rank: number | null;
}

/** previous - current; > 0 = Verbesserung. null, wenn ein Wert fehlt. */
export function movement(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null) return null;
  return previous - current;
}

/** current - previous (numerische Differenz; > 0 = Verschlechterung). */
export function numericDelta(current: number | null, previous: number | null): number | null {
  if (previous === null || current === null) return null;
  return current - previous;
}

/** Prozentuale Verbesserung; null bei fehlendem/0-Ausgangswert. */
export function improvementPercent(
  previous: number | null,
  current: number | null,
): number | null {
  if (previous === null || current === null || previous <= 0) return null;
  return ((previous - current) / previous) * 100;
}

/** Absolute Abweichung zweier Providerwerte. */
export function absoluteProviderDifference(
  a: number | null,
  b: number | null,
): number | null {
  if (a === null || b === null) return null;
  return Math.abs(a - b);
}

/** Relative Abweichung bezogen auf den kanonischen Rang (Prozent). */
export function relativeProviderDifference(
  absoluteDifference: number | null,
  canonicalRank: number | null,
): number | null {
  if (absoluteDifference === null || canonicalRank === null || canonicalRank <= 0) return null;
  return (absoluteDifference / canonicalRank) * 100;
}

/** Median einer nicht-leeren Zahlenliste. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? null);
}

/** Standardabweichung (Population). */
export function stddev(values: number[]): number | null {
  if (values.length === 0) return null;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Median Absolute Deviation. */
export function medianAbsoluteDeviation(values: number[]): number | null {
  const med = median(values);
  if (med === null) return null;
  return median(values.map((v) => Math.abs(v - med)));
}

export interface WindowChange {
  /** Ältester Rang innerhalb des Fensters (Referenzwert) */
  fromRank: number | null;
  fromAt: Date | null;
  /** Aktuellster Rang */
  toRank: number | null;
  toAt: Date | null;
  movement: number | null;
  improvementPercent: number | null;
}

/**
 * Veränderung über ein Zeitfenster: Vergleich des ältesten Messwerts im
 * Fenster mit dem aktuellsten Messwert. Punkte ohne Rang zählen nicht als
 * Referenz (eine fehlgeschlagene Messung ist keine unveränderte Messung).
 */
export function changeOverWindow(
  points: RankPoint[],
  now: Date,
  windowMs: number,
): WindowChange {
  const cutoff = now.getTime() - windowMs;
  const inWindow = points.filter(
    (p) => p.rank !== null && p.observedAt.getTime() >= cutoff && p.observedAt.getTime() <= now.getTime(),
  );
  if (inWindow.length === 0) {
    return {
      fromRank: null,
      fromAt: null,
      toRank: null,
      toAt: null,
      movement: null,
      improvementPercent: null,
    };
  }
  const sorted = [...inWindow].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return {
    fromRank: first.rank,
    fromAt: first.observedAt,
    toRank: last.rank,
    toAt: last.observedAt,
    movement: movement(first.rank, last.rank),
    improvementPercent: improvementPercent(first.rank, last.rank),
  };
}

export interface Extreme {
  rank: number;
  observedAt: Date;
}

/** Bester (kleinster) Rang inkl. Zeitpunkt des ERSTEN Erreichens. */
export function bestRank(points: RankPoint[]): Extreme | null {
  let best: Extreme | null = null;
  for (const p of points) {
    if (p.rank === null) continue;
    if (best === null || p.rank < best.rank) best = { rank: p.rank, observedAt: p.observedAt };
  }
  return best;
}

/** Schlechtester (größter) Rang inkl. Zeitpunkt des ersten Erreichens. */
export function worstRank(points: RankPoint[]): Extreme | null {
  let worst: Extreme | null = null;
  for (const p of points) {
    if (p.rank === null) continue;
    if (worst === null || p.rank > worst.rank) worst = { rank: p.rank, observedAt: p.observedAt };
  }
  return worst;
}

export interface StreakInfo {
  longestImprovement: number;
  longestDecline: number;
  /** Aktuelle Serie: > 0 = Verbesserungen in Folge, < 0 = Verschlechterungen. */
  current: number;
}

/** Verbesserungs-/Verschlechterungsserien über aufeinanderfolgende Messwerte. */
export function streaks(points: RankPoint[]): StreakInfo {
  const ranks = points
    .filter((p) => p.rank !== null)
    .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime())
    .map((p) => p.rank as number);
  let longestImprovement = 0;
  let longestDecline = 0;
  let currentImprovement = 0;
  let currentDecline = 0;
  for (let i = 1; i < ranks.length; i++) {
    const m = ranks[i - 1]! - ranks[i]!;
    if (m > 0) {
      currentImprovement += 1;
      currentDecline = 0;
    } else if (m < 0) {
      currentDecline += 1;
      currentImprovement = 0;
    } else {
      currentImprovement = 0;
      currentDecline = 0;
    }
    longestImprovement = Math.max(longestImprovement, currentImprovement);
    longestDecline = Math.max(longestDecline, currentDecline);
  }
  const current = currentImprovement > 0 ? currentImprovement : -currentDecline;
  return { longestImprovement, longestDecline, current };
}

export interface JumpInfo {
  /** Größte Verbesserung zwischen zwei aufeinanderfolgenden Messungen. */
  biggestImprovement: { movement: number; at: Date } | null;
  /** Größte Verschlechterung. */
  biggestDecline: { movement: number; at: Date } | null;
}

export function biggestJumps(points: RankPoint[]): JumpInfo {
  const sorted = points
    .filter((p) => p.rank !== null)
    .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  let bestJump: { movement: number; at: Date } | null = null;
  let worstJump: { movement: number; at: Date } | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const m = (sorted[i - 1]!.rank as number) - (sorted[i]!.rank as number);
    if (m > 0 && (bestJump === null || m > bestJump.movement)) {
      bestJump = { movement: m, at: sorted[i]!.observedAt };
    }
    if (m < 0 && (worstJump === null || m < worstJump.movement)) {
      worstJump = { movement: m, at: sorted[i]!.observedAt };
    }
  }
  return { biggestImprovement: bestJump, biggestDecline: worstJump };
}

export interface GapInfo {
  count: number;
  longestMs: number;
}

/**
 * Datenlücken: Abstände zwischen aufeinanderfolgenden erfolgreichen Messungen,
 * die das erwartete Intervall deutlich überschreiten (Faktor, Standard 2.5).
 * Punkte mit rank === null zählen als fehlende Messung.
 */
export function detectGaps(
  points: RankPoint[],
  expectedIntervalMs: number,
  factor = 2.5,
): GapInfo {
  const successful = points
    .filter((p) => p.rank !== null)
    .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  let count = 0;
  let longestMs = 0;
  const threshold = expectedIntervalMs * factor;
  for (let i = 1; i < successful.length; i++) {
    const delta = successful[i]!.observedAt.getTime() - successful[i - 1]!.observedAt.getTime();
    if (delta > threshold) {
      count += 1;
      longestMs = Math.max(longestMs, delta);
    }
  }
  return { count, longestMs };
}

export interface ThresholdStatus {
  threshold: number;
  reached: boolean;
  firstReachedAt: Date | null;
  currentlyIn: boolean;
  /** Gesamtdauer innerhalb der Schwelle (Summe der Messintervalle, ms). */
  totalDurationMs: number;
}

/**
 * Schwellen-Auswertung (z. B. Top 10.000): erster Eintrittszeitpunkt,
 * aktueller Status und aufsummierte Verweildauer. Die Dauer wird über die
 * Abstände aufeinanderfolgender Messpunkte angenähert, an denen der Rang
 * innerhalb der Schwelle lag (keine Interpolation über Lücken hinweg).
 */
export function thresholdStatus(
  points: RankPoint[],
  threshold: number,
  expectedIntervalMs: number,
): ThresholdStatus {
  const sorted = points
    .filter((p) => p.rank !== null)
    .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  let firstReachedAt: Date | null = null;
  let totalDurationMs = 0;
  const maxSegment = expectedIntervalMs * 2.5;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    const inThreshold = (p.rank as number) <= threshold;
    if (inThreshold && firstReachedAt === null) firstReachedAt = p.observedAt;
    if (inThreshold && i > 0) {
      const prev = sorted[i - 1]!;
      if ((prev.rank as number) <= threshold) {
        const delta = p.observedAt.getTime() - prev.observedAt.getTime();
        if (delta <= maxSegment) totalDurationMs += delta;
      }
    }
  }
  const last = sorted[sorted.length - 1];
  return {
    threshold,
    reached: firstReachedAt !== null,
    firstReachedAt,
    currentlyIn: last !== undefined && (last.rank as number) <= threshold,
    totalDurationMs,
  };
}

export interface SeriesSummary {
  count: number;
  successCount: number;
  missingCount: number;
  completenessPercent: number | null;
  current: RankPoint | null;
  previous: RankPoint | null;
  movement: number | null;
  improvementPercent: number | null;
  best: Extreme | null;
  worst: Extreme | null;
  average: number | null;
  median: number | null;
  stddev: number | null;
  mad: number | null;
  range: number | null;
  /** Durchschnittliche Rangänderung pro Stunde (movement/h; > 0 = Verbesserung). */
  velocityPerHour: number | null;
  velocityPerDay: number | null;
  /** Momentum: Bewegung der letzten Messung minus Durchschnittsbewegung. */
  momentum: number | null;
  streaks: StreakInfo;
  jumps: JumpInfo;
  gaps: GapInfo;
  timeSinceImprovementMs: number | null;
  timeSinceBestMs: number | null;
}

/** Vollständige Zusammenfassung einer Rang-Zeitreihe. */
export function summarizeSeries(
  points: RankPoint[],
  options: { now: Date; expectedIntervalMs: number },
): SeriesSummary {
  const sorted = [...points].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  const successful = sorted.filter((p) => p.rank !== null);
  const ranks = successful.map((p) => p.rank as number);
  const current = successful.length > 0 ? successful[successful.length - 1]! : null;
  const previous = successful.length > 1 ? successful[successful.length - 2]! : null;

  const best = bestRank(sorted);
  const first = successful[0] ?? null;
  let velocityPerHour: number | null = null;
  if (first && current && first !== current) {
    const hours = (current.observedAt.getTime() - first.observedAt.getTime()) / 3_600_000;
    if (hours > 0) {
      velocityPerHour = ((first.rank as number) - (current.rank as number)) / hours;
    }
  }

  // Momentum: letzte Einzelbewegung im Verhältnis zur mittleren Bewegung
  let momentum: number | null = null;
  if (successful.length >= 3) {
    const moves: number[] = [];
    for (let i = 1; i < successful.length; i++) {
      moves.push((successful[i - 1]!.rank as number) - (successful[i]!.rank as number));
    }
    const avgMove = moves.reduce((s, v) => s + v, 0) / moves.length;
    momentum = (moves[moves.length - 1] ?? 0) - avgMove;
  }

  // Zeit seit letzter Verbesserung
  let timeSinceImprovementMs: number | null = null;
  for (let i = successful.length - 1; i >= 1; i--) {
    const m = (successful[i - 1]!.rank as number) - (successful[i]!.rank as number);
    if (m > 0) {
      timeSinceImprovementMs = options.now.getTime() - successful[i]!.observedAt.getTime();
      break;
    }
  }

  const avg = ranks.length > 0 ? ranks.reduce((s, v) => s + v, 0) / ranks.length : null;

  return {
    count: sorted.length,
    successCount: successful.length,
    missingCount: sorted.length - successful.length,
    completenessPercent: sorted.length > 0 ? (successful.length / sorted.length) * 100 : null,
    current,
    previous,
    movement: movement(previous?.rank ?? null, current?.rank ?? null),
    improvementPercent: improvementPercent(previous?.rank ?? null, current?.rank ?? null),
    best,
    worst: worstRank(sorted),
    average: avg,
    median: median(ranks),
    stddev: stddev(ranks),
    mad: medianAbsoluteDeviation(ranks),
    range: ranks.length > 0 ? Math.max(...ranks) - Math.min(...ranks) : null,
    velocityPerHour,
    velocityPerDay: velocityPerHour !== null ? velocityPerHour * 24 : null,
    momentum,
    streaks: streaks(sorted),
    jumps: biggestJumps(sorted),
    gaps: detectGaps(sorted, options.expectedIntervalMs),
    timeSinceImprovementMs,
    timeSinceBestMs:
      best !== null ? options.now.getTime() - best.observedAt.getTime() : null,
  };
}
