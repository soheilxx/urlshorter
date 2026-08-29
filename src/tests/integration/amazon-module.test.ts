import { beforeEach, describe, expect, it } from "vitest";
import { GET as cronAmazonGet } from "@/app/api/cron/amazon/route";
import { getAmazonSettings, updateAmazonSettings } from "@/lib/amazon/amazon-settings";
import { deliverAlert } from "@/lib/amazon/alerts";
import { runDailyDigest } from "@/lib/amazon/digest";
import { runAmazonJob } from "@/lib/amazon/jobs";
import { parseCreatorsGetItems } from "@/lib/amazon/providers/creators-parse";
import {
  parseRainforestBestsellers,
  parseRainforestProductRanks,
} from "@/lib/amazon/providers/rainforest-parse";
import {
  ensurePrimaryBook,
  importManualBaseline,
  recordProductRanks,
  saveLeaderboardSnapshot,
  upsertCanonicalSnapshot,
} from "@/lib/amazon/store";
import { prisma } from "@/lib/db";
import { clearSettingsCache } from "@/lib/settings";
import { CREATORS_GETITEMS_SUCCESS } from "@/tests/fixtures/amazon/creators-fixtures";
import {
  RAINFOREST_BESTSELLERS_SUCCESS,
  RAINFOREST_PRODUCT_SUCCESS,
} from "@/tests/fixtures/amazon/rainforest-fixtures";

/**
 * Integrationstests des Amazon-Ranking-Moduls gegen die echte Test-Datenbank.
 * Es werden KEINE echten Provider-Requests ausgeführt – ausschließlich
 * redigierte Fixtures (CI-sicher, keine Credits).
 */

const AMAZON_TABLES = [
  "AmazonActualSalesImport",
  "AmazonSalesEstimate",
  "AmazonDigestRun",
  "AmazonAnnotation",
  "AmazonAlertEvent",
  "AmazonAlertRule",
  "AmazonRawPayload",
  "AmazonJobState",
  "AmazonProviderStatus",
  "AmazonProviderRun",
  "AmazonProductMetadataSnapshot",
  "AmazonLeaderboardEntry",
  "AmazonLeaderboardSnapshot",
  "AmazonCanonicalRankSnapshot",
  "AmazonRankObservation",
  "AmazonEditionCategory",
  "AmazonCategoryProviderMapping",
  "AmazonCategory",
  "AmazonEdition",
  "AmazonBook",
];

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${AMAZON_TABLES.map((t) => `"${t}"`).join(", ")}, "AppSetting" CASCADE`,
  );
  clearSettingsCache();
});

const OBSERVED_AT = new Date("2026-08-29T10:00:00.000Z");

async function seedObservations(): Promise<{ editionId: string }> {
  const { editionId } = await ensurePrimaryBook();
  const edition = await prisma.amazonEdition.findUniqueOrThrow({ where: { id: editionId } });
  const creators = parseCreatorsGetItems(CREATORS_GETITEMS_SUCCESS).ranks[0]!;
  const rainforest = parseRainforestProductRanks(RAINFOREST_PRODUCT_SUCCESS)!;
  const ctx = {
    observedAt: OBSERVED_AT,
    fetchedAt: OBSERVED_AT,
    runId: null,
    sourceStatus: "LIVE" as const,
    autoFollow: true,
  };
  await recordProductRanks(edition, "CREATORS", creators, ctx);
  await recordProductRanks(edition, "RAINFOREST", rainforest, ctx);
  return { editionId };
}

describe("ensurePrimaryBook (Migrationen + Bootstrap)", () => {
  it("legt Buch, Edition und Pflichtkategorien idempotent an", async () => {
    const first = await ensurePrimaryBook();
    const second = await ensurePrimaryBook();
    expect(second.editionId).toBe(first.editionId);
    expect(await prisma.amazonBook.count()).toBe(1);
    expect(await prisma.amazonEdition.count()).toBe(1);

    const edition = await prisma.amazonEdition.findUniqueOrThrow({
      where: { id: first.editionId },
    });
    expect(edition.asin).toBe("3690662508");
    expect(edition.isbn13).toBe("9783690662505");
    expect(edition.preorder).toBe(true);
    expect(edition.trackedShortCode).toBe("wulp");

    const sachbuecher = await prisma.amazonCategory.findFirst({
      where: { normalizedName: "sachbücher" },
    });
    expect(sachbuecher?.required).toBe(true);
    expect(sachbuecher?.leaderboardEnabled).toBe(true);
    const website = await prisma.amazonCategory.findFirst({ where: { categoryType: "WEBSITE" } });
    expect(website).not.toBeNull();
  });
});

describe("Rangbeobachtungen + kanonische Snapshots", () => {
  it("speichert beide Provider getrennt und wählt Creators als kanonisch", async () => {
    const { editionId } = await seedObservations();

    // Beide Provider getrennt gespeichert
    const observations = await prisma.amazonRankObservation.findMany({
      where: { editionId },
      include: { category: true },
    });
    const creatorsWebsite = observations.find(
      (o) => o.provider === "CREATORS" && o.category.categoryType === "WEBSITE",
    );
    const rainforestWebsite = observations.find(
      (o) => o.provider === "RAINFOREST" && o.category.categoryType === "WEBSITE",
    );
    expect(creatorsWebsite?.rank).toBe(12_484);
    expect(rainforestWebsite?.rank).toBe(9_350);

    // Kanonische Auswahl (Creators zuerst) inkl. Abweichung
    const websiteCategory = creatorsWebsite!.categoryId;
    const canonical = await upsertCanonicalSnapshot(editionId, websiteCategory, OBSERVED_AT, {
      staleAfterMinutes: 180,
      providerPriority: "creators_first",
      now: new Date(OBSERVED_AT.getTime() + 60_000),
    });
    expect(canonical.canonicalRank).toBe(12_484);
    const snapshot = await prisma.amazonCanonicalRankSnapshot.findUniqueOrThrow({
      where: {
        editionId_categoryId_observedAt: {
          editionId,
          categoryId: websiteCategory,
          observedAt: OBSERVED_AT,
        },
      },
    });
    expect(snapshot.selectedProvider).toBe("CREATORS");
    expect(snapshot.selectionReason).toBe("creators_fresh");

    const updated = await prisma.amazonRankObservation.findMany({
      where: { editionId, categoryId: websiteCategory },
    });
    expect(updated.find((o) => o.provider === "CREATORS")?.canonical).toBe(true);
    expect(updated.find((o) => o.provider === "RAINFOREST")?.canonical).toBe(false);
    expect(updated[0]?.providerDifference).toBe(12_484 - 9_350);
    expect(updated[0]?.discrepancyFlag).toBe(true);
  });

  it("ist idempotent (doppelte Verarbeitung erzeugt keine Duplikate)", async () => {
    await seedObservations();
    const countBefore = await prisma.amazonRankObservation.count();
    await seedObservations();
    expect(await prisma.amazonRankObservation.count()).toBe(countBefore);
  });

  it("erkennt neue Kategorien automatisch (Auto-Follow) und verbindet Provider-IDs", async () => {
    const { editionId } = await seedObservations();
    // Präsentationen: von Creators (Browse Node 686022031) entdeckt,
    // Rainforest liefert dieselbe Kategorie über den Bestseller-Link
    const category = await prisma.amazonCategory.findFirst({
      where: { normalizedName: "präsentationen" },
      include: { providerMappings: true },
    });
    expect(category).not.toBeNull();
    const providers = category!.providerMappings.map((m) => m.provider).sort();
    expect(providers).toEqual(["CREATORS", "RAINFOREST"]);
    const link = await prisma.amazonEditionCategory.findFirst({
      where: { editionId, categoryId: category!.id },
    });
    expect(link?.currentlyRanked).toBe(true);
  });

  it("nutzt den letzten kanonischen Wert als stale, wenn keine frische Messung existiert", async () => {
    const { editionId } = await seedObservations();
    const websiteCategory = (await prisma.amazonCategory.findFirstOrThrow({
      where: { categoryType: "WEBSITE" },
    })).id;
    await upsertCanonicalSnapshot(editionId, websiteCategory, OBSERVED_AT, {
      staleAfterMinutes: 180,
      providerPriority: "creators_first",
      now: new Date(OBSERVED_AT.getTime() + 60_000),
    });

    // Nächster Messzeitpunkt ohne neue Beobachtungen → stale_last_value
    const later = new Date(OBSERVED_AT.getTime() + 6 * 60 * 60 * 1000);
    const stale = await upsertCanonicalSnapshot(editionId, websiteCategory, later, {
      staleAfterMinutes: 180,
      providerPriority: "creators_first",
      now: later,
    });
    expect(stale.canonicalRank).toBe(12_484);
    expect(stale.stale).toBe(true);

    const snapshot = await prisma.amazonCanonicalRankSnapshot.findUniqueOrThrow({
      where: {
        editionId_categoryId_observedAt: {
          editionId,
          categoryId: websiteCategory,
          observedAt: later,
        },
      },
    });
    expect(snapshot.selectionReason).toBe("stale_last_value");
  });
});

describe("Leaderboard-Snapshots", () => {
  it("speichert Top 25 in Originalreihenfolge und markiert das eigene Buch", async () => {
    await ensurePrimaryBook();
    const category = await prisma.amazonCategory.findFirstOrThrow({
      where: { normalizedName: "sachbücher" },
    });
    const leaderboard = parseRainforestBestsellers(RAINFOREST_BESTSELLERS_SUCCESS)!;
    const snapshotId = await saveLeaderboardSnapshot(category, leaderboard, {
      runId: null,
      observedAt: OBSERVED_AT,
      fetchedAt: OBSERVED_AT,
      requestedLimit: 25,
    });
    const entries = await prisma.amazonLeaderboardEntry.findMany({
      where: { snapshotId },
      orderBy: { position: "asc" },
    });
    expect(entries).toHaveLength(25);
    expect(entries[19]!.asin).toBe("3690662508");
    expect(entries[19]!.editionId).not.toBeNull(); // eigenes Buch verknüpft
    expect(entries[0]!.titleSnapshot).toBe("Testbuch Nummer 1");
  });
});

describe("Scheduler-Locks + manueller Refresh", () => {
  it("überspringt einen Job, dessen Lock aktiv ist", async () => {
    await prisma.amazonJobState.create({
      data: {
        jobType: "cleanup-provider-payloads",
        lockedUntil: new Date(Date.now() + 5 * 60 * 1000),
        lockOwner: "anderer-prozess",
      },
    });
    const result = await runAmazonJob("cleanup-provider-payloads", { force: true });
    expect(result.status).toBe("LOCKED");
  });

  it("Rate-Limit: manueller Refresh höchstens alle 2 Minuten", async () => {
    await prisma.amazonProviderRun.create({
      data: {
        jobType: "refresh-provider-health",
        correlationId: "manual:test",
        startedAt: new Date(),
        status: "SUCCESS",
      },
    });
    const result = await runAmazonJob("refresh-provider-health", { force: true });
    expect(result.status).toBe("LOCKED");
    expect(result.detail).toContain("Rate-Limit");
  });

  it("nicht fällige Jobs werden übersprungen, deaktiviertes Modul blockiert Provider-Jobs", async () => {
    await updateAmazonSettings({ enabled: false });
    clearSettingsCache();
    const disabled = await runAmazonJob("refresh-primary-book-ranks");
    expect(disabled.status).toBe("DISABLED");

    await prisma.amazonJobState.create({
      data: {
        jobType: "cleanup-provider-payloads",
        nextRunAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const notDue = await runAmazonJob("cleanup-provider-payloads");
    expect(notDue.status).toBe("NOT_DUE");
  });

  it("Cleanup-Job läuft und setzt den Scheduler-Zustand", async () => {
    const result = await runAmazonJob("cleanup-provider-payloads", { force: true });
    expect(result.status).toBe("SUCCESS");
    const state = await prisma.amazonJobState.findUniqueOrThrow({
      where: { jobType: "cleanup-provider-payloads" },
    });
    expect(state.lockedUntil).toBeNull();
    expect(state.nextRunAt).not.toBeNull();
    expect(state.lastStatus).toBe("SUCCESS");
  });
});

describe("Einstellungen", () => {
  it("Roundtrip über AppSetting inkl. Intervall-Clamping", async () => {
    await updateAmazonSettings({
      enabled: true,
      rankIntervalMinutes: 5, // unter Minimum → 15
      leaderboardIntervalMinutes: 360,
      providerPriority: "rainforest_first",
      dailyCreditBudget: 100,
      digestTime: "09:30",
    });
    clearSettingsCache();
    const settings = await getAmazonSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.rankIntervalMinutes).toBe(15);
    expect(settings.leaderboardIntervalMinutes).toBe(360);
    expect(settings.providerPriority).toBe("rainforest_first");
    expect(settings.dailyCreditBudget).toBe(100);
    expect(settings.digestTime).toBe("09:30");
  });
});

describe("Alerts (Deduplizierung + Cooldown)", () => {
  it("liefert denselben Alert innerhalb des Cooldowns nur einmal aus", async () => {
    const first = await deliverAlert({
      dedupeKey: "test:alert",
      title: "Testalert",
      message: "Nachricht",
      severity: "info",
      cooldownMinutes: 60,
    });
    const second = await deliverAlert({
      dedupeKey: "test:alert",
      title: "Testalert",
      message: "Nachricht",
      severity: "info",
      cooldownMinutes: 60,
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await prisma.amazonAlertEvent.count()).toBe(1);
  });
});

describe("Täglicher Digest", () => {
  it("läuft höchstens einmal pro Kalendertag und Empfänger", async () => {
    const { editionId } = await seedObservations();
    const now = new Date("2026-08-29T07:00:00.000Z"); // 09:00 Berlin (Sommerzeit)
    const first = await runDailyDigest({
      editionId,
      timezone: "Europe/Berlin",
      digestTime: "08:00",
      recipient: "dashboard",
      now,
    });
    expect(first.status).toBe("sent");
    const second = await runDailyDigest({
      editionId,
      timezone: "Europe/Berlin",
      digestTime: "08:00",
      recipient: "dashboard",
      now: new Date(now.getTime() + 60 * 60 * 1000),
    });
    expect(second.status).toBe("skipped_already_sent");
    expect(await prisma.amazonDigestRun.count()).toBe(1);
  });

  it("läuft nicht vor der konfigurierten Uhrzeit", async () => {
    const { editionId } = await seedObservations();
    const result = await runDailyDigest({
      editionId,
      timezone: "Europe/Berlin",
      digestTime: "08:00",
      recipient: "dashboard",
      now: new Date("2026-08-29T05:00:00.000Z"), // 07:00 Berlin
    });
    expect(result.status).toBe("skipped_not_due");
    expect(await prisma.amazonDigestRun.count()).toBe(0);
  });
});

describe("Manuelle Baseline", () => {
  it("importiert Stände als MANUAL-Quelle mit Admin-Zeitstempel", async () => {
    const { editionId } = await ensurePrimaryBook();
    const observedAt = new Date("2026-08-20T18:00:00.000Z");
    const result = await importManualBaseline({
      editionId,
      observedAt,
      entries: [
        { categoryName: "Bücher", rank: 12_484 },
        { categoryName: "Präsentationen", rank: 16 },
        { categoryName: "E-Business (Bücher)", rank: 33 },
        { categoryName: "Biografien von Geschäftsleuten", rank: 42 },
        { categoryName: "Ungültig", rank: 0 }, // niemals Rang 0 → übersprungen
      ],
    });
    expect(result.imported).toBe(4);
    const observations = await prisma.amazonRankObservation.findMany({
      where: { editionId, provider: "MANUAL" },
    });
    expect(observations).toHaveLength(4);
    expect(observations.every((o) => o.sourceStatus === "MANUAL")).toBe(true);
    expect(observations.every((o) => o.observedAt.getTime() === observedAt.getTime())).toBe(true);
    const canonical = await prisma.amazonCanonicalRankSnapshot.findMany({
      where: { editionId, selectionReason: "manual_baseline" },
    });
    expect(canonical).toHaveLength(4);
  });
});

describe("Geschützte Endpoints", () => {
  // Hinweis: Der Login-Schutz von /api/export/amazon wird im E2E-Test gegen
  // den echten Server geprüft (cookies() ist außerhalb eines Requests nicht
  // verfügbar).
  it("Cron-Tick verlangt das CRON_SECRET und liefert Ergebnisse", async () => {
    const unauthorized = await cronAmazonGet(
      new Request("http://127.0.0.1:3100/api/cron/amazon"),
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await cronAmazonGet(
      new Request("http://127.0.0.1:3100/api/cron/amazon", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(authorized.status).toBe(200);
    const body = (await authorized.json()) as { ok: boolean; results: Array<{ jobType: string }> };
    expect(body.ok).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
  });

  it("Cron-Summary liefert den Modulstatus ohne Secrets", async () => {
    await seedObservations();
    const response = await cronAmazonGet(
      new Request("http://127.0.0.1:3100/api/cron/amazon?summary=1", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("3690662508");
    expect(text.toLowerCase()).not.toContain("api_key");
    expect(text).not.toContain(process.env.CRON_SECRET as string);
  });
});
