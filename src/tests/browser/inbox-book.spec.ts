import { test, expect, type Page } from "@playwright/test";

type Conversion = {
  type: string;
  id: string;
  ctaId?: string;
  path: string;
  utm?: { source?: string };
};
async function capture(page: Page) {
  const reddit: Conversion[] = [],
    book: Conversion[] = [];
  await page.context().route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:3103") return route.abort();
    if (url.pathname === "/api/book/events" || url.pathname === "/api/reddit/events") {
      (url.pathname === "/api/book/events" ? book : reddit).push(
        JSON.parse(route.request().postData() || "{}"),
      );
      return route.fulfill({ status: 204 });
    }
    return route.continue();
  });
  return { reddit, book };
}

for (const width of [320, 390, 768, 1440])
  for (const portal of ["gmx", "webde"])
    for (const theme of ["light", "dark"] as const) {
      test(`${width}px ${portal} ${theme}: Layout, früher CTA und Systemfarbe`, async ({
        page,
      }, info) => {
        await capture(page);
        await page.setViewportSize({ width, height: width === 320 ? 640 : 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.context().addCookies([
          {
            name: "theme",
            value: theme === "light" ? "dark" : "light",
            url: "http://127.0.0.1:3103",
          },
        ]);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`/buch-inbox?portal=${portal}`);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.getByRole("button", { name: "Buch für später merken" })).toBeEnabled();
        await expect(page.getByTestId("inbox-book")).toHaveAttribute("data-portal", portal);
        await expect(page.getByTestId("inbox-book")).toHaveCSS(
          "background-color",
          theme === "dark" ? "rgb(17, 24, 33)" : "rgb(240, 243, 247)",
        );
        await expect(page.locator("h1")).toContainText("Wer sagt, dass du");
        await expect(page.locator("#inbox-charity-note")).toBeInViewport({
          ratio: 1,
        });
        await expect(page.locator("#inbox-charity-note")).toContainText(
          "Die gesamten Einnahmen des Autors aus diesem Buch fließen an den Kinderschutzbund.",
        );
        await expect(page.locator("#inbox-giveaway-teaser")).not.toBeInViewport();
        await expect(page.locator("#inbox-giveaway-teaser")).toContainText("5 Tage Dubai");
        await expect(page.locator("#inbox-giveaway-teaser")).toContainText("20.000 €");
        const order = await page.evaluate(() =>
          ["geschichte", "inbox-giveaway-teaser", "gewinnchance"].map(
            (id) => document.getElementById(id)!.getBoundingClientRect().top,
          ),
        );
        expect(order[0]!).toBeLessThan(order[1]!);
        expect(order[1]!).toBeLessThan(order[2]!);
        await page.screenshot({ path: info.outputPath(`inbox-${width}-${portal}-${theme}.png`) });
        await expect(page.locator("#inbox-first-cta")).toBeInViewport({ ratio: 1 });
        const metrics = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          broken: [...document.images].filter((image) => {
            const rect = image.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.top < innerHeight &&
              rect.bottom > 0 &&
              (!image.complete || image.naturalWidth === 0)
            );
          }).length,
        }));
        expect(metrics).toEqual({ overflow: false, broken: 0 });
        expect(errors).toEqual([]);
        await page.screenshot({ path: info.outputPath(`inbox-${width}-${portal}-${theme}.png`) });
        if (width === 390 || width === 1440) {
          await page.locator("#autor").scrollIntoViewIfNeeded();
          await expect(page.locator("#autor img")).toHaveJSProperty("complete", true);
          await page.evaluate(() => window.scrollTo(0, 0));
          await expect(page.locator('[data-cta-id="inbox-mobile-sticky"]')).toBeHidden();
          await page.screenshot({
            path: info.outputPath(`inbox-full-${width}-${portal}-${theme}.png`),
            fullPage: true,
          });
        }
        await page.emulateMedia({ colorScheme: theme === "light" ? "dark" : "light" });
        await expect(page.getByTestId("inbox-book")).toHaveCSS(
          "background-color",
          theme === "light" ? "rgb(17, 24, 33)" : "rgb(240, 243, 247)",
        );
      });
    }

test("Merken, Sharing-Fallback und FAQ; ATC nur durch echte Amazon-Klicks", async ({ page }) => {
  const { book, reddit } = await capture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("blocked");
        },
      },
    });
  });
  await page.goto("/buch-inbox?utm_source=uim&utm_medium=inbox_ad&portal=webde");
  await expect.poll(() => book.length).toBe(1);
  await expect.poll(() => reddit.length).toBe(1);
  expect(book[0]).toMatchObject({ type: "PageView", path: "/buch-inbox", utm: { source: "uim" } });
  expect(reddit[0]).toMatchObject({ type: "PageVisit", path: "/buch-inbox" });
  await page.getByRole("button", { name: "Buch für später merken" }).click();
  await expect(page.getByRole("button", { name: "Buch nicht mehr merken" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  const saved = page.getByRole("button", { name: "Buch nicht mehr merken" });
  await expect(saved).toHaveAttribute("aria-pressed", "true");
  await saved.click();
  await page.getByRole("button", { name: "Buch weiterempfehlen" }).click();
  await expect(page.getByRole("textbox", { name: "Link zum Buch" })).toHaveValue(
    "https://lizenzzumerfolg.com/buch-inbox?portal=webde",
  );
  await page.getByText("Geht es in dem Buch nur um Microsoft?", { exact: true }).click();
  await page.locator('#inbox-giveaway-teaser a[href="#gewinnchance"]').click();
  await expect(page.locator("#gewinnchance")).toContainText("10 × 500 € · 40 × 150 € · 50 × 50 €");
  await expect(page.locator("#gewinnchance")).toContainText("11.10.2026, 23:59 Uhr");
  await expect(page.locator("#gewinnchance")).toContainText("Emirates Business Class");
  await expect(
    page.getByRole("link", { name: /Schon bestellt\? Bestellung registrieren/ }),
  ).toHaveAttribute("href", "https://lizenzzumerfolg.com/gewinn#teilnahme");
  await expect(
    page.getByRole("link", { name: "Teilnahmebedingungen", exact: true }),
  ).toHaveAttribute("href", "https://lizenzzumerfolg.com/gewinn/teilnahmebedingungen");
  expect(book.filter((event) => event.type === "AddToCart")).toHaveLength(0);
  await page
    .locator("#inbox-first-cta")
    .evaluate((element) => (element as HTMLAnchorElement).click());
  expect(book.filter((event) => event.type === "AddToCart")).toHaveLength(0);
  for (const placement of [
    "inbox-hero",
    "inbox-sidebar",
    "inbox-charity",
    "inbox-giveaway",
    "inbox-book-details",
    "inbox-final",
  ]) {
    await page.waitForTimeout(650);
    const popupPromise = page.waitForEvent("popup");
    await page.locator(`[data-cta-id="${placement}"]`).click();
    await (await popupPromise).close();
    await expect
      .poll(
        () =>
          book.filter((event) => event.type === "AddToCart" && event.ctaId === placement).length,
      )
      .toBe(1);
    await expect
      .poll(
        () =>
          reddit.filter((event) => event.type === "AddToCart" && event.ctaId === placement).length,
      )
      .toBe(1);
  }
});

test("Mobile Menü-Navigation, Tastatur-CTA und Sticky-Leiste", async ({ page }) => {
  const { book } = await capture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buch-inbox?portal=gmx");
  const sticky = page.locator('[data-cta-id="inbox-mobile-sticky"]');
  await expect(sticky).toBeHidden();
  await page.getByLabel("Inhalt öffnen").click();
  await page
    .getByRole("navigation", { name: "Inhalt auf Mobilgeräten" })
    .getByRole("link", { name: "Dein Lesestapel" })
    .click();
  await expect(page).toHaveURL(/#lesegruende$/);
  await expect(sticky).toBeVisible();
  await sticky.press("Enter");
  await expect
    .poll(() => book.filter((event) => event.ctaId === "inbox-mobile-sticky").length)
    .toBe(1);
  await page.locator("#inbox-footer").scrollIntoViewIfNeeded();
  await expect(sticky).toBeHidden();
});

test("Ohne JavaScript sind Nachricht, FAQ und Bestellung nutzbar", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await capture(page);
  await page.goto("http://127.0.0.1:3103/buch-inbox?portal=webde");
  await expect(page.locator("h1")).toContainText("das nicht kannst?");
  await expect(page.locator("#inbox-first-cta")).toHaveAttribute(
    "href",
    "https://link.amazon/B0eyhvaQw",
  );
  await page
    .getByText("Was bedeutet der Hinweis auf den Kinderschutzbund?", { exact: true })
    .click();
  await expect(page.locator("#fragen details[open]")).toContainText(
    "Die gesamten Einnahmen des Autors",
  );
  await context.close();
});
