import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@test.local";
export const ADMIN_PASSWORD = "E2E-Testpasswort-123!";

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("E-Mail-Adresse").fill(ADMIN_EMAIL);
  await page.getByLabel("Passwort").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Fängt Amazon-Aufrufe ab, damit der Test nicht ins echte Internet geht. */
export async function stubAmazon(page: Page): Promise<void> {
  await page.route("**/*amazon.de/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><html><head><title>Amazon Stub</title></head><body>Amazon Stub</body></html>",
    }),
  );
}
