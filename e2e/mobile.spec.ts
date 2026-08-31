import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
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

  test("kein horizontales Scrollen mit extremen Label-Längen", async ({ page }) => {
    // Reproduziert den Produktions-Bug: lange Kampagnennamen mit Pipes und
    // unzerbrechliche Referrer-URLs dürfen Karten/Raster nicht aufspreizen.
    const prisma = new PrismaClient();
    try {
      const destination = await prisma.destination.upsert({
        where: { id: "e2e-extreme-dest" },
        update: {},
        create: {
          id: "e2e-extreme-dest",
          name: "Amazon Buchseite – Die Lizenz zum Erfolg (Taschenbuch, Sonderaktion)",
          url: "https://www.amazon.de/dp/3690662508?tag=wiresoft-21&linkCode=ogi&th=1",
          host: "www.amazon.de",
          active: true,
        },
      });
      const link = await prisma.shortLink.upsert({
        where: { code: "xlng" },
        update: {},
        create: {
          code: "xlng",
          name: "Max | Buchverkauf | Lizenz zum Erfolg – Ultimative Kampagnenbezeichnung",
          source: "BH24 Newsletter Produkt Spezialaussendung",
          medium: "email",
          campaign: "Link zum Buch Insta Profil – Ultimative-Kampagnen-Bezeichnung-Q3-2026",
          destinationId: destination.id,
        },
      });
      await prisma.clickEvent.createMany({
        data: Array.from({ length: 5 }, (_, i) => ({
          id: randomUUID(),
          shortLinkId: link.id,
          destinationId: destination.id,
          code: link.code,
          linkName: link.name,
          source: link.source,
          medium: link.medium,
          campaign: link.campaign,
          ts: new Date(Date.now() - i * 60_000),
          referrer:
            "https://l.instagram.com/?u=https%3A%2F%2Flizenzzumerfolg.com%2Fxlng%3Futm_source%3Dinstagram%26utm_campaign%3Dultimative-kampagne&e=AT2kXanH9",
          deviceType: "mobile",
          browser: "Chrome",
          os: "Android",
          country: "DE",
          city: "Berlin",
          isBot: false,
          bridgeLoaded: true,
          trackingFired: true,
          redirectStarted: true,
        })),
      });
    } finally {
      await prisma.$disconnect();
    }

    await loginAsAdmin(page);
    for (const path of ["/admin", "/admin/links", "/admin/clicks", "/admin/analytics"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `Overflow auf ${path} mit extremen Labels`).toBeLessThanOrEqual(1);
    }
  });

  test("Buch-Landingpage ohne horizontales Scrollen (auch nach Video-Start)", async ({
    page,
  }) => {
    // Externe Embeds stubben – kein Internet nötig, keine Flakes
    const stub = { status: 200, contentType: "text/html", body: "<html></html>" };
    await page.route("**/*youtube-nocookie.com/**", (route) => route.fulfill(stub));
    await page.route("**/*open.spotify.com/**", (route) => route.fulfill(stub));

    await page.goto("/das-buch");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const before = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(before, "Overflow auf /das-buch").toBeLessThanOrEqual(1);

    // iframes sind klassische Overflow-Quellen → nach dem Facade-Klick erneut messen
    await page.getByRole("button", { name: /Video abspielen/ }).click();
    await expect(page.locator('iframe[title^="Musikvideo"]')).toBeVisible();
    const after = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(after, "Overflow auf /das-buch nach Video-Start").toBeLessThanOrEqual(1);
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
