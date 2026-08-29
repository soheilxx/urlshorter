import "server-only";
import { MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES } from "@/lib/amazon/constants";
import { getEnv } from "@/lib/env";
import { getSetting, setSetting } from "@/lib/settings";

/**
 * Einstellungen des Amazon-Ranking-Moduls: AppSetting-Keys "amazon.*"
 * überschreiben die Env-Standardwerte – im Dashboard ohne Deployment änderbar.
 */

export interface AmazonSettings {
  enabled: boolean;
  rankIntervalMinutes: number;
  leaderboardIntervalMinutes: number;
  metadataIntervalMinutes: number;
  healthIntervalMinutes: number;
  accountStatusIntervalMinutes: number;
  digestEnabled: boolean;
  /** "HH:MM" in AMAZON_TIMEZONE – erster erfolgreicher Lauf ab dieser Uhrzeit */
  digestTime: string;
  digestRecipient: string;
  timezone: string;
  providerPriority: "creators_first" | "rainforest_first";
  fallbackEnabled: boolean;
  staleAfterMinutes: number;
  dailyCreditBudget: number | null;
  salesEstimationEnabled: boolean;
  autoFollowCategories: boolean;
  rawPayloadRetentionDays: number;
  /** 0 = unbegrenzt */
  rankRetentionDays: number;
}

const KEYS = {
  enabled: "amazon.enabled",
  rankInterval: "amazon.rank_interval_minutes",
  leaderboardInterval: "amazon.leaderboard_interval_minutes",
  metadataInterval: "amazon.metadata_interval_minutes",
  healthInterval: "amazon.health_interval_minutes",
  accountInterval: "amazon.account_interval_minutes",
  digestEnabled: "amazon.digest_enabled",
  digestTime: "amazon.digest_time",
  digestRecipient: "amazon.digest_recipient",
  providerPriority: "amazon.provider_priority",
  fallbackEnabled: "amazon.fallback_enabled",
  staleAfterMinutes: "amazon.stale_after_minutes",
  dailyCreditBudget: "amazon.daily_credit_budget",
  salesEstimationEnabled: "amazon.sales_estimation_enabled",
  autoFollowCategories: "amazon.auto_follow_categories",
} as const;

function parseBool(raw: string | null, fallback: boolean): boolean {
  if (raw === null) return fallback;
  return raw === "true";
}

function parseIntervalMinutes(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return clampInterval(n);
}

export function clampInterval(minutes: number): number {
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.round(minutes)));
}

export async function getAmazonSettings(): Promise<AmazonSettings> {
  const env = getEnv();
  const [
    enabled,
    rankInterval,
    leaderboardInterval,
    metadataInterval,
    healthInterval,
    accountInterval,
    digestEnabled,
    digestTime,
    digestRecipient,
    providerPriority,
    fallbackEnabled,
    staleAfterMinutes,
    dailyCreditBudget,
    salesEstimationEnabled,
    autoFollowCategories,
  ] = await Promise.all([
    getSetting(KEYS.enabled),
    getSetting(KEYS.rankInterval),
    getSetting(KEYS.leaderboardInterval),
    getSetting(KEYS.metadataInterval),
    getSetting(KEYS.healthInterval),
    getSetting(KEYS.accountInterval),
    getSetting(KEYS.digestEnabled),
    getSetting(KEYS.digestTime),
    getSetting(KEYS.digestRecipient),
    getSetting(KEYS.providerPriority),
    getSetting(KEYS.fallbackEnabled),
    getSetting(KEYS.staleAfterMinutes),
    getSetting(KEYS.dailyCreditBudget),
    getSetting(KEYS.salesEstimationEnabled),
    getSetting(KEYS.autoFollowCategories),
  ]);

  const budgetParsed = dailyCreditBudget !== null ? Number.parseInt(dailyCreditBudget, 10) : NaN;

  return {
    enabled: parseBool(enabled, env.AMAZON_RANKING_ENABLED),
    rankIntervalMinutes: parseIntervalMinutes(rankInterval, env.AMAZON_RANK_DEFAULT_INTERVAL_MINUTES),
    leaderboardIntervalMinutes: parseIntervalMinutes(
      leaderboardInterval,
      env.AMAZON_LEADERBOARD_DEFAULT_INTERVAL_MINUTES,
    ),
    metadataIntervalMinutes: parseIntervalMinutes(
      metadataInterval,
      env.AMAZON_METADATA_INTERVAL_MINUTES,
    ),
    healthIntervalMinutes: parseIntervalMinutes(
      healthInterval,
      env.AMAZON_PROVIDER_HEALTH_INTERVAL_MINUTES,
    ),
    accountStatusIntervalMinutes: parseIntervalMinutes(
      accountInterval,
      env.AMAZON_ACCOUNT_STATUS_INTERVAL_MINUTES,
    ),
    digestEnabled: parseBool(digestEnabled, true),
    digestTime: digestTime && /^\d{2}:\d{2}$/.test(digestTime) ? digestTime : env.AMAZON_DIGEST_TIME,
    digestRecipient: digestRecipient ?? "dashboard",
    timezone: env.AMAZON_TIMEZONE,
    providerPriority: providerPriority === "rainforest_first" ? "rainforest_first" : "creators_first",
    fallbackEnabled: parseBool(fallbackEnabled, true),
    staleAfterMinutes: parseIntervalMinutes(staleAfterMinutes, 180),
    dailyCreditBudget: Number.isFinite(budgetParsed) && budgetParsed > 0
      ? budgetParsed
      : env.AMAZON_RANKING_DAILY_CREDIT_BUDGET,
    salesEstimationEnabled: parseBool(salesEstimationEnabled, env.AMAZON_SALES_ESTIMATION_ENABLED),
    autoFollowCategories: parseBool(autoFollowCategories, true),
    rawPayloadRetentionDays: env.AMAZON_RAW_PAYLOAD_RETENTION_DAYS,
    rankRetentionDays: env.AMAZON_RANK_RETENTION_DAYS,
  };
}

export interface AmazonSettingsUpdate {
  enabled?: boolean;
  rankIntervalMinutes?: number;
  leaderboardIntervalMinutes?: number;
  metadataIntervalMinutes?: number;
  digestEnabled?: boolean;
  digestTime?: string;
  digestRecipient?: string;
  providerPriority?: "creators_first" | "rainforest_first";
  fallbackEnabled?: boolean;
  staleAfterMinutes?: number;
  dailyCreditBudget?: number | null;
  salesEstimationEnabled?: boolean;
  autoFollowCategories?: boolean;
}

export async function updateAmazonSettings(update: AmazonSettingsUpdate): Promise<void> {
  const writes: Array<Promise<void>> = [];
  const put = (key: string, value: string) => writes.push(setSetting(key, value));

  if (update.enabled !== undefined) put(KEYS.enabled, String(update.enabled));
  if (update.rankIntervalMinutes !== undefined) {
    put(KEYS.rankInterval, String(clampInterval(update.rankIntervalMinutes)));
  }
  if (update.leaderboardIntervalMinutes !== undefined) {
    put(KEYS.leaderboardInterval, String(clampInterval(update.leaderboardIntervalMinutes)));
  }
  if (update.metadataIntervalMinutes !== undefined) {
    put(KEYS.metadataInterval, String(clampInterval(update.metadataIntervalMinutes)));
  }
  if (update.digestEnabled !== undefined) put(KEYS.digestEnabled, String(update.digestEnabled));
  if (update.digestTime !== undefined && /^\d{2}:\d{2}$/.test(update.digestTime)) {
    put(KEYS.digestTime, update.digestTime);
  }
  if (update.digestRecipient !== undefined) {
    put(KEYS.digestRecipient, update.digestRecipient.slice(0, 200));
  }
  if (update.providerPriority !== undefined) put(KEYS.providerPriority, update.providerPriority);
  if (update.fallbackEnabled !== undefined) {
    put(KEYS.fallbackEnabled, String(update.fallbackEnabled));
  }
  if (update.staleAfterMinutes !== undefined) {
    put(KEYS.staleAfterMinutes, String(clampInterval(update.staleAfterMinutes)));
  }
  if (update.dailyCreditBudget !== undefined) {
    put(KEYS.dailyCreditBudget, update.dailyCreditBudget === null ? "" : String(update.dailyCreditBudget));
  }
  if (update.salesEstimationEnabled !== undefined) {
    put(KEYS.salesEstimationEnabled, String(update.salesEstimationEnabled));
  }
  if (update.autoFollowCategories !== undefined) {
    put(KEYS.autoFollowCategories, String(update.autoFollowCategories));
  }
  await Promise.all(writes);
}
