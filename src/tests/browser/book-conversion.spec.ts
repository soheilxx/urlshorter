import { expect, test, type Page } from "@playwright/test";

/**
 * Browserprüfung Meta/TikTok/LinkedIn-Conversion-Tracking (Buchseiten).
 * Externe Zugriffe werden blockiert, der First-Party-Empfänger aufgezeichnet –
 * es entstehen keine echten Werbeereignisse.
 */
type CollectedEvent = {
  id: string;
  type: "PageView" | "AddToCart";
  path: string;
  destination?: string;
  ctaId?: string;
  fbclid?: string;
  utm?: Record<string, string>;
};
type PixelWindow = Window & {
  fbq?: { queue?: unknown[][] };
  ttq?: unknown[];
  lintrk?: { q?: unknown[][] };
  dataLayer?: Array<Record<string, unknown>>;
};
const ORIGIN = "http://127.0.0.1:3102";
const AMAZON_URL = "https://link.amazon/B0eyhvaQw";
const HERO_CTA = 'a[data-gw-event="gewinnspiel_amazon_klick"][data-cta-id="hero_schritt_1"]';

async function capture(page: Page) {
  const events: CollectedEvent[] = [];
  const reddit: unknown[] = [];
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === "/api/book/events") {
      events.push(JSON.parse(route.request().postData() ?? "{}") as CollectedEvent);
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === "/api/reddit/events") {
      reddit.push(JSON.parse(route.request().postData() ?? "{}"));
      return route.fulfill({ status: 204 });
    }
    return route.continue();
  });
  return { events, reddit };
}

function pixelState(page: Page) {
  return page.evaluate(() => {
    const w = window as PixelWindow;
    return {
      fbq: (w.fbq?.queue ?? []).map((entry) => Array.from(entry as unknown[])),
      ttq: (w.ttq ?? []).map((entry) => Array.from(entry as unknown[])),
      lintrk: w.lintrk?.q ?? [],
      // gtag()-Aufrufe landen als arguments-Objekt im dataLayer, direkte Pushes als {event}
      dataLayer: (w.dataLayer ?? []).map((entry) => {
        const e = entry as { event?: string; 1?: string };
        return e.event ?? e[1] ?? "";
      }),
    };
  });
}

test("/gewinn: PageView trägt dieselbe eventID in Meta-Pixel und CAPI; Meta-Pixel wird nur einmal initialisiert", async ({
  page,
}) => {
  const { events, reddit } = await capture(page);
  await page.goto("/gewinn?fbclid=IwAR0test&utm_source=meta&secret=never-send");
  await expect.poll(() => events.length).toBe(1);
  expect(events[0]).toMatchObject({
    type: "PageView",
    path: "/gewinn",
    fbclid: "IwAR0test",
    utm: { source: "meta" },
  });
  expect(JSON.stringify(events)).not.toContain("never-send");
  const state = await pixelState(page);
  expect(state.fbq.filter((e) => e[0] === "init")).toEqual([["init", "123456789012345"]]);
  expect(state.fbq.filter((e) => e[0] === "track")).toEqual([
    ["track", "PageView", {}, { eventID: events[0]!.id }],
  ]);
  expect(state.ttq.filter((e) => e[0] === "page")).toHaveLength(1);
  // Reddit läuft parallel weiter (eigener Empfänger)
  await expect.poll(() => reddit.length).toBe(1);
  // Kein zweites Pixel-Skript durch GewinnTracking
  expect(await page.locator("script#gw-meta, script#gw-tiktok").count()).toBe(0);
});

test("/gewinn: Amazon-CTA im Hero löst genau ein AddToCart in Pixel, CAPI, TikTok, LinkedIn und GA4 aus", async ({
  page,
}) => {
  const { events } = await capture(page);
  await page.goto("/gewinn");
  await expect.poll(() => events.length).toBe(1);
  const cta = page.locator(HERO_CTA);
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", AMAZON_URL);
  const popupPromise = page.waitForEvent("popup");
  await cta.click();
  const popup = await popupPromise;
  await expect.poll(() => events.length).toBe(2);
  expect(events[1]).toMatchObject({
    type: "AddToCart",
    destination: AMAZON_URL,
    ctaId: "hero_schritt_1",
  });
  expect(events[1]!.id).not.toBe(events[0]!.id);
  const state = await pixelState(page);
  const atc = state.fbq.filter((e) => e[0] === "track" && e[1] === "AddToCart");
  expect(atc).toHaveLength(1);
  expect(atc[0]![2]).toMatchObject({ content_ids: ["9783690662505"], value: 18, currency: "EUR" });
  expect(atc[0]![3]).toEqual({ eventID: events[1]!.id });
  // Kein zusätzliches Custom-Event für den Amazon-Klick bei Meta
  expect(state.fbq.some((e) => e[0] === "trackCustom")).toBe(false);
  const tiktokAtc = state.ttq.filter((e) => e[0] === "track" && e[1] === "AddToCart");
  expect(tiktokAtc).toHaveLength(1);
  expect(tiktokAtc[0]![3]).toEqual({ event_id: events[1]!.id });
  expect(state.lintrk).toContainEqual(["track", { conversion_id: 987654 }]);
  expect(state.dataLayer).toContain("add_to_cart");
  await popup.close();
});

test("Doppelklick wird entprellt; synthetische Klicks zählen nicht", async ({ page }) => {
  const { events } = await capture(page);
  await page.goto("/gewinn");
  await expect.poll(() => events.length).toBe(1);
  await page.locator(HERO_CTA).evaluate((link) => {
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  expect(events).toHaveLength(1);
  await page.locator(HERO_CTA).dblclick();
  await expect.poll(() => events.length).toBe(2);
  const state = await pixelState(page);
  expect(state.fbq.filter((e) => e[0] === "track" && e[1] === "AddToCart")).toHaveLength(1);
});

// /gutschein benötigt die Datenbank (Gutscheinbestand) und wird in e2e/gutschein.spec.ts geprüft.
for (const path of ["/das-buch"] as const) {
  test(`${path}: PageView + AddToCart über den bestehenden Amazon-CTA`, async ({ page }) => {
    const { events } = await capture(page);
    await page.goto(path);
    await expect.poll(() => events.length).toBe(1);
    expect(events[0]).toMatchObject({ type: "PageView", path });
    const popupPromise = page.waitForEvent("popup");
    await page.locator('a[data-gw-event="buch_amazon_klick"]').first().click();
    const popup = await popupPromise;
    await expect.poll(() => events.length).toBe(2);
    expect(events[1]).toMatchObject({ type: "AddToCart", path, destination: AMAZON_URL });
    const state = await pixelState(page);
    expect(state.fbq.filter((e) => e[0] === "track").map((e) => e[1])).toEqual([
      "PageView",
      "AddToCart",
    ]);
    await popup.close();
  });
}

test("Root-Weiterleitung sendet nur ein PageView", async ({ page }) => {
  const { events } = await capture(page);
  await page.goto("/");
  await expect.poll(() => events.length).toBe(1);
  expect(events[0]).toMatchObject({ type: "PageView", path: "/" });
});
