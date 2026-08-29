"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EMPTY_USER_STATE, type UserActionState } from "@/actions/action-states";
import { clampInterval, updateAmazonSettings } from "@/lib/amazon/amazon-settings";
import { AMAZON_JOB_TYPES, type AmazonJobType } from "@/lib/amazon/constants";
import { importManualBaseline, runAmazonJob } from "@/lib/amazon/jobs";
import { testCreatorsConnection } from "@/lib/amazon/providers/creators";
import { testRainforestConnection } from "@/lib/amazon/providers/rainforest";
import {
  asinMatchesIsbn13,
  isValidAsin,
  isValidIsbn10,
  isValidIsbn13,
  normalizeIsbn,
} from "@/lib/amazon/validation";
import { writeAuditLog } from "@/lib/audit";
import { requireRoleOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Server Actions des Amazon-Ranking-Moduls (nur ADMIN, mit Audit-Log).
 * Zustandsbehaftete Actions (useActionState) verzichten auf revalidatePath
 * (siehe README → Fehlerbehebung); klassische Form-Actions revalidieren.
 */

function fail(message: string): UserActionState {
  return { ...EMPTY_USER_STATE, error: message };
}

function ok(message: string): UserActionState {
  return { ...EMPTY_USER_STATE, ok: true, success: message };
}

function errorState(error: unknown): UserActionState {
  return fail(error instanceof Error ? error.message : "Unbekannter Fehler.");
}

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  enabled: z.boolean(),
  rankIntervalMinutes: z.coerce.number().int().min(15).max(10_080),
  leaderboardIntervalMinutes: z.coerce.number().int().min(15).max(10_080),
  metadataIntervalMinutes: z.coerce.number().int().min(60).max(10_080),
  staleAfterMinutes: z.coerce.number().int().min(15).max(10_080),
  providerPriority: z.enum(["creators_first", "rainforest_first"]),
  fallbackEnabled: z.boolean(),
  digestEnabled: z.boolean(),
  digestTime: z.string().regex(/^\d{2}:\d{2}$/, "Uhrzeit im Format HH:MM angeben."),
  digestRecipient: z.string().trim().min(1).max(200),
  dailyCreditBudget: z.string().trim(),
  salesEstimationEnabled: z.boolean(),
  autoFollowCategories: z.boolean(),
});

export async function saveAmazonSettingsAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const bool = (name: string) => formData.get(name) === "on" || formData.get(name) === "true";
    const parsed = settingsSchema.safeParse({
      enabled: bool("enabled"),
      rankIntervalMinutes: formData.get("rankIntervalMinutes"),
      leaderboardIntervalMinutes: formData.get("leaderboardIntervalMinutes"),
      metadataIntervalMinutes: formData.get("metadataIntervalMinutes"),
      staleAfterMinutes: formData.get("staleAfterMinutes"),
      providerPriority: formData.get("providerPriority"),
      fallbackEnabled: bool("fallbackEnabled"),
      digestEnabled: bool("digestEnabled"),
      digestTime: formData.get("digestTime"),
      digestRecipient: formData.get("digestRecipient") || "dashboard",
      dailyCreditBudget: formData.get("dailyCreditBudget") ?? "",
      salesEstimationEnabled: bool("salesEstimationEnabled"),
      autoFollowCategories: bool("autoFollowCategories"),
    });
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
    }
    const input = parsed.data;
    const budget = input.dailyCreditBudget === "" ? null : Number.parseInt(input.dailyCreditBudget, 10);
    if (budget !== null && (!Number.isFinite(budget) || budget < 1 || budget > 1_000_000)) {
      return fail("Tagesbudget muss leer oder eine Zahl zwischen 1 und 1.000.000 sein.");
    }

    await updateAmazonSettings({
      enabled: input.enabled,
      rankIntervalMinutes: clampInterval(input.rankIntervalMinutes),
      leaderboardIntervalMinutes: clampInterval(input.leaderboardIntervalMinutes),
      metadataIntervalMinutes: clampInterval(input.metadataIntervalMinutes),
      staleAfterMinutes: clampInterval(input.staleAfterMinutes),
      providerPriority: input.providerPriority,
      fallbackEnabled: input.fallbackEnabled,
      digestEnabled: input.digestEnabled,
      digestTime: input.digestTime,
      digestRecipient: input.digestRecipient,
      dailyCreditBudget: budget,
      salesEstimationEnabled: input.salesEstimationEnabled,
      autoFollowCategories: input.autoFollowCategories,
    });
    await writeAuditLog({
      actor: session.email,
      action: "amazon.settings_updated",
      entityType: "AmazonSettings",
      changes: {
        enabled: input.enabled,
        rankIntervalMinutes: input.rankIntervalMinutes,
        leaderboardIntervalMinutes: input.leaderboardIntervalMinutes,
        providerPriority: input.providerPriority,
        digestEnabled: input.digestEnabled,
      },
    });
    return ok("Einstellungen gespeichert.");
  } catch (error) {
    return errorState(error);
  }
}

// ---------------------------------------------------------------------------
// Manuelle Job-Auslösung (Rate-Limit + Lock in runAmazonJob)
// ---------------------------------------------------------------------------

export async function runAmazonJobAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const jobType = String(formData.get("jobType") ?? "");
    if (!(AMAZON_JOB_TYPES as readonly string[]).includes(jobType)) {
      return fail("Unbekannter Job.");
    }
    const result = await runAmazonJob(jobType as AmazonJobType, {
      force: true,
      actor: session.email,
    });
    await writeAuditLog({
      actor: session.email,
      action: "amazon.manual_refresh",
      entityType: "AmazonJob",
      entityId: jobType,
      changes: { status: result.status },
    });
    if (result.status === "SUCCESS" || result.status === "PARTIAL" || result.status === "SKIPPED") {
      return ok(`${jobType}: ${result.detail}`);
    }
    return fail(`${jobType}: ${result.detail}`);
  } catch (error) {
    return errorState(error);
  }
}

// ---------------------------------------------------------------------------
// Provider-Verbindungstests (Secrets werden nie zurückgegeben)
// ---------------------------------------------------------------------------

export async function testProvidersAction(): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const [creators, rainforest] = await Promise.all([
      testCreatorsConnection(),
      testRainforestConnection(),
    ]);
    await writeAuditLog({
      actor: session.email,
      action: "amazon.test_connection",
      entityType: "AmazonProvider",
      changes: { creatorsOk: creators.ok, rainforestOk: rainforest.ok },
    });
    const line = (name: string, r: { configured: boolean; ok: boolean; latencyMs: number | null; message: string }) =>
      `${name}: ${r.configured ? (r.ok ? `OK (${r.latencyMs} ms)` : `Fehler – ${r.message}`) : "nicht konfiguriert"}`;
    const summary = `${line("Amazon Creators", creators)} · ${line("Rainforest", rainforest)}`;
    return creators.ok || rainforest.ok ? ok(summary) : fail(summary);
  } catch (error) {
    return errorState(error);
  }
}

// ---------------------------------------------------------------------------
// Kategorien: Flags, Intervall, Mapping-Verifizierung
// ---------------------------------------------------------------------------

export async function updateCategoryAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const id = z.string().min(1).parse(formData.get("categoryId"));
    const category = await prisma.amazonCategory.findUnique({ where: { id } });
    if (!category) return fail("Kategorie nicht gefunden.");

    const active = formData.get("active") === "on";
    if (category.required && !active) {
      return fail(`„${category.canonicalName}“ ist eine Pflichtkategorie und kann nicht deaktiviert werden.`);
    }
    const intervalRaw = String(formData.get("refreshIntervalOverride") ?? "").trim();
    let refreshIntervalOverride: number | null = null;
    if (intervalRaw !== "") {
      const parsed = Number.parseInt(intervalRaw, 10);
      if (!Number.isFinite(parsed)) return fail("Intervall muss eine Zahl (Minuten) sein.");
      refreshIntervalOverride = clampInterval(parsed);
    }

    await prisma.amazonCategory.update({
      where: { id },
      data: {
        active,
        leaderboardEnabled: formData.get("leaderboardEnabled") === "on",
        autoFollow: formData.get("autoFollow") === "on",
        refreshIntervalOverride,
      },
    });
    await writeAuditLog({
      actor: session.email,
      action: "amazon.category_updated",
      entityType: "AmazonCategory",
      entityId: id,
      changes: { active, refreshIntervalOverride },
    });
    return ok(`Kategorie „${category.canonicalName}“ aktualisiert.`);
  } catch (error) {
    return errorState(error);
  }
}

/** Mapping als korrekt bestätigen (bei mehrdeutiger Sachbücher-Auflösung). */
export async function verifyCategoryMappingAction(formData: FormData): Promise<void> {
  const session = await requireRoleOrThrow("ADMIN");
  const mappingId = z.string().min(1).parse(formData.get("mappingId"));
  const mapping = await prisma.amazonCategoryProviderMapping.findUniqueOrThrow({
    where: { id: mappingId },
  });
  await prisma.$transaction([
    prisma.amazonCategoryProviderMapping.updateMany({
      where: { categoryId: mapping.categoryId, provider: mapping.provider },
      data: { verified: false, verifiedAt: null },
    }),
    prisma.amazonCategoryProviderMapping.update({
      where: { id: mappingId },
      data: { verified: true, verifiedAt: new Date() },
    }),
    prisma.amazonCategory.update({
      where: { id: mapping.categoryId },
      data: { resolutionStatus: "resolved", lastResolvedAt: new Date() },
    }),
  ]);
  await writeAuditLog({
    actor: session.email,
    action: "amazon.mapping_verified",
    entityType: "AmazonCategoryProviderMapping",
    entityId: mappingId,
    changes: { providerCategoryId: mapping.providerCategoryId },
  });
  revalidatePath("/admin/amazon/kategorien");
}

/** Rainforest-Kategoriensuche: legt Treffer als inaktive Kategorie + Mappings an. */
export async function searchCategoryAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const term = z
      .string()
      .trim()
      .min(2, "Suchbegriff mit mindestens 2 Zeichen angeben.")
      .max(100)
      .parse(formData.get("term"));
    const { rainforestSearchCategories, isRainforestConfigured } = await import(
      "@/lib/amazon/providers/rainforest"
    );
    if (!isRainforestConfigured()) {
      return fail("Rainforest API ist nicht konfiguriert (RAINFOREST_API_KEY).");
    }
    const { normalizeCategoryName } = await import("@/lib/amazon/store");
    const result = await rainforestSearchCategories(term);
    if (result.data.length === 0) return fail(`Keine Bestsellerkategorie für „${term}“ gefunden.`);

    let stored = 0;
    for (const candidate of result.data.slice(0, 10)) {
      const normalized = normalizeCategoryName(candidate.name);
      let category = await prisma.amazonCategory.findFirst({
        where: { normalizedName: normalized, categoryType: "BESTSELLERS" },
      });
      if (!category) {
        category = await prisma.amazonCategory.create({
          data: {
            canonicalName: candidate.name,
            normalizedName: normalized,
            path: candidate.path,
            categoryType: "BESTSELLERS",
            active: false,
            leaderboardEnabled: false,
            resolutionStatus: "resolved",
            lastResolvedAt: new Date(),
          },
        });
      }
      await prisma.amazonCategoryProviderMapping.upsert({
        where: {
          categoryId_provider_providerCategoryId: {
            categoryId: category.id,
            provider: "RAINFOREST",
            providerCategoryId: candidate.providerCategoryId,
          },
        },
        update: { providerCategoryPath: candidate.path, providerCategoryUrl: candidate.url },
        create: {
          categoryId: category.id,
          provider: "RAINFOREST",
          providerCategoryId: candidate.providerCategoryId,
          providerCategoryName: candidate.name,
          providerCategoryPath: candidate.path,
          providerCategoryUrl: candidate.url,
          verified: false,
        },
      });
      stored += 1;
    }
    await writeAuditLog({
      actor: session.email,
      action: "amazon.category_search",
      entityType: "AmazonCategory",
      changes: { term, stored },
    });
    return ok(
      `${stored} Treffer gespeichert (inaktiv). Pfade prüfen, Mapping verifizieren und Kategorie aktivieren.`,
    );
  } catch (error) {
    return errorState(error);
  }
}

// ---------------------------------------------------------------------------
// Edition anlegen/bearbeiten (ASIN-/ISBN-Validierung)
// ---------------------------------------------------------------------------

const editionSchema = z.object({
  asin: z.string().trim().toUpperCase(),
  isbn10: z.string().trim(),
  isbn13: z.string().trim(),
  format: z.string().trim().min(1, "Format angeben (z. B. Taschenbuch).").max(60),
  preorder: z.boolean(),
  trackedShortCode: z.string().trim().toLowerCase(),
});

export async function saveEditionAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const editionId = String(formData.get("editionId") ?? "");
    const parsed = editionSchema.safeParse({
      asin: formData.get("asin"),
      isbn10: formData.get("isbn10") ?? "",
      isbn13: formData.get("isbn13") ?? "",
      format: formData.get("format"),
      preorder: formData.get("preorder") === "on",
      trackedShortCode: formData.get("trackedShortCode") ?? "",
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
    const input = parsed.data;

    if (!isValidAsin(input.asin)) {
      return fail("ASIN ist ungültig (genau 10 Zeichen, A–Z und 0–9).");
    }
    if (input.isbn10 && !isValidIsbn10(input.isbn10)) {
      return fail("ISBN-10 ist ungültig (Prüfziffer stimmt nicht).");
    }
    if (input.isbn13 && !isValidIsbn13(input.isbn13)) {
      return fail("ISBN-13 ist ungültig (Prüfziffer stimmt nicht).");
    }
    if (input.isbn13 && !asinMatchesIsbn13(input.asin, input.isbn13)) {
      // Hinweis, kein harter Fehler: bei Nicht-Buch-ASINs zulässig
      if (input.asin === normalizeIsbn(input.isbn10 || "")) {
        return fail("ASIN und ISBN-13 passen nicht zusammen – bitte prüfen.");
      }
    }
    if (input.trackedShortCode && !/^[a-z]{4}$/.test(input.trackedShortCode)) {
      return fail("Kurzlink-Code besteht aus genau 4 Kleinbuchstaben.");
    }

    const edition = await prisma.amazonEdition.findUnique({ where: { id: editionId } });
    if (!edition) return fail("Edition nicht gefunden.");

    await prisma.amazonEdition.update({
      where: { id: editionId },
      data: {
        asin: input.asin,
        isbn10: input.isbn10 ? normalizeIsbn(input.isbn10) : null,
        isbn13: input.isbn13 ? normalizeIsbn(input.isbn13) : null,
        format: input.format,
        preorder: input.preorder,
        trackedShortCode: input.trackedShortCode || null,
        // ASIN-Änderung setzt die Validierung zurück (erneute Provider-Prüfung)
        ...(input.asin !== edition.asin
          ? { asinValidated: false, asinValidatedAt: null, asinValidationProvider: null }
          : {}),
      },
    });
    await writeAuditLog({
      actor: session.email,
      action: "amazon.edition_updated",
      entityType: "AmazonEdition",
      entityId: editionId,
      changes: { asin: input.asin, format: input.format, preorder: input.preorder },
    });
    return ok("Edition gespeichert.");
  } catch (error) {
    return errorState(error);
  }
}

// ---------------------------------------------------------------------------
// Manuelle Baseline (source=manual, Admin-Zeitstempel)
// ---------------------------------------------------------------------------

export async function importBaselineAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const editionId = z.string().min(1).parse(formData.get("editionId"));
    const timestampRaw = String(formData.get("timestamp") ?? "");
    const observedAt = new Date(timestampRaw);
    if (Number.isNaN(observedAt.getTime())) {
      return fail("Zeitstempel ist ungültig (Format: JJJJ-MM-TTTHH:MM).");
    }
    if (observedAt > new Date()) {
      return fail("Zeitstempel darf nicht in der Zukunft liegen.");
    }
    const lines = String(formData.get("entries") ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const entries: Array<{ categoryName: string; rank: number }> = [];
    for (const line of lines) {
      const match = line.match(/^(.+?)\s*[=:]\s*([\d.]+)$/);
      if (!match) return fail(`Zeile nicht lesbar: "${line}" (Format: Kategorie = Rang).`);
      const rank = Number.parseInt(match[2]!.replace(/\./g, ""), 10);
      if (!Number.isInteger(rank) || rank <= 0) {
        return fail(`Ungültiger Rang in Zeile: "${line}" (positive Ganzzahl, nie 0).`);
      }
      entries.push({ categoryName: match[1]!.trim(), rank });
    }
    if (entries.length === 0) return fail("Keine Einträge angegeben.");

    const result = await importManualBaseline({ editionId, observedAt, entries });
    await writeAuditLog({
      actor: session.email,
      action: "amazon.baseline_imported",
      entityType: "AmazonEdition",
      entityId: editionId,
      changes: { observedAt: observedAt.toISOString(), imported: result.imported },
    });
    return ok(`${result.imported} Baseline-Werte importiert (Quelle: manuell).`);
  } catch (error) {
    return errorState(error);
  }
}

// ---------------------------------------------------------------------------
// Annotationen
// ---------------------------------------------------------------------------

export async function createAnnotationAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const title = z.string().trim().min(1, "Titel angeben.").max(200).parse(formData.get("title"));
    const timestampRaw = String(formData.get("timestamp") ?? "");
    const timestamp = timestampRaw ? new Date(timestampRaw) : new Date();
    if (Number.isNaN(timestamp.getTime())) return fail("Zeitstempel ist ungültig.");
    const type = ["campaign", "press", "price", "other"].includes(String(formData.get("type")))
      ? String(formData.get("type"))
      : "campaign";

    await prisma.amazonAnnotation.create({
      data: {
        timestamp,
        title,
        description: String(formData.get("description") ?? "").trim().slice(0, 1000) || null,
        type,
        campaign: String(formData.get("campaign") ?? "").trim().slice(0, 200) || null,
        createdBy: session.email,
      },
    });
    return ok(`Annotation „${title}“ angelegt.`);
  } catch (error) {
    return errorState(error);
  }
}

// ---------------------------------------------------------------------------
// Alert-Regeln
// ---------------------------------------------------------------------------

const alertRuleSchema = z.object({
  name: z.string().trim().min(1, "Name angeben.").max(200),
  metric: z.enum(["rank_below", "movement_positions", "movement_percent"]),
  operator: z.enum(["lt", "lte", "gt", "gte", "eq"]),
  threshold: z.coerce.number().finite(),
  categoryId: z.string().trim(),
  channels: z.string().trim(),
  cooldownMinutes: z.coerce.number().int().min(5).max(10_080),
});

export async function createAlertRuleAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const parsed = alertRuleSchema.safeParse({
      name: formData.get("name"),
      metric: formData.get("metric"),
      operator: formData.get("operator"),
      threshold: formData.get("threshold"),
      categoryId: formData.get("categoryId") ?? "",
      channels: formData.get("channels") || "inapp",
      cooldownMinutes: formData.get("cooldownMinutes") || 360,
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
    const input = parsed.data;
    const channels = input.channels
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c === "inapp" || c === "email")
      .join(",");

    const rule = await prisma.amazonAlertRule.create({
      data: {
        name: input.name,
        targetType: input.categoryId ? "category" : "edition",
        categoryId: input.categoryId || null,
        metric: input.metric,
        operator: input.operator,
        threshold: input.threshold,
        channels: channels || "inapp",
        cooldownMinutes: input.cooldownMinutes,
      },
    });
    await writeAuditLog({
      actor: session.email,
      action: "amazon.alert_rule_created",
      entityType: "AmazonAlertRule",
      entityId: rule.id,
      changes: { name: input.name, metric: input.metric, threshold: input.threshold },
    });
    return ok(`Alert-Regel „${input.name}“ angelegt.`);
  } catch (error) {
    return errorState(error);
  }
}

export async function toggleAlertRuleAction(formData: FormData): Promise<void> {
  const session = await requireRoleOrThrow("ADMIN");
  const id = z.string().min(1).parse(formData.get("ruleId"));
  const rule = await prisma.amazonAlertRule.findUniqueOrThrow({ where: { id } });
  await prisma.amazonAlertRule.update({ where: { id }, data: { enabled: !rule.enabled } });
  await writeAuditLog({
    actor: session.email,
    action: "amazon.alert_rule_toggled",
    entityType: "AmazonAlertRule",
    entityId: id,
    changes: { enabled: !rule.enabled },
  });
  revalidatePath("/admin/amazon/einstellungen");
}

export async function deleteAlertRuleAction(formData: FormData): Promise<void> {
  const session = await requireRoleOrThrow("ADMIN");
  const id = z.string().min(1).parse(formData.get("ruleId"));
  await prisma.amazonAlertRule.delete({ where: { id } });
  await writeAuditLog({
    actor: session.email,
    action: "amazon.alert_rule_deleted",
    entityType: "AmazonAlertRule",
    entityId: id,
  });
  revalidatePath("/admin/amazon/einstellungen");
}

// ---------------------------------------------------------------------------
// Echte Verkaufszahlen importieren (strikt getrennt von Schätzungen)
// ---------------------------------------------------------------------------

export async function importActualSalesAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const editionId = z.string().min(1).parse(formData.get("editionId"));
    const periodStart = new Date(String(formData.get("periodStart") ?? ""));
    const periodEnd = new Date(String(formData.get("periodEnd") ?? ""));
    const units = Number.parseInt(String(formData.get("units") ?? ""), 10);
    const source = String(formData.get("source") ?? "").trim().slice(0, 200);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return fail("Zeitraum ist ungültig.");
    }
    if (periodEnd < periodStart) return fail("Zeitraum-Ende liegt vor dem Beginn.");
    if (!Number.isInteger(units) || units < 0) return fail("Stückzahl muss eine Ganzzahl ≥ 0 sein.");
    if (!source) return fail("Quelle angeben (z. B. Verlagsabrechnung).");

    await prisma.amazonActualSalesImport.create({
      data: { editionId, periodStart, periodEnd, units, source, importedBy: session.email },
    });
    await writeAuditLog({
      actor: session.email,
      action: "amazon.actual_sales_imported",
      entityType: "AmazonEdition",
      entityId: editionId,
      changes: { units, source },
    });
    return ok(`${units} verkaufte Exemplare importiert (Quelle: ${source}).`);
  } catch (error) {
    return errorState(error);
  }
}
