import type { AmazonCapability } from "@/lib/amazon/constants";

/**
 * Capability-basierte Provider-Abstraktion des Amazon-Ranking-Moduls.
 * Beide Provider (Amazon Creators API, Rainforest API) liefern normalisierte
 * Strukturen; die Zuständigkeiten sind in docs/amazon-ranking-architecture.md
 * festgelegt.
 */

export type ProviderErrorClass =
  | "auth"
  | "rate_limit"
  | "quota"
  | "timeout"
  | "network"
  | "server"
  | "client"
  | "not_found"
  | "validation"
  | "not_configured";

/** Normalisierter, sicherer Provider-Fehler (Meldung immer redigiert). */
export class ProviderError extends Error {
  readonly errorClass: ProviderErrorClass;
  readonly retryable: boolean;
  readonly httpStatus: number | null;
  readonly code: string | null;

  constructor(options: {
    message: string;
    errorClass: ProviderErrorClass;
    retryable?: boolean;
    httpStatus?: number | null;
    code?: string | null;
  }) {
    super(options.message);
    this.name = "ProviderError";
    this.errorClass = options.errorClass;
    this.retryable =
      options.retryable ?? ["rate_limit", "timeout", "network", "server"].includes(options.errorClass);
    this.httpStatus = options.httpStatus ?? null;
    this.code = options.code ?? null;
  }
}

export interface NormalizedCategoryRank {
  providerCategoryId: string;
  categoryName: string;
  /** Vollständiger Pfad (Ancestor-Kette), z. B. "Bücher › Business & Karriere › …" */
  categoryPath: string | null;
  rank: number;
  isRoot: boolean;
  /** Bestseller-URL laut Provider (Rainforest-Link) – für den URL-Fallback. */
  bestsellerUrl: string | null;
}

export interface NormalizedProductRanks {
  asin: string;
  /** Gesamtrang (websiteSalesRank); null wenn nicht geliefert. */
  websiteSalesRank: number | null;
  websiteDisplayGroup: string | null;
  categoryRanks: NormalizedCategoryRank[];
  /** Zeitstempel laut Provider (falls geliefert). */
  providerUpdatedAt: Date | null;
  /** Antwort war unvollständig (z. B. Item nur teilweise zugänglich). */
  partial: boolean;
}

export interface NormalizedProductMetadata {
  asin: string;
  parentAsin: string | null;
  title: string | null;
  author: string | null;
  publisher: string | null;
  format: string | null;
  isbn10: string | null;
  isbn13: string | null;
  publicationDate: string | null;
  coverSmallUrl: string | null;
  coverMediumUrl: string | null;
  coverLargeUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  price: number | null;
  currency: string | null;
  priceRaw: string | null;
  availability: string | null;
  preorder: boolean | null;
  rating: number | null;
  reviewCount: number | null;
  productUrl: string | null;
}

export interface NormalizedLeaderboardEntry {
  position: number;
  bestsellerRank: number;
  asin: string;
  title: string;
  subTitle: string | null;
  author: string | null;
  variant: string | null;
  link: string | null;
  image: string | null;
  rating: number | null;
  reviewCount: number | null;
  price: number | null;
  currency: string | null;
  priceRaw: string | null;
}

export interface NormalizedLeaderboard {
  providerCategoryId: string | null;
  categoryName: string | null;
  entries: NormalizedLeaderboardEntry[];
  /** Anzahl eindeutiger Einträge vor der Begrenzung. */
  returnedCount: number;
  complete: boolean;
  partialReason: string | null;
  providerUpdatedAt: Date | null;
}

export interface NormalizedCategory {
  providerCategoryId: string;
  name: string;
  type: string | null;
  path: string | null;
  parentId: string | null;
  hasChildren: boolean | null;
  isRoot: boolean | null;
  domain: string | null;
  url: string | null;
}

export interface ProviderQuotaStatus {
  plan: string | null;
  creditsUsed: number | null;
  creditsLimit: number | null;
  creditsRemaining: number | null;
  creditsResetAt: string | null;
  overageAllowed: boolean | null;
  /** Redigierte Plattform-Statusliste. */
  platformStatus: Array<{ component: string; status: string }> | null;
  monthlyUsage: Array<{ month: string; year: number; credits: number }> | null;
}

export interface ProviderTestResult {
  configured: boolean;
  ok: boolean;
  latencyMs: number | null;
  capabilities: AmazonCapability[];
  /** Redigierte, sichere Meldung (nie Secrets). */
  message: string;
  testedAt: Date;
}
