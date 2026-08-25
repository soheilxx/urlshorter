import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, loginAsAdmin } from "./helpers";

test.describe("Authentifizierung", () => {
  test("die Startseite leitet zur Hauptseite weiter, /admin bleibt erreichbar", async ({
    request,
  }) => {
    const response = await request.get("/", { maxRedirects: 0 });
    expect(response.status()).toBeGreaterThanOrEqual(301);
    expect(response.status()).toBeLessThanOrEqual(308);
    expect(response.headers()["location"]).toBe("https://soheil-hosseini.de");
  });

  test("nicht angemeldete Besucher werden zur Login-Seite umgeleitet", async ({ page }) => {
    await page.goto("/admin/links");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
  });

  test("die Export-API verlangt eine Anmeldung", async ({ request }) => {
    const response = await request.get("/api/export/clicks");
    expect(response.status()).toBe(401);
  });

  test("Login mit falschem Passwort zeigt eine Fehlermeldung", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("E-Mail-Adresse").fill(ADMIN_EMAIL);
    await page.getByLabel("Passwort").fill("falsches-passwort-123");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page.getByText("E-Mail-Adresse oder Passwort ist falsch.")).toBeVisible();
  });

  test("Login und Abmeldung funktionieren", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();

    await page.getByRole("button", { name: "Abmelden" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login/);

    // Nach der Abmeldung ist der Admin-Bereich wieder geschützt
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
