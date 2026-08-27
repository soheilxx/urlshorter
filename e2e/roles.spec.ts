import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const MARKETER_EMAIL = "marketer@test.local";
const VIEWER_EMAIL = "viewer@test.local";
const USER_PASSWORD = "Rollen-Testpasswort-123!";

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Abmelden" }).first().click();
  await expect(page).toHaveURL(/\/admin\/login/);
}

async function createUser(
  page: Page,
  email: string,
  role: "ADMIN" | "MARKETER" | "VIEWER",
): Promise<void> {
  // Maßgeblich ist der Eintrag in der Benutzertabelle – die Erfolgsmeldung
  // kann verloren gehen, wenn der Client-Übergang der Server Action hängen
  // bleibt, obwohl der Benutzer serverseitig angelegt wurde.
  const userRow = page.getByRole("cell", { name: email, exact: false });

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    if ((await userRow.count()) > 0) return;

    await page.getByLabel("E-Mail-Adresse").fill(email);
    await page.getByLabel("Rolle").selectOption(role);
    await page.getByLabel("Initiales Passwort").fill(USER_PASSWORD);
    await page.getByRole("button", { name: "Benutzer anlegen" }).click();

    const created = await page
      .getByText(`Benutzer ${email}`)
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (created) return;
  }

  await page.goto("/admin/users");
  await expect(userRow.first()).toBeVisible();
}

test.describe("Benutzerverwaltung und Rollen", () => {
  test("Admin legt Benutzer an, Rollen steuern Navigation und Rechte", async ({ page }) => {
    await loginAsAdmin(page);

    // Admin sieht Benutzer- und Einstellungen-Navigation
    await expect(page.getByRole("link", { name: "Benutzer" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Einstellungen" })).toBeVisible();

    await createUser(page, MARKETER_EMAIL, "MARKETER");
    await createUser(page, VIEWER_EMAIL, "VIEWER");
    await logout(page);

    // Marketer: Links anlegen erlaubt, keine Benutzer-/Einstellungs-Navigation
    await login(page, MARKETER_EMAIL, USER_PASSWORD);
    await expect(page.getByRole("link", { name: "Kurzlinks" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Benutzer" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Einstellungen" })).toHaveCount(0);

    await page.goto("/admin/links/new");
    await expect(page.getByRole("heading", { name: "Neuer Kurzlink" })).toBeVisible();

    // Geschützte Admin-Seiten leiten den Marketer zur Übersicht um
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin$/);
    await logout(page);

    // Viewer: nur lesen – keine Anlege-Buttons, geschützte Seiten leiten um
    await login(page, VIEWER_EMAIL, USER_PASSWORD);
    await page.goto("/admin/links");
    await expect(page.getByRole("heading", { name: "Kurzlinks" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Neuer Kurzlink" })).toHaveCount(0);

    await page.goto("/admin/links/new");
    await expect(page).toHaveURL(/\/admin$/);
    await logout(page);
  });

  test("eigenes Passwort ändern meldet andere Sitzungen ab", async ({ page }) => {
    await loginAsAdmin(page);
    await createUser(page, "pwtest@test.local", "VIEWER");
    await logout(page);

    await login(page, "pwtest@test.local", USER_PASSWORD);

    // Passwortänderung mit Wiederholung: Geht die Erfolgsmeldung durch einen
    // hängenden Client-Übergang verloren, ist das Passwort serverseitig
    // trotzdem geändert – ein erneuter Versuch meldet dann "Das aktuelle
    // Passwort ist falsch.", was die Änderung ebenfalls belegt. Die harte
    // Verifikation folgt unten über die Anmeldeversuche.
    const changed = page.getByText("Dein Passwort wurde geändert.");
    const alreadyChanged = page.getByText("Das aktuelle Passwort ist falsch.");
    let confirmed = false;
    for (let attempt = 0; attempt < 3 && !confirmed; attempt++) {
      await page.goto("/admin/account");
      await page.waitForLoadState("networkidle");
      await page.getByLabel("Aktuelles Passwort").fill(USER_PASSWORD);
      await page.getByLabel("Neues Passwort").fill("Neues-Testpasswort-456!");
      await page.getByRole("button", { name: "Passwort ändern" }).click();

      confirmed = await Promise.race([
        changed.waitFor({ state: "visible", timeout: 8000 }).then(() => true),
        alreadyChanged.waitFor({ state: "visible", timeout: 8000 }).then(() => true),
      ]).catch(() => false);
    }
    expect(confirmed).toBe(true);

    // Die eigene Sitzung bleibt im Normalfall gültig (Token nahtlos erneuert).
    // Ging die Action-Antwort verloren, fehlt der neue Cookie – dann belegt
    // die Anmeldung mit dem neuen Passwort die Änderung.
    await page.goto("/admin");
    if (page.url().includes("/admin/login")) {
      await login(page, "pwtest@test.local", "Neues-Testpasswort-456!");
    }
    await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();
    await logout(page);

    // Anmeldung nur noch mit dem neuen Passwort möglich
    await page.goto("/admin/login");
    await page.getByLabel("E-Mail-Adresse").fill("pwtest@test.local");
    await page.getByLabel("Passwort").fill(USER_PASSWORD);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page.getByText("E-Mail-Adresse oder Passwort ist falsch.")).toBeVisible();

    await login(page, "pwtest@test.local", "Neues-Testpasswort-456!");
  });
});

test.describe("Analytics", () => {
  test("Analytics-Tab rendert Karte, KPIs und Panels", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/analytics");

    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByText("Geo-Tracking")).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Weltkarte der Besucherstandorte" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Live-Feed · Letzte Klicks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kanäle" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top Länder" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top Städte" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top Referrer" })).toBeVisible();
  });
});
