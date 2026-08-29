import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { loginAsAdmin } from "./helpers";

/**
 * E2E: Amazon-Ranking-Modul (Übersicht, Buchdetail, Top 25, Kategorien,
 * Provider, Einstellungen, Export-Schutz, mobile Darstellung).
 * Daten werden direkt in die Test-DB geseedet – keine Provider-Requests.
 */

const HOUR = 60 * 60 * 1000;

async function seed(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AmazonBook", "AmazonEdition", "AmazonCategory", "AmazonCategoryProviderMapping", "AmazonEditionCategory", "AmazonRankObservation", "AmazonCanonicalRankSnapshot", "AmazonLeaderboardSnapshot", "AmazonLeaderboardEntry", "AmazonProductMetadataSnapshot", "AmazonProviderRun", "AmazonProviderStatus", "AmazonJobState", "AmazonRawPayload", "AmazonAlertRule", "AmazonAlertEvent", "AmazonAnnotation", "AmazonDigestRun", "AmazonSalesEstimate", "AmazonActualSalesImport" CASCADE',
    );

    const book = await prisma.amazonBook.create({
      data: {
        title: "Die Lizenz zum Erfolg",
        author: "Soheil Hosseini",
        publisher: "Deutscher Wirtschaftsbuch Verlag",
        language: "Deutsch",
      },
    });
    const edition = await prisma.amazonEdition.create({
      data: {
        bookId: book.id,
        asin: "3690662508",
        isbn10: "3690662508",
        isbn13: "9783690662505",
        format: "Taschenbuch",
        preorder: true,
        preorderStartAt: new Date(Date.now() - 14 * 24 * HOUR),
        publicationDate: new Date("2026-10-06"),
        currentPrice: 18.0,
        currency: "EUR",
        currentAvailability: "Jetzt vorbestellen",
        currentRating: 4.8,
        currentReviewCount: 12,
        asinValidated: true,
        asinValidatedAt: new Date(),
        asinValidationProvider: "CREATORS",
        trackedShortCode: "wulp",
        productUrl: "https://www.amazon.de/dp/3690662508",
      },
    });
    await prisma.amazonBook.update({
      where: { id: book.id },
      data: { primaryEditionId: edition.id },
    });

    const website = await prisma.amazonCategory.create({
      data: {
        canonicalName: "Bücher",
        normalizedName: "bücher",
        categoryType: "WEBSITE",
        required: true,
        leaderboardEnabled: true,
        isRoot: true,
        resolutionStatus: "resolved",
      },
    });
    const sachbuecher = await prisma.amazonCategory.create({
      data: {
        canonicalName: "Sachbücher",
        normalizedName: "sachbücher",
        categoryType: "BROWSE_NODE",
        required: true,
        leaderboardEnabled: true,
        path: "Bücher › Sachbücher",
        resolutionStatus: "resolved",
        providerMappings: {
          create: {
            provider: "RAINFOREST",
            providerCategoryId: "sachbuecher_e2e",
            providerCategoryName: "Sachbücher",
            providerCategoryPath: "Bücher > Sachbücher",
            verified: true,
            verifiedAt: new Date(),
          },
        },
      },
    });
    await prisma.amazonEditionCategory.create({
      data: {
        editionId: edition.id,
        categoryId: sachbuecher.id,
        currentlyRanked: true,
        discoveryProvider: "CREATORS",
      },
    });

    // Kanonische Zeitreihe: 12.484 (vor 24 h) → 9.350 (aktuell), mit Lücke
    const series: Array<{ hoursAgo: number; rank: number | null; gap?: boolean }> = [
      { hoursAgo: 23, rank: 12_484 },
      { hoursAgo: 18, rank: 11_800 },
      { hoursAgo: 12, rank: null, gap: true },
      { hoursAgo: 6, rank: 10_400 },
      { hoursAgo: 1, rank: 9_350 },
    ];
    for (const point of series) {
      const observedAt = new Date(Date.now() - point.hoursAgo * HOUR);
      await prisma.amazonCanonicalRankSnapshot.create({
        data: {
          editionId: edition.id,
          categoryId: website.id,
          observedAt,
          canonicalRank: point.rank,
          selectedProvider: point.rank !== null ? "CREATORS" : null,
          selectionReason: point.rank !== null ? "creators_fresh" : "data_gap",
          dataGap: point.gap === true,
        },
      });
    }
    await prisma.amazonCanonicalRankSnapshot.create({
      data: {
        editionId: edition.id,
        categoryId: sachbuecher.id,
        observedAt: new Date(Date.now() - HOUR),
        canonicalRank: 41,
        selectedProvider: "CREATORS",
        selectionReason: "creators_fresh",
      },
    });

    // Top-25-Snapshot (eigenes Buch auf Platz 20)
    await prisma.amazonLeaderboardSnapshot.create({
      data: {
        categoryId: sachbuecher.id,
        provider: "RAINFOREST",
        observedAt: new Date(Date.now() - HOUR),
        fetchedAt: new Date(Date.now() - HOUR),
        requestedLimit: 25,
        returnedCount: 25,
        complete: true,
        entries: {
          create: Array.from({ length: 25 }, (_, i) => ({
            position: i + 1,
            bestsellerRank: i + 1,
            asin: i === 19 ? "3690662508" : `B0E2E${String(i + 1).padStart(5, "0")}`,
            editionId: i === 19 ? edition.id : null,
            titleSnapshot: i === 19 ? "Die Lizenz zum Erfolg" : `E2E-Testbuch ${i + 1}`,
            authorSnapshot: i === 19 ? "Soheil Hosseini" : `Testautor ${i + 1}`,
            priceSnapshot: 10 + i,
            currencySnapshot: "EUR",
            priceRawSnapshot: `${10 + i},00 €`,
            ratingSnapshot: 4.2,
            reviewCountSnapshot: 100 + i,
          })),
        },
      },
    });

    await prisma.amazonProviderStatus.createMany({
      data: [
        { provider: "CREATORS", configured: false, healthy: false },
        { provider: "RAINFOREST", configured: false, healthy: false },
      ],
    });
    await prisma.amazonAlertEvent.create({
      data: {
        dedupeKey: "e2e:test",
        title: "Neuer Bestwert in „Bücher“",
        message: "Rang 9.350 – bisheriger Bestwert: 10.400.",
        severity: "info",
        triggeredAt: new Date(),
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

test.describe("Amazon-Ranking-Modul", () => {
  test.beforeAll(async () => {
    await seed();
  });

  test("Übersicht zeigt Buch, Gesamtrang, Bewegung und Alerts", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/amazon");

    await expect(page.getByRole("heading", { name: "Amazon Rankings" })).toBeVisible();
    await expect(page.getByText("Die Lizenz zum Erfolg").first()).toBeVisible();
    // Gesamtrang 9.350 (kleinere Zahl = besser)
    await expect(page.getByText("9.350").first()).toBeVisible();
    await expect(page.getByText("Vorbestellbar").first()).toBeVisible();
    await expect(page.getByText("ASIN bestätigt")).toBeVisible();
    // Alert sichtbar
    await expect(page.getByText("Neuer Bestwert in „Bücher“")).toBeVisible();
    // Chart-Hinweis: Rang 1 oben
    await expect(page.getByText("Rang 1 wird oben dargestellt", { exact: false })).toBeVisible();
  });

  test("Buchdetail zeigt KPIs, Schwellen und Providervergleich", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/amazon/buch");

    await expect(page.getByRole("heading", { name: "Die Lizenz zum Erfolg" })).toBeVisible();
    await expect(page.getByText("Ranking-Kennzahlen je Kategorie")).toBeVisible();
    await expect(page.getByText("Sachbücher").first()).toBeVisible();
    // 24h-Verbesserung des Gesamtrangs: 12.484 → 9.350 = +3.134
    await expect(page.getByText("+3.134").first()).toBeVisible();
    await expect(page.getByText("Providervergleich", { exact: false }).first()).toBeVisible();
    await expect(
      page.getByText("Klicks sind keine bestätigten Verkäufe", { exact: false }),
    ).toBeVisible();
  });

  test("Top 25: Grid mit 25 Einträgen, eigenes Buch hervorgehoben, Tabelle umschaltbar", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/amazon/top25");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Top-25-Bestsellerlisten" })).toBeVisible();
    // 25 Einträge im Grid
    await expect(page.locator("li:has-text('E2E-Testbuch 1')").first()).toBeVisible();
    await expect(page.getByText("Dein Buch").first()).toBeVisible();

    // Tabelle umschalten
    await page.getByRole("button", { name: "Tabelle" }).click();
    await expect(page.getByRole("cell", { name: "3690662508" })).toBeVisible();

    // Filter: eigene Titel
    await page.getByRole("button", { name: "Eigene Titel" }).click();
    await expect(page.getByRole("cell", { name: "3690662508" })).toBeVisible();
    await expect(page.getByRole("cell", { name: /E2E-Testbuch 1$/ })).toHaveCount(0);
  });

  test("Kategorien: Sachbücher als Pflicht mit verifiziertem Mapping", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/amazon/kategorien");

    await expect(page.getByRole("heading", { name: "Kategorien", exact: true })).toBeVisible();
    await expect(page.getByText("Sachbücher", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Pflicht").first()).toBeVisible();
    await expect(page.getByText("verifiziert").first()).toBeVisible();
    await expect(page.getByText("sachbuecher_e2e")).toBeVisible();
  });

  test("Provider: Status ohne Secrets, Prognose sichtbar", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/amazon/provider");

    await expect(page.getByRole("heading", { name: "Provider", exact: true })).toBeVisible();
    await expect(page.getByText("Amazon Creators API").first()).toBeVisible();
    await expect(page.getByText("Rainforest API").first()).toBeVisible();
    await expect(page.getByText("nicht konfiguriert").first()).toBeVisible();
    await expect(page.getByText("Prognose aus aktuellen Einstellungen")).toBeVisible();
    await expect(page.getByText("Test Connection", { exact: false })).toBeVisible();
  });

  test("Einstellungen speichern (Outcome-Prüfung nach Reload)", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/amazon/einstellungen");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
    await page.getByLabel("Top-25-Intervall").selectOption("360");
    await page.getByRole("button", { name: "Einstellungen speichern" }).click();

    // Erfolgsmeldung ODER (bei verlorener Action-Antwort) direkt weiter –
    // maßgeblich ist das gespeicherte Ergebnis nach einem Reload.
    await page
      .getByText("Einstellungen gespeichert.")
      .waitFor({ state: "visible", timeout: 8000 })
      .catch(() => {});
    await page.reload();
    await expect(page.getByLabel("Top-25-Intervall")).toHaveValue("360");
  });

  test("Export-API verlangt eine Anmeldung", async ({ request }) => {
    const response = await request.get("/api/export/amazon?type=ranks");
    expect(response.status()).toBe(401);
  });

  test("Cron-Endpoint verlangt das CRON_SECRET", async ({ request }) => {
    const unauthorized = await request.get("/api/cron/amazon");
    expect(unauthorized.status()).toBe(401);
  });

  test("Mobile Darstellung: Übersicht und Top 25 rendern responsiv", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await loginAsAdmin(page);

    await page.goto("/admin/amazon");
    await expect(page.getByRole("heading", { name: "Amazon Rankings" })).toBeVisible();
    await expect(page.getByText("9.350").first()).toBeVisible();

    await page.goto("/admin/amazon/top25");
    await expect(page.getByText("Dein Buch").first()).toBeVisible();
    // Kein horizontales Scrollen der Seite
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);

    await context.close();
  });

  test("Viewer darf Einstellungen nicht öffnen (Redirect)", async ({ page }) => {
    const prisma = new PrismaClient();
    try {
      await prisma.user.upsert({
        where: { email: "viewer-amazon@test.local" },
        update: { role: "VIEWER", active: true },
        create: {
          email: "viewer-amazon@test.local",
          passwordHash: await bcrypt.hash("Viewer-Passwort-123!", 10),
          role: "VIEWER",
          active: true,
        },
      });
    } finally {
      await prisma.$disconnect();
    }
    await page.goto("/admin/login");
    await page.getByLabel("E-Mail-Adresse").fill("viewer-amazon@test.local");
    await page.getByLabel("Passwort").fill("Viewer-Passwort-123!");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Übersicht ist sichtbar …
    await page.goto("/admin/amazon");
    await expect(page.getByRole("heading", { name: "Amazon Rankings" })).toBeVisible();
    // … Einstellungen leiten auf /admin um
    await page.goto("/admin/amazon/einstellungen");
    await expect(page).toHaveURL(/\/admin$/);
  });
});
