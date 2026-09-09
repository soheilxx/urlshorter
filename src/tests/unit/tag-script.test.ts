import { randomUUID } from "node:crypto";
import { createContext, runInContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/t.js/route";

const mocks = vi.hoisted(() => ({ resolveTagSite: vi.fn() }));
vi.mock("@/lib/tag-sites", () => ({ resolveTagSite: mocks.resolveTagSite }));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    PUBLIC_BASE_URL: "https://lizenzzumerfolg.com",
    META_PIXEL_ID: "111111111111111",
    TIKTOK_PIXEL_ID: "TTPIXEL",
    GA4_MEASUREMENT_ID: "G-TEST",
  }),
}));

async function harness(
  options: {
    url?: string;
    beacon?: boolean | "throw";
    native?: boolean;
    querySite?: boolean;
    brokenMeta?: boolean;
  } = {},
) {
  const location = new URL(options.url ?? "https://www.soheil-hosseini.de/");
  const listeners = new Map<
    string,
    Array<{ callback: (event: unknown) => void; capture?: boolean }>
  >();
  const fbq = vi.fn((..._args: unknown[]) => {
    void _args;
    if (options.brokenMeta) throw new Error("blocked");
  });
  const ttq = { page: vi.fn(), track: vi.fn() };
  const sent: Array<{ url: string; blob: Blob }> = [];
  const fetch = vi.fn().mockResolvedValue({ ok: true });
  const cookieJar = new Map<string, string>();
  const document = {
    currentScript: { getAttribute: () => (options.querySite ? null : "soheil-hosseini") },
    title: "Die Lizenz zum Erfolg",
    referrer: "https://example.org/",
    get cookie() {
      return [...cookieJar].map(([key, value]) => `${key}=${value}`).join("; ");
    },
    set cookie(value: string) {
      const pair = value.split(";")[0]!;
      const pos = pair.indexOf("=");
      cookieJar.set(pair.slice(0, pos), pair.slice(pos + 1));
    },
    createElement: () => ({}),
    head: { appendChild: vi.fn() },
    addEventListener: (name: string, callback: (event: unknown) => void, capture?: boolean) => {
      listeners.set(name, [...(listeners.get(name) ?? []), { callback, capture }]);
    },
  };
  const context = createContext({
    location,
    document,
    navigator: {
      sendBeacon: vi.fn((url: string, blob: Blob) => {
        if (options.beacon === "throw") throw new Error("blocked beacon");
        if (options.beacon === false) return false;
        sent.push({ url, blob });
        return true;
      }),
    },
    history: { pushState: vi.fn(), replaceState: vi.fn() },
    crypto: { randomUUID },
    URL,
    URLSearchParams,
    Blob,
    fetch,
    fbq,
    ttq,
    addEventListener: vi.fn(),
    __lzeBookTrackingPath: options.native ? location.pathname : undefined,
  });
  context.window = context;
  const script = await (
    await GET(
      new Request(
        `https://lizenzzumerfolg.com/t.js${options.querySite ? "?site=soheil-hosseini" : ""}`,
      ),
    )
  ).text();
  runInContext(script, context);
  return {
    context,
    fbq,
    ttq,
    sent,
    fetch,
    listeners,
    cookieJar,
    rerun: () => runInContext(script, context),
    event: (name: string, params = {}) =>
      (context.lze as (cmd: string, name: string, params: object) => void)("event", name, params),
    click: (href: string, props: Record<string, unknown> = {}) => {
      const event = {
        type: "click",
        isTrusted: true,
        button: 0,
        target: { nodeType: 1, closest: () => ({ href }) },
        ...props,
      };
      for (const listener of listeners.get(event.type) ?? []) listener.callback(event);
    },
    payloads: async () =>
      Promise.all(
        sent.map(async ({ blob }) => JSON.parse(await blob.text()) as Record<string, unknown>),
      ),
  };
}

beforeEach(() => {
  mocks.resolveTagSite.mockResolvedValue({
    id: "soheil-hosseini",
    active: true,
    domains: ["soheil-hosseini.de"],
    pixels: {
      meta: "222222222222222",
      ga4: "G-SITE",
      tiktok: "TTPIXEL",
      gtm: null,
      reddit: null,
      linkedin: null,
    },
  });
});

describe("external tracking tag", () => {
  it("initializes the configured pixel when fbq already exists and isolates standard PageView", async () => {
    const h = await harness({ querySite: true });
    expect(h.fbq).toHaveBeenCalledWith("init", "222222222222222");
    const [page] = await h.payloads();
    expect(page).toMatchObject({ site: "soheil-hosseini", name: "page_view" });
    expect(h.fbq).toHaveBeenCalledWith(
      "trackSingle",
      "222222222222222",
      "PageView",
      {},
      { eventID: page!.id },
    );
  });

  it.each([
    "https://link.amazon/B0eyhvaQw?tag=affiliate",
    "https://www.amazon.de/dp/3690662508?tag=affiliate",
    "https://www.amazon.de/book-name/dp/3690662508/ref=sr_1",
    "https://www.thalia.de/shop/home/artikeldetails/A1081265220",
    "https://www.buecher.de/shop/home/artikeldetails/A1081265220",
    "https://www.hugendubel.de/de/buch_kartoniert/soheil_hosseini-die_lizenz_zum_erfolg-54366155-produkt-details.html",
  ])("tracks a known book purchase link once with matching browser/server IDs: %s", async (url) => {
    const h = await harness();
    h.click(url);
    const events = await h.payloads();
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      name: "add_to_cart",
      params: { content_ids: ["9783690662505"], currency: "EUR", value: 18 },
    });
    expect(h.fbq).toHaveBeenCalledWith(
      "trackSingle",
      "111111111111111",
      "AddToCart",
      events[1]!.params,
      { eventID: events[1]!.id },
    );
    expect(h.ttq.track).toHaveBeenCalledWith("AddToCart", expect.any(Object), {
      event_id: events[1]!.id,
    });
    expect(h.listeners.get("click")?.[0]?.capture).toBe(true);
  });

  it("does not classify navigation, unrelated products, spoofed merchants or shortlink hops as another conversion", async () => {
    const h = await harness();
    for (const url of [
      "https://lizenzzumerfolg.com/buch",
      "https://lizenzzumerfolg.com/abcd",
      "https://www.soheil-hosseini.de/#buch",
      "https://www.amazon.de/dp/B012345678",
      "https://amazon.de.evil.example/dp/3690662508",
      "https://www.amazon.de/",
      "https://www.thalia.de/shop/home/artikeldetails/OTHER",
    ])
      h.click(url);
    expect(await h.payloads()).toHaveLength(1);
  });

  it("captures middle-clicks and ignores right-clicks and synthetic clicks", async () => {
    const h = await harness();
    h.click("https://link.amazon/B0eyhvaQw", { isTrusted: false });
    h.click("https://link.amazon/B0eyhvaQw", { type: "auxclick", button: 2 });
    expect(await h.payloads()).toHaveLength(1);
    h.click("https://link.amazon/B0eyhvaQw", { type: "auxclick", button: 1 });
    expect(await h.payloads()).toHaveLength(2);
  });

  it("prevents duplicate installation and automatic plus explicit tracking of the same click", async () => {
    const h = await harness();
    h.rerun();
    h.click("https://link.amazon/B0eyhvaQw");
    h.event("AddToCart");
    h.click("https://link.amazon/B0eyhvaQw");
    expect(await h.payloads()).toHaveLength(2);
    expect(h.listeners.get("click")).toHaveLength(1);
  });

  it("normalizes explicit AddToCart and preserves other custom events", async () => {
    const h = await harness();
    h.event("AddToCart", { value: 18, currency: "EUR" });
    h.event("sample_request");
    expect((await h.payloads()).map((event) => event.name)).toEqual([
      "page_view",
      "add_to_cart",
      "sample_request",
    ]);
    expect(h.fbq).toHaveBeenCalledWith(
      "trackSingleCustom",
      "111111111111111",
      "sample_request",
      {},
      expect.any(Object),
    );
  });

  it.each([false, "throw"] as const)(
    "falls back to fetch when sendBeacon returns %s",
    async (beacon) => {
      const h = await harness({ beacon });
      h.click("https://link.amazon/B0eyhvaQw");
      expect(h.fetch).toHaveBeenCalledTimes(2);
      expect(h.fetch).toHaveBeenLastCalledWith(
        "https://lizenzzumerfolg.com/api/tag/collect",
        expect.objectContaining({ keepalive: true, method: "POST" }),
      );
    },
  );

  it("still collects when the browser pixel throws", async () => {
    const h = await harness({ brokenMeta: true });
    h.click("https://link.amazon/B0eyhvaQw");
    expect(await h.payloads()).toHaveLength(2);
  });

  it("defers to native book tracking on its mounted path", async () => {
    const h = await harness({ native: true });
    h.click("https://link.amazon/B0eyhvaQw");
    expect(await h.payloads()).toHaveLength(0);
  });

  it("rejects a foreign embedding host", async () => {
    const h = await harness({ url: "https://soheil-hosseini.de.evil.example/" });
    expect(await h.payloads()).toHaveLength(0);
    expect(h.fbq).not.toHaveBeenCalled();
  });
});
