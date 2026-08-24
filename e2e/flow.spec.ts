import { expect, test } from "@playwright/test";
import { loginAsAdmin, stubAmazon } from "./helpers";

const DESTINATION_URL = "https://www.amazon.de/dp/B0E2ETEST1";

test.describe.configure({ mode: "serial" });

/** Wird im Verlauf des Tests mit dem erzeugten Kurzcode befüllt. */
let shortCode = "";

test.describe("Kompletter Ablauf: Ziel → Link → Klick → Statistik", () => {
  test("Administrator legt eine Destination an", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/destinations");

    await page.getByLabel("Interne Bezeichnung").fill("Amazon Buchseite (E2E)");
    await page.getByLabel("Ziel-URL (HTTPS)").fill(DESTINATION_URL);
    await page.getByRole("button", { name: "Ziel anlegen" }).click();

    await expect(page.getByText('Ziel "Amazon Buchseite (E2E)" wurde angelegt.')).toBeVisible();
    await expect(page.getByRole("cell", { name: "Amazon Buchseite (E2E)" })).toBeVisible();
  });

  test("eine ungültige Ziel-URL wird abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/destinations");

    await page.getByLabel("Interne Bezeichnung").fill("Böses Ziel");
    await page.getByLabel("Ziel-URL (HTTPS)").fill("https://amazon.de.example.com/dp/B01");
    await page.getByRole("button", { name: "Ziel anlegen" }).click();

    await expect(page.getByText(/ist nicht erlaubt/)).toBeVisible();
  });

  test("Administrator erstellt einen Kurzlink", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/links/new");

    await page.getByLabel("Ziel (Destination)").selectOption({ index: 1 });
    await page.getByLabel("Interner Linkname").fill("Instagram Profil Bio");
    await page.getByLabel("Source").fill("Instagram Profil");
    await page.getByLabel("Kampagne (optional)").fill("Buchlaunch");
    await page.getByRole("button", { name: "Kurzlink erstellen" }).click();

    const success = page.getByText(/Kurzlink \/[a-z]{4} wurde erstellt\./);
    await expect(success).toBeVisible();
    const text = await success.textContent();
    shortCode = text?.match(/\/([a-z]{4})/)?.[1] ?? "";
    expect(shortCode).toMatch(/^[a-z]{4}$/);
  });

  test("der Kurzlink lässt sich in die Zwischenablage kopieren", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/links");

    await page.getByRole("button", { name: new RegExp(`/${shortCode} kopieren`) }).click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(`http://127.0.0.1:3100/${shortCode}`);
  });

  test("der Kurzlink zeigt die Bridge-Page und leitet zu Amazon weiter", async ({ browser }) => {
    // Eigener, nicht angemeldeter Kontext (echter Besucher)
    const context = await browser.newContext();
    const page = await context.newPage();
    await stubAmazon(page);

    await page.goto(`/${shortCode}?utm_source=instagram&utm_campaign=launch`);

    await expect(page.getByText("Du wirst zu Amazon weitergeleitet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Jetzt zu Amazon" })).toBeVisible();

    // Automatische Weiterleitung (window.location.replace) abwarten
    await page.waitForURL(/amazon\.de/, { timeout: 15_000 });
    expect(page.url()).toContain(DESTINATION_URL);

    await context.close();
  });

  test("der Klick erscheint im Dashboard und in der Klicktabelle", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto("/admin/clicks");
    const row = page
      .getByRole("row")
      .filter({ hasText: `/${shortCode}` })
      .first();
    await expect(row).toBeVisible();
    await expect(row.getByText("Instagram Profil", { exact: true })).toBeVisible();

    await page.goto("/admin?range=today");
    await expect(page.getByText("Menschliche Klicks")).toBeVisible();
  });

  test("Bot-Aufrufe erscheinen nicht in der Standardstatistik", async ({ page, request }) => {
    // Bot-Aufruf simulieren (Googlebot-UA); 302 wird erwartet
    const botResponse = await request.get(`/${shortCode}`, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
      maxRedirects: 0,
    });
    expect(botResponse.status()).toBe(302);
    expect(botResponse.headers()["location"]).toBe(DESTINATION_URL);

    await loginAsAdmin(page);

    // Standardfilter (nur Menschen): genau 1 Klick aus dem vorherigen Test
    await page.goto(`/admin/clicks?q=${shortCode}`);
    await expect(page.getByText("1 Einträge")).toBeVisible();

    // Bot-Filter: der Bot-Aufruf ist separat sichtbar
    await page.goto(`/admin/clicks?q=${shortCode}&bot=bot`);
    await expect(page.getByText("1 Einträge")).toBeVisible();
    await expect(page.getByText("Bot", { exact: true }).first()).toBeVisible();
  });

  test("ein deaktivierter Link zeigt die Fehlerseite", async ({ page, browser }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/links");
    await page.waitForLoadState("networkidle");

    const row = page
      .getByRole("row")
      .filter({ hasText: `/${shortCode}` })
      .first();
    // Zweistufige Bestätigung; mit Retry gegen Klicks vor Abschluss der Hydration.
    await expect(async () => {
      const deactivate = row.getByRole("button", { name: "Deaktivieren", exact: true });
      if (await deactivate.isVisible()) {
        await deactivate.click();
      }
      const confirm = row.getByRole("button", { name: "Wirklich deaktivieren?" });
      if (await confirm.isVisible()) {
        await confirm.click();
      }
      await expect(row.getByText("Inaktiv")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 25_000 });

    // Besucher-Sicht: Fehlerseite statt Weiterleitung
    const context = await browser.newContext();
    const visitorPage = await context.newPage();
    const response = await visitorPage.goto(`/${shortCode}`);
    expect(response?.status()).toBe(410);
    await expect(visitorPage.getByText("Link nicht mehr aktiv")).toBeVisible();
    await context.close();

    // Link wieder aktivieren (Reaktivierung funktioniert). Mit Retry, da ein
    // Klick vor Abschluss der React-Hydration verloren gehen kann.
    await page.goto("/admin/links");
    await page.waitForLoadState("networkidle");
    const rowAfter = page
      .getByRole("row")
      .filter({ hasText: `/${shortCode}` })
      .first();
    await expect(async () => {
      const activateButton = rowAfter.getByRole("button", { name: "Aktivieren" });
      if (await activateButton.isVisible()) {
        await activateButton.click();
      }
      await expect(rowAfter.getByText("Aktiv", { exact: true })).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 25_000 });
  });

  test("ein unbekannter Code zeigt die 404-Fehlerseite", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const response = await page.goto("/zzzz");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Link nicht gefunden")).toBeVisible();
    await context.close();
  });

  test("Sammel-Erstellung legt mehrere Links für dieselbe Destination an", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/links/bulk");

    await page.getByLabel("Ziel (Destination) für alle Links").selectOption({ index: 1 });
    await page.getByLabel("Namens-Präfix").fill("Buchlaunch");
    await page
      .getByLabel("Sources (eine pro Zeile, max. 50)")
      .fill("Meta Ad 01\nNewsletter\nPlakat Berlin");
    await page.getByRole("button", { name: "Alle Kurzlinks erstellen" }).click();

    await expect(page.getByText(/3 Kurzlinks wurden erstellt/)).toBeVisible();

    await page.goto("/admin/links");
    await expect(page.getByRole("cell", { name: "Buchlaunch – Newsletter" })).toBeVisible();
  });
});
