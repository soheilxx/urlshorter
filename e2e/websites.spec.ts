import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loginAsAdmin } from "./helpers";

/**
 * E2E: TRACK.SITE Site-Verwaltung im Dashboard.
 * Admin legt eine Website mit eigenen Pixel-IDs + CAPI-Token an,
 * t.js?site liefert genau diese Konfiguration, der Token wird nur
 * maskiert angezeigt, Löschen deaktiviert das Snippet.
 */

const SITE_ID = "e2e-kunde";

test.beforeEach(async () => {
  const prisma = new PrismaClient();
  try {
    await prisma.tagSiteConfig.deleteMany({ where: { id: SITE_ID } });
  } finally {
    await prisma.$disconnect();
  }
});

test("Admin verwaltet Website mit Pixel-IDs und Token im Dashboard", async ({
  page,
  request,
}) => {
  await loginAsAdmin(page);

  // Anlegen
  await page.goto("/admin/websites/neu");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Site-ID (Teil des Snippets)").fill(SITE_ID);
  await page.getByLabel("Name").fill("E2E Kunden-Website");
  await page
    .getByLabel("Domains (komma-separiert, inkl. Subdomains automatisch)")
    .fill("kunde-beispiel.de");
  await page.getByLabel("GA4 Measurement-ID").fill("G-E2ETEST99");
  await page.getByLabel("Meta Pixel-ID").fill("111222333444555");
  await page.getByLabel("Meta CAPI Access-Token").fill("EAAe2eGeheimesToken1234");
  await page.getByRole("button", { name: "Website anlegen" }).click();

  // Outcome statt nur Erfolgsmeldung: Site existiert wirklich
  await expect(page.getByText("wurde angelegt")).toBeVisible({ timeout: 10_000 });
  await page.goto("/admin/websites");
  const row = page.locator("tr", { hasText: SITE_ID });
  await expect(row.getByText("E2E Kunden-Website")).toBeVisible();
  await expect(row.getByText("aktiv")).toBeVisible();

  // t.js?site liefert die Site-eigenen IDs, nicht die globalen
  const js = await (await request.get(`/t.js?site=${SITE_ID}`)).text();
  expect(js).toContain("G-E2ETEST99");
  expect(js).toContain("111222333444555");
  expect(js).toContain("kunde-beispiel.de");

  // Bearbeiten-Seite: Token nur maskiert (letzte 4 Zeichen), nie im Klartext
  await page.goto(`/admin/websites/${SITE_ID}`);
  await page.waitForLoadState("networkidle");
  const tokenField = page.getByLabel("Meta CAPI Access-Token");
  await expect(tokenField).toHaveAttribute("placeholder", /••••1234/);
  await expect(tokenField).toHaveValue("");
  const pageContent = await page.content();
  expect(pageContent).not.toContain("EAAe2eGeheimesToken1234");

  // Löschen (mit Bestätigungsdialog) → Snippet wird deaktiviert.
  // Retry-Muster wie in flow.spec: Klicks vor Abschluss der Hydration
  // können verloren gehen, daher bei Bedarf erneut klicken.
  page.on("dialog", (dialog) => dialog.accept());
  await expect(async () => {
    const deleteButton = page.getByRole("button", { name: "Website löschen" });
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
    }
    await expect(page).toHaveURL(/\/admin\/websites$/, { timeout: 3000 });
  }).toPass({ timeout: 25_000 });
  const jsAfterDelete = await (await request.get(`/t.js?site=${SITE_ID}`)).text();
  expect(jsAfterDelete).toContain("unbekannte oder deaktivierte Site");
});
