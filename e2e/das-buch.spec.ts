import { expect, test, type Page } from "@playwright/test";

/**
 * E2E: Buch-Landingpage /das-buch (Ads-Zielseite web.de/gmx.de).
 * Externe Embeds (YouTube/Spotify) werden gestubbt – Tests laufen offline.
 */

const AMAZON_URL = "https://link.amazon/B0eyhvaQw";

async function stubEmbeds(page: Page): Promise<void> {
  const stub = (body: string) => ({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: `<!doctype html><html><body>${body}</body></html>`,
  });
  await page.route("**/*youtube-nocookie.com/**", (route) => route.fulfill(stub("YT Stub")));
  await page.route("**/*open.spotify.com/**", (route) => route.fulfill(stub("Spotify Stub")));
}

test("Seite rendert Buch, Autor, Fakten und Amazon-CTAs", async ({ page }) => {
  await stubEmbeds(page);
  await page.goto("/das-buch");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Die Lizenz");
  await expect(
    page.getByText("Business ohne Plan, Ausreden oder Kompromisse").first(),
  ).toBeVisible();
  await expect(page.getByText("erscheint am 06.10.2026").first()).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Buchcover: Die Lizenz zum Erfolg/ }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /Soheil Hosseini, Autor/ })).toBeVisible();

  // Alle Kauf-CTAs zeigen exakt auf den Affiliate-Redirect
  const amazonLinks = page.getByRole("link", { name: /Amazon vorbestellen/ });
  await expect(amazonLinks).toHaveCount(3);
  for (const link of await amazonLinks.all()) {
    await expect(link).toHaveAttribute("href", AMAZON_URL);
  }

  // Rechtslinks (Ads-Compliance) + Amazon-Partner-Hinweis
  await expect(page.getByRole("link", { name: "Impressum" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Datenschutzerklärung" })).toBeVisible();
  await expect(
    page.getByText("Als Amazon-Partner verdienen wir an qualifizierten Verkäufen."),
  ).toBeVisible();
});

test("Musikvideo lädt erst nach Klick als youtube-nocookie-Embed", async ({ page }) => {
  await stubEmbeds(page);
  await page.goto("/das-buch");

  // Vor dem Klick: kein YouTube-iframe im DOM (Facade)
  await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);

  await page.getByRole("button", { name: /Video abspielen/ }).click();
  await expect(page.locator('iframe[title^="Musikvideo"]')).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed\/TeSglGnghVE/,
  );
});

test("Spotify-Player ist eingebunden", async ({ page }) => {
  await stubEmbeds(page);
  await page.goto("/das-buch");
  const spotify = page.locator(
    'iframe[src*="open.spotify.com/embed/track/1Nb1O1U1qC2V80Ztk3atTt"]',
  );
  await spotify.scrollIntoViewIfNeeded();
  await expect(spotify).toBeVisible();
  await expect(page.getByRole("link", { name: "Song auf Spotify öffnen" })).toHaveAttribute(
    "href",
    /open\.spotify\.com\/track\/1Nb1O1U1qC2V80Ztk3atTt/,
  );
});

test("Gewinnspiel ist sekundär verlinkt und reicht UTM-Parameter weiter", async ({ page }) => {
  await stubEmbeds(page);
  await page.goto("/das-buch?utm_source=webde&utm_campaign=buchlaunch");

  const teaser = page.getByRole("link", { name: "Zum Gewinnspiel" });
  await expect(teaser).toBeVisible();
  await expect(teaser).toHaveAttribute(
    "href",
    "/gewinn?utm_source=webde&utm_campaign=buchlaunch",
  );
});

test("SEO: indexierbar mit Canonical (Root-Layout ist noindex)", async ({ page }) => {
  await stubEmbeds(page);
  await page.goto("/das-buch");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://lizenzzumerfolg.com/das-buch",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://lizenzzumerfolg.com/das-buch/og.png",
  );
});
