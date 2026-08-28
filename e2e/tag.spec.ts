import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * E2E: Zentrales Tracking-Snippet (t.js) auf einer eingebetteten Website.
 * Die "fremde" Website läuft auf localhost:8777 (Site-ID "test"); externe
 * Pixel-Hosts werden gestubbt, damit Tests keinen echten Traffic erzeugen.
 */

declare global {
  interface Window {
    lze?: (cmd: string, name: string, params?: Record<string, unknown>) => void;
    fbq?: unknown;
    ttq?: unknown;
    dataLayer?: unknown[];
  }
}

test("t.js: Einbettung lädt Pixel, trackt Pageviews und eigene Events", async ({
  page,
  request,
}) => {
  // Script vom ECHTEN Server holen (prüft Endpoint, Header und Inhalt) …
  const scriptResponse = await request.get("/t.js");
  expect(scriptResponse.status()).toBe(200);
  const scriptBody = await scriptResponse.text();
  expect(scriptBody).toContain("window.lze");

  await page.route(
    /connect\.facebook\.net|googletagmanager\.com|analytics\.tiktok\.com|redditstatic\.com|licdn\.com|google-analytics\.com|facebook\.com\/tr/,
    (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }),
  );

  // … und der eingebetteten Seite ausliefern (Chromium bricht echte
  // localhost-Subresource-Requests aus route-gefüllten Seiten ab).
  await page.route("http://127.0.0.1:3100/t.js", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: scriptBody }),
  );
  // Collect-Beacons an den echten Server durchreichen (route.fetch läuft
  // über Node und umgeht die Chromium-Abbrüche).
  await page.route("http://127.0.0.1:3100/api/tag/collect", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response });
  });

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><script async src="http://127.0.0.1:3100/t.js" data-site="test"></script><title>Testseite</title></head><body><h1>Externe Testseite</h1></body></html>`;
  await page.route("http://localhost:8777/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }),
  );

  await page.goto("http://localhost:8777/unterseite?utm_source=newsletter");

  await expect.poll(() => page.evaluate(() => typeof window.lze)).toBe("function");
  const state = await page.evaluate(() => ({
    fbq: typeof window.fbq,
    hasDataLayer: Array.isArray(window.dataLayer),
    cookie: document.cookie.includes("_lze_id="),
  }));
  expect(state.fbq).toBe("function");
  expect(state.hasDataLayer).toBe(true);
  expect(state.cookie).toBe(true);

  // Eigenes Event über die öffentliche API (Name wird normalisiert)
  await page.evaluate(() => window.lze?.("event", "Buch Kauf!"));

  const prisma = new PrismaClient();
  try {
    await expect
      .poll(() => prisma.tagEvent.count({ where: { siteId: "test" } }), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);
    const rows = await prisma.tagEvent.findMany({
      where: { siteId: "test" },
      select: { eventName: true, path: true, utmSource: true },
    });
    const names = rows.map((r) => r.eventName).sort();
    expect(names).toContain("page_view");
    expect(names).toContain("buch_kauf_");
    const pageView = rows.find((r) => r.eventName === "page_view");
    expect(pageView?.path).toBe("/unterseite");
    expect(pageView?.utmSource).toBe("newsletter");
  } finally {
    await prisma.$disconnect();
  }
});

test("t.js: nicht gelistete Hostnamen bleiben inaktiv", async ({ page, request }) => {
  const scriptBody = await (await request.get("/t.js")).text();
  await page.route("http://127.0.0.1:3100/t.js", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: scriptBody }),
  );
  await page.route("https://fremde-firma.example/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html><head><script src="http://127.0.0.1:3100/t.js" data-site="test"></script></head><body>fremd</body></html>`,
    }),
  );
  await page.goto("https://fremde-firma.example/");
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => ({
    lze: typeof window.lze,
    fbq: typeof window.fbq,
  }));
  expect(state.lze).toBe("undefined");
  expect(state.fbq).toBe("undefined");
});
