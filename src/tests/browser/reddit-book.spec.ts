import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
type Event = { id: string; type: string; path: string; ctaId?: string };
type PixelWindow = Window & {
  rdt?: { callQueue?: unknown[][] };
  __bookMetrics?: { lcp: number; cls: number };
};
async function capture(page: Page, failedVote = false, blockedPixel = false) {
  const events: Event[] = [];
  let vote = 0;
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:3101") return route.abort();
    if (url.pathname === "/api/reddit/events") {
      events.push(JSON.parse(route.request().postData() ?? "{}"));
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === "/api/reddit/book-vote") {
      if (route.request().method() === "POST") {
        if (failedVote) return route.fulfill({ status: 503 });
        vote = JSON.parse(route.request().postData() ?? "{}").vote;
      }
      return route.fulfill({ json: { score: 1268 + vote, readers: 32, vote } });
    }
    return route.continue();
  });
  if (blockedPixel)
    await page.addInitScript(() =>
      Object.defineProperty(window, "rdt", {
        value: () => {
          throw new Error("blocked");
        },
      }),
    );
  return events;
}
for (const width of [360, 390, 430, 1280, 1440])
  for (const theme of ["light", "dark"] as const) {
    test(`${width}px ${theme}: vollständige Seite ohne Überlauf und unabhängig vom Admin-Theme`, async ({
      page,
    }, testInfo) => {
      await capture(page);
      await page.context().addCookies([
        {
          name: "theme",
          value: theme === "light" ? "dark" : "light",
          url: "http://127.0.0.1:3101",
        },
      ]);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/buch-reddit");
      await expect(page.getByRole("button", { name: "Upvote", exact: true })).toBeEnabled();
      await page.evaluate(() => document.fonts.ready);
      await page.locator("#autor").scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              [...document.images].filter(
                (x) => x.getClientRects().length > 0 && (!x.complete || x.naturalWidth === 0),
              ).length,
          ),
        )
        .toBe(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator("h1")).toContainText("Microsoft");
      const metrics = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        bg: getComputedStyle(document.querySelector('[data-testid="reddit-book"]')!)
          .backgroundColor,
        broken: [...document.images].filter(
          (x) => x.getClientRects().length > 0 && (!x.complete || x.naturalWidth === 0),
        ).length,
      }));
      expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
      expect(metrics.broken).toBe(0);
      expect(metrics.bg).toBe(theme === "dark" ? "rgb(14, 17, 19)" : "rgb(255, 255, 255)");
      expect(errors).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`book-${width}-${theme}.png`),
        fullPage: true,
      });
      await page.emulateMedia({ colorScheme: theme === "dark" ? "light" : "dark" });
      await expect(page.getByTestId("reddit-book")).toHaveCSS(
        "background-color",
        theme === "dark" ? "rgb(255, 255, 255)" : "rgb(14, 17, 19)",
      );
    });
  }
test("Ohne Cookie-Dialog: sofort eine PV und genau ein ATC pro Bestell-Klick", async ({ page }) => {
  const events = await capture(page);
  await page.goto("/buch-reddit?utm_source=reddit&rdt_cid=qa-click");
  await expect.poll(() => events.length).toBe(1);
  expect(events[0]).toMatchObject({ type: "PageVisit", path: "/buch-reddit" });
  await expect(page.getByRole("button", { name: "Cookie-Einstellungen", exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator("[data-consent-open]")).toHaveCount(0);
  expect(await page.locator('a[data-reddit-event="amazon"]').allTextContents()).toEqual(
    Array(5).fill("Bei Amazon bestellen"),
  );
  await expect(page.locator("main")).not.toContainText(/vorbestell/i);
  await page.getByRole("button", { name: "Upvote", exact: true }).click();
  await expect(page.getByRole("button", { name: "Upvote", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByText("Geht es im Buch nur um Microsoft?", { exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  expect(events).toHaveLength(1);
  for (const placement of ["hero", "sidebar", "book-details", "final"]) {
    // Getrennte bewusste Aktivierungen außerhalb der 600-ms-Doppelklick-Sperre.
    await page.waitForTimeout(650);
    const popupPromise = page.waitForEvent("popup");
    await page.locator(`[data-cta-id="${placement}"]`).click();
    const popup = await popupPromise;
    await popup.close();
    await expect
      .poll(() => events.filter((x) => x.type === "AddToCart" && x.ctaId === placement).length)
      .toBe(1);
  }
  const pixel = await page.evaluate(() =>
    ((window as PixelWindow).rdt?.callQueue ?? []).filter((x) => x[0] === "track"),
  );
  expect(pixel).toEqual(events.map((x) => ["track", x.type, { conversionId: x.id }]));
  expect(events.filter((x) => x.type === "PageVisit")).toHaveLength(1);
});
for (const cookie of ["yes", "declined"]) {
  test(`Früherer Cookie ${cookie} beeinflusst PV und ATC nicht`, async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: "lze_reddit_consent", value: cookie, url: "http://127.0.0.1:3101" }]);
    const events = await capture(page);
    await page.goto("/buch-reddit");
    await expect.poll(() => events.length).toBe(1);
    await page.locator("#first-book-cta").press("Enter");
    await expect.poll(() => events.length).toBe(2);
    expect(events.map((x) => x.type)).toEqual(["PageVisit", "AddToCart"]);
    await expect(page.locator("[data-consent-open]")).toHaveCount(0);
  });
}
test("Vote bleibt nach Reload erhalten und ist zurücknehmbar; kein ATC", async ({ page }) => {
  const events = await capture(page);
  await page.goto("/buch-reddit");
  const up = page.getByRole("button", { name: "Upvote", exact: true });
  await up.click();
  await expect(up).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(up).toHaveAttribute("aria-pressed", "true");
  await up.click();
  await expect(up).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("vote-score")).toHaveText("1.268");
  expect(events.some((x) => x.type === "AddToCart")).toBe(false);
});
test("Vote-Ausfall rollt Anzeige zurück, Amazon bleibt bedienbar", async ({ page }) => {
  await capture(page, true);
  await page.goto("/buch-reddit");
  await page.getByRole("button", { name: "Upvote", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("nicht gespeichert");
  await expect(page.getByTestId("vote-score")).toHaveText("1.268");
  await expect(page.locator("#first-book-cta")).toHaveAttribute(
    "href",
    "https://link.amazon/B0eyhvaQw",
  );
});
test("Mobile Sticky-CTA erscheint erst nach dem ersten CTA und weicht dem Footer", async ({
  page,
}) => {
  const events = await capture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buch-reddit");
  const sticky = page.locator('[data-cta-id="mobile-sticky"]');
  await expect(sticky).toBeHidden();
  await page.locator("#geschichte").scrollIntoViewIfNeeded();
  await expect(sticky).toBeVisible();
  await sticky.press("Enter");
  await expect.poll(() => events.filter((x) => x.ctaId === "mobile-sticky").length).toBe(1);
  await page.locator("#book-footer").scrollIntoViewIfNeeded();
  await expect(sticky).toBeHidden();
});
test("Blockierter Pixel beeinträchtigt den CAPI-Aufruf nicht", async ({ page }) => {
  const events = await capture(page, false, true);
  await page.goto("/buch-reddit");
  await expect.poll(() => events.length).toBe(1);
  await page.locator("#first-book-cta").press("Enter");
  await expect.poll(() => events.length).toBe(2);
  expect(events.map((x) => x.type)).toEqual(["PageVisit", "AddToCart"]);
});
test("Ohne JavaScript: Systemfarbe, Inhalt, FAQ und Amazon-Link funktionieren", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    colorScheme: "dark",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await capture(page);
  await page.goto("http://127.0.0.1:3101/buch-reddit");
  await expect(page.getByTestId("reddit-book")).toHaveCSS("background-color", "rgb(14, 17, 19)");
  await page.getByText("Geht es im Buch nur um Microsoft?", { exact: true }).click();
  await expect(page.locator("details[open]")).toHaveCount(1);
  await expect(page.locator("#first-book-cta")).toHaveAttribute(
    "href",
    "https://link.amazon/B0eyhvaQw",
  );
  await context.close();
});
test("Labormessung LCP und CLS, Chrome mobil 390px ohne Netz-/CPU-Drosselung", async ({
  page,
}, testInfo) => {
  await capture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const metrics = { lcp: 0, cls: 0 };
    (window as PixelWindow).__bookMetrics = metrics;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) metrics.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (!(e as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput)
          metrics.cls += (e as PerformanceEntry & { value: number }).value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/buch-reddit");
  await expect(page.getByRole("button", { name: "Upvote", exact: true })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  const metrics = await page.evaluate(() => (window as PixelWindow).__bookMetrics!);
  await testInfo.attach("lab-metrics", {
    body: JSON.stringify(metrics),
    contentType: "application/json",
  });
  expect(metrics.lcp).toBeGreaterThan(0);
  expect(metrics.lcp).toBeLessThanOrEqual(2500);
  expect(metrics.cls).toBeLessThanOrEqual(0.1);
  await page.locator("#autor").scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator('img[alt="Soheil Hosseini, Autor von Die Lizenz zum Erfolg"]')
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  const folder = path.resolve("test-results/reddit-book-review");
  await mkdir(folder, { recursive: true });
  await writeFile(
    path.join(folder, "lab-metrics.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        conditions:
          "Chrome, 390x844, localhost, no network or CPU throttling, provider requests mocked",
        ...metrics,
      },
      null,
      2,
    ),
  );
  await page.screenshot({ path: path.join(folder, "mobile-light.png"), fullPage: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(folder, "mobile-dark.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(folder, "desktop-dark.png"), fullPage: true });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(folder, "desktop-light.png"), fullPage: true });
});
