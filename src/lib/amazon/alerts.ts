import "server-only";
import {
  CATEGORY_RANK_THRESHOLDS,
  CATEGORY_TYPE_WEBSITE,
  WEBSITE_RANK_THRESHOLDS,
} from "@/lib/amazon/constants";
import { improvementPercent, movement } from "@/lib/amazon/rank-math";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isMailerConfigured } from "@/lib/mailer";

/**
 * Alert-Auslösung mit Deduplizierung und Cooldown.
 * Kanäle: "inapp" (immer verfügbar, AmazonAlertEvent) und "email"
 * (nur wenn Mail-Infrastruktur konfiguriert ist – sonst protokolliert).
 * Während normaler Abrufe wird KEINE Standardnachricht erzeugt – nur
 * konfigurierte Alerts und Systemereignisse laut Regeln unten.
 */

export interface AlertPayload {
  dedupeKey: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  channels?: string;
  ruleId?: string | null;
  cooldownMinutes?: number;
}

/** Löst einen Alert aus, wenn innerhalb des Cooldowns kein gleicher existiert. */
export async function deliverAlert(payload: AlertPayload): Promise<boolean> {
  const cooldownMinutes = payload.cooldownMinutes ?? 360;
  const since = new Date(Date.now() - cooldownMinutes * 60 * 1000);
  const existing = await prisma.amazonAlertEvent.findFirst({
    where: { dedupeKey: payload.dedupeKey, triggeredAt: { gte: since } },
    select: { id: true },
  });
  if (existing) return false;

  const channels = payload.channels ?? "inapp";
  await prisma.amazonAlertEvent.create({
    data: {
      ruleId: payload.ruleId ?? null,
      dedupeKey: payload.dedupeKey,
      title: payload.title.slice(0, 300),
      message: payload.message.slice(0, 2000),
      severity: payload.severity,
      channels,
      triggeredAt: new Date(),
    },
  });
  if (payload.ruleId) {
    await prisma.amazonAlertRule
      .update({ where: { id: payload.ruleId }, data: { lastTriggeredAt: new Date() } })
      .catch(() => {});
  }
  if (channels.includes("email")) {
    if (isMailerConfigured()) {
      // Mail-Provider ist im Projekt noch nicht implementiert (lib/mailer.ts);
      // sobald sendMail existiert, wird hier versendet – kein simulierter Erfolg.
      logger.warn("amazon.alert_email_provider_missing", { dedupeKey: payload.dedupeKey });
    } else {
      logger.info("amazon.alert_email_skipped_not_configured", {
        dedupeKey: payload.dedupeKey,
      });
    }
  }
  logger.info("amazon.alert_triggered", {
    dedupeKey: payload.dedupeKey,
    severity: payload.severity,
  });
  return true;
}

export interface CategoryRankChange {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  previousRank: number | null;
  currentRank: number | null;
  /** Bester Rang VOR dieser Messung (für "neuer Bestwert"). */
  previousBest: number | null;
  stale: boolean;
  dataGap: boolean;
}

/** Systemalerts nach einem Rang-Refresh (Bestwert, Schwellen, Sprünge). */
export async function evaluateRankChangeAlerts(changes: CategoryRankChange[]): Promise<void> {
  for (const change of changes) {
    const { currentRank, previousRank } = change;
    if (currentRank === null) continue;

    // Neuer persönlicher Bestwert
    if (change.previousBest !== null && currentRank < change.previousBest) {
      await deliverAlert({
        dedupeKey: `best:${change.categoryId}:${currentRank}`,
        title: `Neuer Bestwert in „${change.categoryName}“`,
        message: `Rang ${currentRank.toLocaleString("de-DE")} – bisheriger Bestwert: ${change.previousBest.toLocaleString("de-DE")}.`,
        severity: "info",
        cooldownMinutes: 60,
      });
    }

    // Schwellen-Eintritte
    const thresholds =
      change.categoryType === CATEGORY_TYPE_WEBSITE
        ? WEBSITE_RANK_THRESHOLDS
        : CATEGORY_RANK_THRESHOLDS;
    for (const threshold of thresholds) {
      const crossedIn =
        currentRank <= threshold && (previousRank === null || previousRank > threshold);
      if (crossedIn) {
        await deliverAlert({
          dedupeKey: `threshold:${change.categoryId}:${threshold}`,
          title: `Top ${threshold.toLocaleString("de-DE")} erreicht: „${change.categoryName}“`,
          message: `Aktueller Rang: ${currentRank.toLocaleString("de-DE")}${previousRank !== null ? ` (vorher ${previousRank.toLocaleString("de-DE")})` : ""}.`,
          severity: "info",
          cooldownMinutes: 720,
        });
      }
    }

    // Auffällige Sprünge (>= 25 % Bewegung zwischen zwei Messungen)
    const pct = improvementPercent(previousRank, currentRank);
    const move = movement(previousRank, currentRank);
    if (pct !== null && move !== null && Math.abs(pct) >= 25 && Math.abs(move) >= 5) {
      await deliverAlert({
        dedupeKey: `jump:${change.categoryId}:${move > 0 ? "up" : "down"}`,
        title:
          move > 0
            ? `Starker Aufstieg in „${change.categoryName}“`
            : `Starker Abstieg in „${change.categoryName}“`,
        message: `${previousRank!.toLocaleString("de-DE")} → ${currentRank.toLocaleString("de-DE")} (${pct > 0 ? "+" : ""}${pct.toFixed(1)} %).`,
        severity: move > 0 ? "info" : "warning",
        cooldownMinutes: 180,
      });
    }
  }

  // Benutzerdefinierte Regeln
  const rules = await prisma.amazonAlertRule.findMany({ where: { enabled: true } });
  for (const rule of rules) {
    const relevant = changes.filter(
      (c) => (rule.categoryId === null || c.categoryId === rule.categoryId) && c.currentRank !== null,
    );
    for (const change of relevant) {
      const value = resolveMetricValue(rule.metric, change);
      if (value === null || rule.threshold === null) continue;
      const threshold = Number(rule.threshold);
      const hit =
        (rule.operator === "lt" && value < threshold) ||
        (rule.operator === "lte" && value <= threshold) ||
        (rule.operator === "gt" && value > threshold) ||
        (rule.operator === "gte" && value >= threshold) ||
        (rule.operator === "eq" && value === threshold);
      if (!hit) continue;
      await deliverAlert({
        dedupeKey: `rule:${rule.id}:${change.categoryId}`,
        title: rule.name,
        message: `„${change.categoryName}“: ${rule.metric} = ${value.toLocaleString("de-DE")} (Schwelle ${threshold.toLocaleString("de-DE")}).`,
        severity: "info",
        channels: rule.channels,
        ruleId: rule.id,
        cooldownMinutes: rule.cooldownMinutes,
      });
    }
  }
}

function resolveMetricValue(metric: string, change: CategoryRankChange): number | null {
  switch (metric) {
    case "rank":
    case "rank_below":
      return change.currentRank;
    case "movement_positions":
      return movement(change.previousRank, change.currentRank);
    case "movement_percent":
      return improvementPercent(change.previousRank, change.currentRank);
    default:
      return null;
  }
}

/** Alerts für neu entdeckte Kategorien. */
export async function alertDiscoveredCategories(
  discovered: Array<{ id: string; name: string }>,
): Promise<void> {
  for (const category of discovered) {
    await deliverAlert({
      dedupeKey: `category_discovered:${category.id}`,
      title: `Neue Amazon-Kategorie entdeckt: „${category.name}“`,
      message:
        "Amazon listet das Buch jetzt in dieser Kategorie. Sie wird automatisch weiter beobachtet (Auto-Follow).",
      severity: "info",
      cooldownMinutes: 10_080,
    });
  }
}

/** Provider-/Creditalerts (Ausfall, Fallback, Credits). */
export async function alertProviderIssue(options: {
  provider: string;
  kind: "down" | "fallback_active" | "circuit_open";
  detail: string;
}): Promise<void> {
  const severity = options.kind === "down" || options.kind === "circuit_open" ? "critical" : "warning";
  await deliverAlert({
    dedupeKey: `provider:${options.provider}:${options.kind}`,
    title:
      options.kind === "down"
        ? `Provider ausgefallen: ${options.provider}`
        : options.kind === "circuit_open"
          ? `Circuit Breaker geöffnet: ${options.provider}`
          : `Fallback aktiv (${options.provider})`,
    message: options.detail,
    severity,
    cooldownMinutes: 120,
  });
}

export async function alertCreditLevel(options: {
  warnLevel: "hint" | "warning" | "critical" | "forecast_exceeded";
  creditsRemaining: number | null;
  creditsLimit: number | null;
}): Promise<void> {
  const remaining = options.creditsRemaining?.toLocaleString("de-DE") ?? "unbekannt";
  const messages: Record<string, { title: string; severity: "info" | "warning" | "critical" }> = {
    hint: { title: "Rainforest-Credits unter 30 %", severity: "info" },
    warning: { title: "Rainforest-Credits unter 20 %", severity: "warning" },
    critical: { title: "Rainforest-Credits unter 10 %", severity: "critical" },
    forecast_exceeded: {
      title: "Prognose: Creditbudget reicht nicht bis zum Reset",
      severity: "warning",
    },
  };
  const config = messages[options.warnLevel];
  if (!config) return;
  await deliverAlert({
    dedupeKey: `credits:${options.warnLevel}`,
    title: config.title,
    message: `Verbleibende Credits: ${remaining}${options.creditsLimit ? ` von ${options.creditsLimit.toLocaleString("de-DE")}` : ""}.`,
    severity: config.severity,
    cooldownMinutes: 720,
  });
}

/** Metadaten-Änderungen (Preis, Verfügbarkeit, Vorbestellstatus, Bewertung). */
export async function alertMetadataChanges(
  editionLabel: string,
  changes: Array<{ field: string; from: string | null; to: string | null }>,
): Promise<void> {
  const labels: Record<string, string> = {
    price: "Preis geändert",
    availability: "Verfügbarkeit geändert",
    preorder: "Vorbestellstatus geändert",
    rating: "Bewertung geändert",
    reviewCount: "Bewertungsanzahl geändert",
  };
  for (const change of changes) {
    const label = labels[change.field];
    if (!label) continue;
    await deliverAlert({
      dedupeKey: `meta:${change.field}:${change.to ?? ""}`,
      title: `${label}: ${editionLabel}`,
      message: `${change.from ?? "unbekannt"} → ${change.to ?? "unbekannt"}.`,
      severity: change.field === "preorder" || change.field === "availability" ? "warning" : "info",
      cooldownMinutes: 360,
    });
  }
}
