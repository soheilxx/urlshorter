import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { loginAsAdmin } from "./helpers";

/**
 * E2E: Gutscheinaktion – Admin importiert Codes, Leser holt seinen Code auf
 * /gutschein ab (Bestätigungsfenster, Kopierhinweis), Dashboard zählt mit.
 * Externe Embeds werden gestubbt.
 */

const ORDER_NUMBER = `306-${Date.now().toString().slice(-7)}-5550001`;
const CODES = ["E2EA1111", "E2EB2222", "E2EC3333"];

async function stubEmbeds(page: Page): Promise<void> {
  const stub = { status: 200, contentType: "text/html", body: "<html></html>" };
  await page.route("**/*youtube-nocookie.com/**", (route) => route.fulfill(stub));
  await page.route("**/*open.spotify.com/**", (route) => route.fulfill(stub));
}

test.beforeAll(async () => {
  const prisma = new PrismaClient();
  try {
    await prisma.voucherRedemption.deleteMany();
    await prisma.voucherCode.deleteMany();
  } finally {
    await prisma.$disconnect();
  }
});

test.describe.serial("Gutscheinaktion", () => {
  test("ohne Codes zeigt die Landingpage „vergeben“", async ({ page }) => {
    await stubEmbeds(page);
    await page.goto("/gutschein");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Die Lizenz");
    await expect(page.getByText("Alle Gutscheine sind vergeben.")).toBeVisible();
    // Gewinnspiel-Verweis vorhanden
    await expect(page.getByRole("link", { name: "Zum Gewinnspiel" })).toBeVisible();
  });

  test("Admin importiert Codes per Einfügen", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/gutscheine");
    await expect(page.getByRole("heading", { name: "Gutscheine", exact: true })).toBeVisible();
    await page.getByLabel("… oder Codes einfügen").fill(
      `id;customerId;code;cashed\n1;;${CODES[0]};0\n2;;${CODES[1]};0\n3;;${CODES[2]};0`,
    );
    await page.getByRole("button", { name: "Codes importieren" }).click();
    await expect(page.getByText("3 Codes importiert")).toBeVisible({ timeout: 10_000 });
  });

  test("Leser trägt Bestellung ein und erhält den Code im Bestätigungsfenster", async ({
    page,
  }) => {
    await stubEmbeds(page);
    await page.goto("/gutschein?utm_source=newsletter&utm_campaign=buch");
    await expect(page.getByText("Alle Gutscheine sind vergeben.")).toHaveCount(0);

    await page.getByLabel("Händler").selectOption("amazon");
    await page.getByLabel("Bestell- / Auftragsnummer").fill(ORDER_NUMBER);
    await page.getByLabel("Vorname").fill("Erika");
    await page.getByLabel("Nachname").fill("Musterfrau");
    await page.getByLabel("E-Mail-Adresse").fill("erika@test.local");
    await page.getByLabel(/Angaben korrekt sind/).check();
    await page.waitForTimeout(3200); // Mindestalter des Formular-Tokens
    await page.getByRole("button", { name: "Gutscheincode jetzt anzeigen" }).click();

    const dialog = page.getByRole("dialog", { name: /Gutschein/ });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByTestId("gutschein-code")).toHaveText(CODES[0]!);
    await expect(dialog.getByText("nicht per E-Mail")).toBeVisible();
    await dialog.getByRole("button", { name: "Ich habe den Code gespeichert" }).click();
    await expect(dialog).toHaveCount(0);
    // Code bleibt als Karte sichtbar
    await expect(page.getByTestId("gutschein-code-karte")).toHaveText(CODES[0]!);
  });

  test("gleiche Bestellung: Code erneut anzeigen, fremde E-Mail abgelehnt", async ({ page }) => {
    await stubEmbeds(page);
    await page.goto("/gutschein");
    await page.getByLabel("Händler").selectOption("amazon");
    await page.getByLabel("Bestell- / Auftragsnummer").fill(ORDER_NUMBER);
    await page.getByLabel("Vorname").fill("Erika");
    await page.getByLabel("Nachname").fill("Musterfrau");
    await page.getByLabel("E-Mail-Adresse").fill("erika@test.local");
    await page.getByLabel(/Angaben korrekt sind/).check();
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Gutscheincode jetzt anzeigen" }).click();
    await expect(page.getByTestId("gutschein-code").first()).toHaveText(CODES[0]!, {
      timeout: 15_000,
    });
    await expect(page.getByText("Hier ist dein Gutschein noch einmal")).toBeVisible();

    await page.goto("/gutschein");
    await page.getByLabel("Händler").selectOption("amazon");
    await page.getByLabel("Bestell- / Auftragsnummer").fill(ORDER_NUMBER);
    await page.getByLabel("Vorname").fill("Max");
    await page.getByLabel("Nachname").fill("Mustermann");
    await page.getByLabel("E-Mail-Adresse").fill("max@test.local");
    await page.getByLabel(/Angaben korrekt sind/).check();
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Gutscheincode jetzt anzeigen" }).click();
    await expect(
      page.getByText("Für diese Bestellnummer wurde bereits ein Gutschein ausgestellt").first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Dashboard zeigt Ausstellung, Bestand und Export", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/gutscheine");
    // Kennzahl „Ausgestellt“ (Kachel-Hinweis ist eindeutig; „Ausgestellt“ ist auch Tabellenkopf)
    await expect(page.getByText("= Eintragungen")).toBeVisible();
    // 1 ausgestellt, 2 verfügbar
    const row = page.locator("tbody tr").first();
    await expect(row.getByText(CODES[0]!)).toBeVisible();
    await expect(row.getByText("Erika Musterfrau")).toBeVisible();
    await expect(row.getByText("e***@test.local")).toBeVisible();

    const exportResponse = await page.request.get("/api/export/gutscheine");
    expect(exportResponse.status()).toBe(200);
    const csv = await exportResponse.text();
    expect(csv).toContain(CODES[0]!);
    expect(csv).toContain(ORDER_NUMBER);
  });

  test("Tracking: Seitenaufruf erreicht /api/book/events (204)", async ({ page }) => {
    await page.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
    );
    const responsePromise = page.waitForResponse((r) => r.url().endsWith("/api/book/events"));
    await page.goto("/gutschein");
    const response = await responsePromise;
    expect(response.status()).toBe(204);
    expect(JSON.parse(response.request().postData() ?? "{}")).toMatchObject({
      type: "PageView",
      path: "/gutschein",
    });
  });

  test("Viewer darf das Gutschein-Dashboard nicht sehen", async ({ page }) => {
    const prisma = new PrismaClient();
    const email = `viewer-${randomUUID().slice(0, 8)}@test.local`;
    try {
      await prisma.user.create({
        data: {
          email,
          name: "Viewer",
          role: "VIEWER",
          passwordHash: await bcrypt.hash("Viewer-Passwort-123!", 10),
        },
      });
    } finally {
      await prisma.$disconnect();
    }
    await page.goto("/admin/login");
    await page.getByLabel("E-Mail-Adresse").fill(email);
    await page.getByLabel("Passwort").fill("Viewer-Passwort-123!");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "Gutscheine" })).toHaveCount(0);
    await page.goto("/admin/gutscheine");
    await expect(page).not.toHaveURL(/\/admin\/gutscheine$/);
  });
});
