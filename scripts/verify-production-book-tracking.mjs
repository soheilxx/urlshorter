/**
 * Post-deployment browser verification. Run only after the central deployment:
 *   node scripts/verify-production-book-tracking.mjs --run-after-deploy
 * Optional --native-only / --author-only selects one deployment.
 * All ad/collector/retailer requests are blocked or fulfilled locally.
 * Only reviewed page URLs and their same-origin static assets reach production.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

if (!process.argv.includes("--run-after-deploy")) {
  console.log("Prepared only. After deployment, run with --run-after-deploy.");
  process.exit(0);
}

const outputDir = path.resolve("output/tracking-audit-2026-09-09");
const nativePaths = ["/gewinn", "/das-buch", "/gutschein", "/buch-reddit", "/buch-inbox"];
const targets = [
  ...nativePaths.map((pathname) => ({
    url: `https://lizenzzumerfolg.com${pathname}`,
    collector: "/api/book/events",
    selector: 'a[href="https://link.amazon/B0eyhvaQw"]',
    native: true,
  })),
  {
    url: "https://www.soheil-hosseini.de/",
    collector: "/api/book-events",
    selector: 'a[data-event-name="retailer_outbound_click"]',
    native: false,
  },
].filter((target) =>
  process.argv.includes("--native-only")
    ? target.native
    : process.argv.includes("--author-only")
      ? !target.native
      : true,
);
const collectorPaths = new Set([
  "/api/book/events",
  "/api/reddit/events",
  "/api/book-events",
  "/api/tag/collect",
]);
let baseline = [];
try {
  baseline = JSON.parse(await readFile(path.join(outputDir, "inventory.json"), "utf8"));
} catch {
  /* An absent snapshot does not prevent click verification. */
}

function withoutQuery(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}
function summarizeEvent(raw, collector) {
  return {
    collector,
    type: raw.type ?? raw.event_name ?? raw.name,
    id: raw.id ?? raw.event_id,
    path: raw.path,
    ctaId: raw.ctaId,
    destination: withoutQuery(raw.destination),
  };
}
async function waitUntil(check, message, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
async function pixelState(page) {
  return page.evaluate(() => {
    const calls = (window.fbq?.queue ?? []).map((entry) => Array.from(entry));
    return {
      init: calls.filter((entry) => entry[0] === "init").map((entry) => String(entry[1])),
      events: calls
        .filter((entry) => entry[0] === "trackSingle" || entry[0] === "track")
        .map((entry) => {
          const single = entry[0] === "trackSingle";
          return {
            command: entry[0],
            pixel: single ? String(entry[1]) : undefined,
            type: entry[single ? 2 : 1],
            id: entry[single ? 4 : 3]?.eventID,
          };
        }),
      reddit: (window.rdt?.callQueue ?? [])
        .filter((entry) => entry[0] === "track")
        .map((entry) => ({
          type: entry[1],
          id: entry[2]?.conversionId,
        })),
      tiktok: Array.isArray(window.ttq)
        ? window.ttq
            .filter((entry) => entry[0] === "track")
            .map((entry) => ({
              type: entry[1],
              id: entry[3]?.event_id,
            }))
        : [],
      linkedin: (window.lintrk?.q ?? [])
        .filter((entry) => entry[0] === "track")
        .map((entry) => ({
          conversionId: entry[1]?.conversion_id,
          id: entry[1]?.event_id,
        })),
      ga4: (window.dataLayer ?? [])
        .map((entry) => entry?.event ?? entry?.[1])
        .filter((name) => name === "add_to_cart"),
      ownerPath: window.__lzeBookTrackingPath,
    };
  });
}

const browser = await chromium.launch({ args: ["--disable-background-networking"] });
const results = [];
try {
  for (const target of targets) {
    const targetUrl = new URL(target.url);
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: 1440, height: 1000 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    });
    const events = [];
    const assets = [];
    const assetReads = [];
    const allowedRequests = [];
    const blockedRequests = [];
    const result = {
      url: target.url,
      status: "failed",
      events,
      assets,
      allowedRequests,
      blockedRequests,
    };
    results.push(result);
    // Installed on the context before any page is created; also covers new retailer tabs.
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const sameOrigin = url.origin === targetUrl.origin;
      if (sameOrigin && collectorPaths.has(url.pathname)) {
        if (request.method() === "POST") {
          try {
            events.push(summarizeEvent(JSON.parse(request.postData() ?? "{}"), url.pathname));
          } catch {
            events.push({ collector: url.pathname, type: "INVALID_JSON" });
          }
        }
        return route.fulfill({ status: 204 });
      }
      if (sameOrigin && url.pathname === "/api/reddit/book-vote") {
        return route.fulfill({ json: { score: 8426, readers: 234, vote: 0 } });
      }
      const asset =
        /^\/(?:_next|_nuxt)\//.test(url.pathname) ||
        /\.(?:css|js|mjs|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|json)$/i.test(url.pathname);
      const safeRead =
        sameOrigin &&
        (request.method() === "GET" || request.method() === "HEAD") &&
        !url.pathname.startsWith("/api/") &&
        !/^\/go(?:\/|$)/i.test(url.pathname) &&
        (asset || url.pathname === targetUrl.pathname);
      if (safeRead) {
        allowedRequests.push({ method: request.method(), url: withoutQuery(request.url()) });
        return route.continue();
      }
      blockedRequests.push({ method: request.method(), url: withoutQuery(request.url()) });
      return route.abort();
    });
    if (context.routeWebSocket) await context.routeWebSocket("**/*", (socket) => socket.close());
    const page = await context.newPage();
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin !== targetUrl.origin || response.request().resourceType() !== "script") return;
      assetReads.push(
        response
          .body()
          .then((body) => {
            const source = body.toString("utf8");
            assets.push({
              url: withoutQuery(response.url()),
              sha256: createHash("sha256").update(body).digest("hex"),
              containsTracking: source.includes("AddToCart"),
              ownerMarker: source.includes("__lzeBookTrackingPath"),
              collector: source.includes(target.collector),
            });
          })
          .catch(() => {}),
      );
    });
    try {
      const response = await page.goto(target.url, { waitUntil: "networkidle", timeout: 45_000 });
      assert.equal(response?.status(), 200, "Page must respond successfully");
      const primaryEvents = () => events.filter((event) => event.collector === target.collector);
      await waitUntil(
        () => primaryEvents().some((event) => event.type === "PageView"),
        "No intercepted PageView from updated component",
      );
      const cta = page.locator(`${target.selector}:visible`).first();
      await cta.waitFor({ state: "visible", timeout: 10_000 });
      result.clickedDestination = withoutQuery(await cta.evaluate((link) => link.href));
      // Keep the document/queues available when the CTA is a same-tab /go link.
      // The real click reaches document-capture tracking first; route guards also
      // independently block every retailer and shortlink navigation request.
      await cta.evaluate((link) =>
        link.addEventListener("click", (event) => event.preventDefault(), { once: true }),
      );
      await cta.click();
      await waitUntil(
        () => primaryEvents().some((event) => event.type === "AddToCart"),
        "No intercepted AddToCart from CTA",
      );
      await page.waitForTimeout(600); // Detect a second event from layered handlers.
      const pixels = await pixelState(page);
      result.pixels = pixels;
      for (const name of ["PageView", "AddToCart"]) {
        const server = primaryEvents().filter((event) => event.type === name);
        const pixel = pixels.events.filter((event) => event.type === name);
        assert.equal(server.length, 1, `${name}: exactly one collector event`);
        assert.equal(pixel.length, 1, `${name}: exactly one Meta event`);
        assert.equal(pixel[0].command, "trackSingle", `${name}: isolate configured Meta pixel`);
        assert.equal(pixel[0].id, server[0].id, `${name}: shared browser/server event ID`);
      }
      assert.equal(pixels.ga4.length, 1, "Exactly one GA4 add_to_cart");
      assert.equal(
        pixels.tiktok.filter((event) => event.type === "AddToCart").length,
        1,
        "Exactly one TikTok AddToCart",
      );
      assert.equal(
        pixels.reddit.filter((event) => event.type === "AddToCart").length,
        1,
        "Exactly one Reddit AddToCart",
      );
      if (target.native) {
        const reddit = events.filter((event) => event.collector === "/api/reddit/events");
        assert.equal(reddit.filter((event) => event.type === "PageVisit").length, 1);
        const atc = reddit.filter((event) => event.type === "AddToCart");
        assert.equal(atc.length, 1);
        assert.equal(pixels.reddit.find((event) => event.type === "AddToCart")?.id, atc[0].id);
      }
      await Promise.allSettled(assetReads);
      const prior = baseline.find((entry) => entry.url === target.url);
      const previousScriptList = (prior?.scripts ?? []).join("\n");
      result.newAssetUrls = prior
        ? assets
            .filter((asset) => !previousScriptList.includes(new URL(asset.url).pathname))
            .map((asset) => asset.url)
        : null;
      assert.ok(
        assets.some((asset) => asset.ownerMarker),
        "Loaded assets must include the ownership marker",
      );
      assert.ok(
        assets.some((asset) => asset.collector),
        "Loaded assets must include the expected collector",
      );
      result.status = "passed";
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.pixels ??= await pixelState(page).catch(() => null);
    } finally {
      await Promise.allSettled(assetReads);
      await context.close();
    }
    console.log(
      `${result.status.toUpperCase()} ${target.url}${result.error ? ` — ${result.error}` : ""}`,
    );
  }
} finally {
  await browser.close();
  await mkdir(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `production-tracking-check-${Date.now()}.json`);
  await writeFile(
    outputFile,
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        scope:
          "Loaded production assets and intercepted browser events only; collectors and vendor APIs were never contacted.",
        results,
      },
      null,
      2,
    ),
  );
  console.log(`Report: ${outputFile}`);
}
if (results.some((result) => result.status !== "passed")) process.exitCode = 1;
