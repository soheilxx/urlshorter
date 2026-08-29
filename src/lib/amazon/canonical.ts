import { absoluteProviderDifference, relativeProviderDifference } from "@/lib/amazon/rank-math";

/**
 * Kanonische Rangauswahl (rein, unit-getestet).
 *
 * Priorität für das eigene Buch:
 *   1. Amazon Creators, wenn Wert vorhanden, vollständig und ausreichend frisch
 *   2. Rainforest, wenn Creators keinen Rang liefert / veraltet / ausgefallen
 *   3. letzter erfolgreicher kanonischer Wert – als stale gekennzeichnet
 *   4. Datenlücke (canonicalRank = null, dataGap = true)
 *
 * Eine Abweichung zwischen den Providern ist ein Datenqualitätsindikator,
 * kein automatischer Fehler (Provider aktualisieren zeitversetzt).
 */

export interface ProviderObservationInput {
  /** Positiver Rang oder null (Provider hat keinen Rang geliefert). */
  rank: number | null;
  fetchedAt: Date;
  /** Antwort war unvollständig (partial). */
  partial?: boolean;
}

export interface LastCanonicalInput {
  rank: number;
  observedAt: Date;
}

export interface CanonicalSelectionInput {
  creators: ProviderObservationInput | null;
  rainforest: ProviderObservationInput | null;
  lastCanonical: LastCanonicalInput | null;
  now: Date;
  /** Ab diesem Alter gilt eine Messung nicht mehr als frisch. */
  staleAfterMs: number;
  /** Priorität umkehrbar (Admin-Einstellung); Standard: Creators zuerst. */
  priority?: "creators_first" | "rainforest_first";
}

export interface CanonicalSelection {
  canonicalRank: number | null;
  selectedProvider: "CREATORS" | "RAINFOREST" | null;
  selectionReason:
    | "creators_fresh"
    | "rainforest_fresh"
    | "creators_fallback"
    | "rainforest_fallback"
    | "stale_last_value"
    | "data_gap";
  stale: boolean;
  dataGap: boolean;
  /** Absolute Abweichung beider Provider (nur wenn beide Werte liefern). */
  providerDifference: number | null;
  providerDifferencePercent: number | null;
  discrepancy: boolean;
}

function isUsable(
  obs: ProviderObservationInput | null,
  now: Date,
  staleAfterMs: number,
): obs is ProviderObservationInput & { rank: number } {
  return (
    obs !== null &&
    obs.rank !== null &&
    obs.rank > 0 &&
    now.getTime() - obs.fetchedAt.getTime() <= staleAfterMs
  );
}

export function selectCanonical(input: CanonicalSelectionInput): CanonicalSelection {
  const { creators, rainforest, lastCanonical, now, staleAfterMs } = input;
  const priority = input.priority ?? "creators_first";

  const creatorsUsable = isUsable(creators, now, staleAfterMs) && creators?.partial !== true;
  const rainforestUsable = isUsable(rainforest, now, staleAfterMs);

  const difference = absoluteProviderDifference(creators?.rank ?? null, rainforest?.rank ?? null);

  const pick = (
    provider: "CREATORS" | "RAINFOREST",
    rank: number,
    reason: CanonicalSelection["selectionReason"],
  ): CanonicalSelection => ({
    canonicalRank: rank,
    selectedProvider: provider,
    selectionReason: reason,
    stale: false,
    dataGap: false,
    providerDifference: difference,
    providerDifferencePercent: relativeProviderDifference(difference, rank),
    discrepancy: difference !== null && difference > 0,
  });

  const primaryFirst = priority === "creators_first";
  if (primaryFirst && creatorsUsable) {
    return pick("CREATORS", creators!.rank as number, "creators_fresh");
  }
  if (!primaryFirst && rainforestUsable) {
    return pick("RAINFOREST", rainforest!.rank as number, "rainforest_fresh");
  }
  if (rainforestUsable) {
    return pick(
      "RAINFOREST",
      rainforest!.rank as number,
      primaryFirst ? "rainforest_fallback" : "rainforest_fresh",
    );
  }
  if (creatorsUsable) {
    return pick(
      "CREATORS",
      creators!.rank as number,
      primaryFirst ? "creators_fresh" : "creators_fallback",
    );
  }

  if (lastCanonical !== null) {
    return {
      canonicalRank: lastCanonical.rank,
      selectedProvider: null,
      selectionReason: "stale_last_value",
      stale: true,
      dataGap: false,
      providerDifference: null,
      providerDifferencePercent: null,
      discrepancy: false,
    };
  }

  return {
    canonicalRank: null,
    selectedProvider: null,
    selectionReason: "data_gap",
    stale: false,
    dataGap: true,
    providerDifference: null,
    providerDifferencePercent: null,
    discrepancy: false,
  };
}
