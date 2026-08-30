import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Mobile-Suite (Projekt „Mobile Chrome“, Pixel-7-Viewport):
 * Bottom-Tab-Bar, „Mehr“-Sheet, FilterPanel, Overflow-Freiheit und
 * Theme-Persistenz. Läuft nach den Desktop-Specs gegen dieselbe Test-DB.
 */

test.describe("Mobile Navigation", () => {
  test("Bottom-Tab-Bar ist sichtbar und navigiert", async ({ page }) => {
    await loginAsAdmin(page);

    const tabbar = page.getByRole("navigation", { name: "Hauptnavigation (mobil)" });
    await expect(tabbar).toBeVisible();

    await tabbar.getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/\/admin\/analytics$/);

    await tabbar.getByRole("link", { name: "Kurzlinks" }).click();
    await expect(page).toHaveURL(/\/admin\/links$/);
  });

  test("„Mehr“-Sheet öffnet, zeigt Bereiche und navigiert", async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole("button", { name: "Mehr" }).click();
    const sheet = page.getByRole("dialog", { name: "Weitere Bereiche" });
    await expect(sheet).toBeVisible();

    // Admin sieht alle Bereiche
    for (const label of ["Ziele", "Klicks", "Websites", "Gewinnspiel", "Benutzer", "Einstellungen"]) {
      await expect(sheet.getByRole("link", { name: label })).toBeVisible();
    }

    await sheet.getByRole("link", { name: "Ziele" }).click();
    await expect(page).toHaveURL(/\/admin\/destinations$/);
    await expect(sheet).toHaveCount(0);
  });

  test("Desktop-Sidebar ist mobil nicht sichtbar", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator("aside")).toBeHidden();
  });
});

test.describe("Mobile Layout", () => {
  test("kein horizontales Scrollen auf den Kernseiten", async ({ page }) => {
    await loginAsAdmin(page);
    const paths = [
      "/admin",
      "/admin/links",
      "/admin/clicks",
      "/admin/analytics",
      "/admin/destinations",
      "/admin/amazon",
    ];
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `Overflow auf ${path}`).toBeLessThanOrEqual(1);
    }
  });

  test("FilterPanel auf der Klicks-Seite klappt auf", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/clicks");

    const toggle = page.getByRole("button", { name: "Filter", exact: true });
    await expect(toggle).toBeVisible();
    await expect(page.getByLabel("Von (Datum)")).toBeHidden();

    await toggle.click();
    await expect(page.getByLabel("Von (Datum)")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("Theme", () => {
  test("Dark Mode wird umgeschaltet und überlebt einen Reload", async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole("button", { name: "Mehr" }).click();
    const sheet = page.getByRole("dialog", { name: "Weitere Bereiche" });
    const toggle = sheet.getByRole("button", { name: /^Design:/ });

    // Zyklus System → Hell → Dunkel
    await toggle.click();
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});
