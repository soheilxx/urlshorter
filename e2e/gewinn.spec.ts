import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * E2E: Gewinnspiel-Landingpage /gewinn + Admin-Verwaltung.
 * Die Regression der Kurzlink-/Redirect-Funktionalität deckt flow.spec.ts ab.
 */

const ORDER_NUMBER = `306-${Date.now().toString().slice(-7)}-7654321`;

test.describe("Gewinnspiel-Landingpage", () => {
  test("rendert Hero, Gewinn, Amazon-Button und rechtliche Links", async ({ page }) => {
    await page.goto("/gewinn");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Dein Buchkauf könnte dich",
    );
    await expect(page.getByText("Gewinnerbekanntgabe am 06.10.2026").first()).toBeVisible();
    await expect(page.getByText("20.000 €").first()).toBeVisible();
    await expect(
      page.getByRole("img", { name: /Buchcover: Die Lizenz zum Erfolg/ }),
    ).toBeVisible();

    const amazonLink = page.getByRole("link", { name: /Bei Amazon bestellen/ });
    await expect(amazonLink).toHaveAttribute("href", "https://link.amazon/B0eyhvaQw");
    await expect(
      page.getByRole("img", { name: /Soheil Hosseini, Autor/ }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Teilnahmebedingungen" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Danke für deine Unterstützung." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Häufige Fragen" })).toBeVisible();
  });

  test("Teilnahme: Formular ausfüllen, Erfolg mit Referenz, Duplikat abgelehnt", async ({
    page,
  }) => {
    await page.goto("/gewinn");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Händler").selectOption("amazon");
    await page.getByLabel("Bestell- / Auftragsnummer").fill(ORDER_NUMBER);
    await page.getByLabel("Vorname").fill("Erika");
    await page.getByLabel("Nachname").fill("Musterfrau");
    await page.getByLabel("Straße").fill("Musterstraße");
    await page.getByLabel("Hausnummer").fill("12a");
    await page.getByLabel("Postleitzahl").fill("10115");
    await page.getByLabel("Ort").fill("Berlin");
    await page.getByLabel("E-Mail-Adresse").fill("erika@test.local");
    await page.getByLabel("Telefonnummer (mit Ländervorwahl)").fill("+49 151 1234567");
    await page.getByLabel(/Angaben vollständig und korrekt/).check();

    // Mindestalter des Formular-Tokens abwarten (Bot-Schutz)
    await page.waitForTimeout(3200);
    await page
      .getByRole("button", { name: "Verbindlich am Gewinnspiel teilnehmen" })
      .click();

    const success = page.getByText("Deine Teilnahme wurde erfolgreich registriert.");
    await expect(success).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("teilnahme-referenz")).toHaveText(/^[2-9A-HJKMNP-Z]{8}$/);
    await expect(
      page.getByText("Bitte bewahre deine Bestellbestätigung bis zum Abschluss der Verlosung auf."),
    ).toBeVisible();

    // Duplikat: gleiche Bestellnummer erneut registrieren
    await page.goto("/gewinn");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Händler").selectOption("amazon");
    await page.getByLabel("Bestell- / Auftragsnummer").fill(ORDER_NUMBER);
    await page.getByLabel("Vorname").fill("Max");
    await page.getByLabel("Nachname").fill("Mustermann");
    await page.getByLabel("Straße").fill("Beispielweg");
    await page.getByLabel("Hausnummer").fill("1");
    await page.getByLabel("Postleitzahl").fill("20095");
    await page.getByLabel("Ort").fill("Hamburg");
    await page.getByLabel("E-Mail-Adresse").fill("max@test.local");
    await page.getByLabel("Telefonnummer (mit Ländervorwahl)").fill("+49 160 7654321");
    await page.getByLabel(/Angaben vollständig und korrekt/).check();
    await page.waitForTimeout(3200);
    await page
      .getByRole("button", { name: "Verbindlich am Gewinnspiel teilnehmen" })
      .click();

    await expect(
      page.getByText("Diese Bestellnummer wurde bereits für das Gewinnspiel registriert.").first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Admin sieht die Teilnahme, öffnet Details und ändert den Status", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/gewinnspiel");

    await expect(page.getByRole("heading", { name: "Gewinnspiel" })).toBeVisible();
    // Über die exakte Bestellnummer suchen (Hash-Suche)
    await page.getByLabel("Bestellnummer (exakt)").fill(ORDER_NUMBER);
    await page.getByRole("button", { name: "Filtern" }).click();

    // Nach der exakten Bestellnummern-Suche bleibt genau eine Datenzeile übrig
    const row = page.locator("tbody tr").first();
    await expect(row.getByText(/^[2-9A-HJKMNP-Z]{8}$/)).toBeVisible();
    await row.getByRole("link", { name: "Details" }).click();

    // Detailansicht: entschlüsselte Bestellnummer + Statuswechsel
    await expect(page.getByText(ORDER_NUMBER)).toBeVisible();
    await page.getByLabel("Status").selectOption("IN_REVIEW");
    await page.getByLabel(/Interne Notiz/).fill("E2E: Prüfung gestartet.");
    await page.getByRole("button", { name: "Änderungen speichern" }).click();

    // Erfolgsmeldung ODER (bei verlorener Action-Antwort) gespeicherter
    // Zustand nach Reload – maßgeblich ist das Ergebnis.
    const saved = await page
      .getByText("Die Teilnahme wurde aktualisiert.")
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!saved) {
      await page.reload();
      await expect(page.getByLabel("Status")).toHaveValue("IN_REVIEW");
    }
  });

  test("Teilnahmebedingungen sind vollständig veröffentlicht", async ({ page }) => {
    await page.goto("/gewinn/teilnahmebedingungen");
    await expect(page.getByRole("heading", { name: "Teilnahmebedingungen" })).toBeVisible();
    await expect(page.getByText("Wiresoft Portal Ltd.").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "9. Schlussbestimmungen" })).toBeVisible();
    await expect(page.getByText("Entwurf")).toHaveCount(0);
  });
});
