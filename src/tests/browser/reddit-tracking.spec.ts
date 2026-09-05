import { expect, test, type Page } from "@playwright/test";

type CollectedEvent = {
  id: string;
  type: "PageVisit" | "AddToCart";
  path: string;
  clickId?: string;
  destination?: string;
  utm?: Record<string, string>;
};
type PixelWindow = Window & {
  rdt?: { callQueue?: unknown[][] };
};
const AMAZON_URL = "https://link.amazon/B0eyhvaQw";
const CTA = 'a[data-gw-event="buch_amazon_klick"]';

async function capture(page: Page, pixelBlocked = false) {
  const events: CollectedEvent[] = [];
  // Context-Routing erfasst auch neue Amazon-Tabs; sämtliche externen Zugriffe werden blockiert.
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:3101") return route.abort();
    if (url.pathname === "/api/reddit/events") {
      events.push(JSON.parse(route.request().postData() ?? "{}") as CollectedEvent);
      return route.fulfill({ status: 204 });
    }
    return route.continue();
  });
  if (pixelBlocked) {
    await page.addInitScript(() => {
      Object.defineProperty(window, "rdt", {
        value: () => {
          throw new Error("blocked");
        },
      });
    });
  }
  return events;
}

async function pixelEvents(page: Page) {
  return page.evaluate(() =>
    ((window as PixelWindow).rdt?.callQueue ?? []).filter((entry) => entry[0] === "track"),
  );
}

test("PageVisit hat dieselbe ID in Pixel und CAPI; Theme und Hash zählen nicht erneut", async ({
  page,
}) => {
  const events = await capture(page);
  await page.goto("/das-buch?rdt_cid=test-click-123&utm_source=reddit&private=never-send");
  await expect.poll(() => events.length).toBe(1);
  expect(events[0]).toMatchObject({
    type: "PageVisit",
    path: "/das-buch",
    clickId: "test-click-123",
    utm: { source: "reddit" },
  });
  expect(JSON.stringify(events)).not.toContain("never-send");
  expect(await pixelEvents(page)).toEqual([
    ["track", "PageVisit", { conversionId: events[0]!.id }],
  ]);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(() => {
    location.hash = "buchdetails";
  });
  await page.getByRole("button", { name: /Video abspielen/ }).click();
  await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(1);
  expect(events).toHaveLength(1);
});

for (const index of [0, 1, 2]) {
  test(`Amazon-CTA ${index + 1} zählt genau ein ATC und öffnet den bestehenden Amazon-Link`, async ({
    page,
  }) => {
    const events = await capture(page);
    await page.goto("/das-buch");
    await expect.poll(() => events.length).toBe(1);
    const popupPromise = page.waitForEvent("popup");
    await page.locator(CTA).nth(index).click();
    const popup = await popupPromise;
    await expect.poll(() => events.length).toBe(2);
    expect(events[1]).toMatchObject({ type: "AddToCart", destination: AMAZON_URL });
    expect(events[1]!.id).not.toBe(events[0]!.id);
    expect(await pixelEvents(page)).toEqual([
      ["track", "PageVisit", { conversionId: events[0]!.id }],
      ["track", "AddToCart", { conversionId: events[1]!.id }],
    ]);
    await popup.close();
  });
}

for (const method of ["keyboard", "middle", "control"] as const) {
  test(`${method}: Amazon-Aktivierung wird erfasst`, async ({ page }) => {
    const events = await capture(page);
    await page.goto("/das-buch");
    await expect.poll(() => events.length).toBe(1);
    const link = page.locator(CTA).first();
    if (method === "keyboard") await link.press("Enter");
    else await link.click(method === "middle" ? { button: "middle" } : { modifiers: ["Control"] });
    await expect.poll(() => events.length).toBe(2);
    expect(events[1]!.type).toBe("AddToCart");
  });
}

test("fehlgeschlagene Beacon-Queue nutzt fetch; Reload erzeugt eine neue ID und behält Click-ID", async ({
  page,
}) => {
  const events = await capture(page);
  await page.addInitScript(() => {
    navigator.sendBeacon = () => false;
  });
  await page.goto("/das-buch?rdt_cid=retained-click");
  await expect.poll(() => events.length).toBe(1);
  await page.goto("/das-buch");
  await expect.poll(() => events.length).toBe(2);
  expect(events[1]).toMatchObject({ type: "PageVisit", clickId: "retained-click" });
  expect(events[1]!.id).not.toBe(events[0]!.id);
});

test("blockiertes Pixel unterbricht CAPI und Amazon nicht", async ({ page }) => {
  const events = await capture(page, true);
  await page.goto("/das-buch");
  await expect.poll(() => events.length).toBe(1);
  await page.locator(CTA).first().click();
  await expect.poll(() => events.length).toBe(2);
});

test("programmgesteuerte Klicks erzeugen kein ATC; Doppelklick wird entprellt", async ({
  page,
}) => {
  const events = await capture(page);
  await page.goto("/das-buch");
  await expect.poll(() => events.length).toBe(1);
  await page
    .locator(CTA)
    .first()
    .evaluate((link) => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  expect(events).toHaveLength(1);
  await page.locator(CTA).first().dblclick();
  await expect.poll(() => events.length).toBe(2);
  expect((await pixelEvents(page)).filter((entry) => entry[1] === "AddToCart")).toHaveLength(1);
});

test("mobiler Touch-CTA zählt ATC", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const events = await capture(page);
  await page.goto("http://127.0.0.1:3101/das-buch");
  await expect.poll(() => events.length).toBe(1);
  await page.locator(CTA).first().tap();
  await expect.poll(() => events.length).toBe(2);
  expect(events[1]!.type).toBe("AddToCart");
  await context.close();
});
