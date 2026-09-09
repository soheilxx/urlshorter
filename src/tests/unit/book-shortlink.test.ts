import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/[code]/route";
import { prisma } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { resolveBookSite } from "@/lib/book-conversion-context";
import { sendMetaCapiEvents } from "@/lib/meta-capi";
import { sendTikTokEvents } from "@/lib/tiktok-events";
import { sendRedditCapiEvents, buildRedditCapiPayload } from "@/lib/reddit-capi";

vi.mock("@/lib/db", () => ({
  prisma: {
    shortLink: { findUnique: vi.fn() },
    clickEvent: { create: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock("@/lib/book-conversion-context", () => ({ resolveBookSite: vi.fn() }));
vi.mock("@/lib/settings", () => ({ getRedirectDelayMs: vi.fn().mockResolvedValue(900) }));
vi.mock("@/lib/meta-capi", async (original) => ({
  ...(await original<typeof import("@/lib/meta-capi")>()),
  sendMetaCapiEvents: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/tiktok-events", () => ({ sendTikTokEvents: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/reddit-capi", async (original) => ({
  ...(await original<typeof import("@/lib/reddit-capi")>()),
  sendRedditCapiEvents: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/linkedin-capi", () => ({
  isValidLiFatId: () => false,
  sendLinkedInCapiEvent: vi.fn(),
}));
vi.mock("next/server", () => ({
  after: () => {
    throw new Error("outside request");
  },
}));

const site = {
  active: true,
  metaPixelId: "999888777",
  metaToken: "dashboard-token",
  metaTestEventCode: null,
  tiktokPixelId: "TESTTIKTOK1234567890",
  tiktokToken: "dashboard-tiktok",
  tiktokTestEventCode: null,
  ga4MeasurementId: "G-12345678",
  gtmContainerId: null,
  linkedInPartnerId: null,
};
const destination = "https://link.amazon/B0eyhvaQw";
const link = {
  id: "link",
  code: "abcd",
  name: "Book",
  source: "instagram",
  destinationId: "dest",
  active: true,
  expiresAt: null,
  medium: null,
  campaign: null,
  content: null,
  destination: { url: destination, host: "link.amazon", active: true },
};
function request(cookie = "marketing=yes", userAgent = "Mozilla/5.0 Chrome/130 Safari/537.36") {
  return new Request("https://lizenzzumerfolg.com/abcd?fbclid=NewAdClick", {
    headers: { cookie, "user-agent": userAgent },
  });
}
const routeContext = { params: Promise.resolve({ code: "abcd" }) };
beforeEach(() => {
  vi.stubEnv("APP_SECRET", "x".repeat(64));
  vi.stubEnv("PUBLIC_BASE_URL", "https://lizenzzumerfolg.com");
  vi.stubEnv("TRACKING_CONSENT_MODE", "required");
  vi.stubEnv("CONSENT_COOKIE_NAME", "marketing");
  vi.stubEnv("CONSENT_COOKIE_ACCEPTED_VALUE", "yes");
  vi.stubEnv("REDDIT_PIXEL_ID", "a2_testpixel123");
  vi.stubEnv("REDDIT_CAPI_ACCESS_TOKEN", "test-reddit-token");
  vi.stubEnv("REDDIT_CAPI_TEST_ID", "configured-test-id-must-not-leak-to-live-events");
  resetEnvCache();
  vi.mocked(prisma.shortLink.findUnique).mockResolvedValue(link as never);
  vi.mocked(resolveBookSite).mockResolvedValue(site);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  resetEnvCache();
});

describe("book shortlink conversion", () => {
  it("sends Reddit book AddToCart with the bridge conversion ID and verified provider payload", async () => {
    const response = await GET(
      new Request("https://lizenzzumerfolg.com/abcd?rdt_cid=NewRedditClick", {
        headers: {
          cookie: "marketing=yes; _rdt_cid=OldRedditClick; _rdt_uuid=RedditVisitor123",
          "user-agent": "Mozilla/5.0 Chrome/130 Safari/537.36",
          "x-forwarded-for": "203.0.113.10",
        },
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(sendRedditCapiEvents).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(sendRedditCapiEvents).mock.calls[0]![0];
    const html = await response.text();
    expect(sent).toMatchObject({
      pixelId: "a2_testpixel123",
      accessToken: "test-reddit-token",
      clickId: "NewRedditClick",
      uuid: "RedditVisitor123",
    });
    expect(sent.events).toHaveLength(1);
    expect(sent.events[0]?.type).toBe("AddToCart");
    expect(html).toContain(`"event_id":"${sent.events[0]!.id}"`);
    expect(html).not.toContain("test-reddit-token");
    const payload = buildRedditCapiPayload(sent);
    expect(payload.data.events[0]).toMatchObject({
      type: { tracking_type: "ADD_TO_CART" },
      metadata: { conversion_id: sent.events[0]!.id },
      click_id: "NewRedditClick",
      user: { uuid: "RedditVisitor123", ip_address: "203.0.113.10" },
    });
    expect(payload.data).not.toHaveProperty("test_id");
  });

  it("does not send Reddit CAPI without its configured token", async () => {
    vi.stubEnv("REDDIT_CAPI_ACCESS_TOKEN", "");
    resetEnvCache();
    await GET(request(), routeContext);
    expect(sendRedditCapiEvents).not.toHaveBeenCalled();
  });
  it("uses dashboard pixels and shares one standard AddToCart ID with the bridge", async () => {
    const response = await GET(
      request("marketing=yes; malformed=%E0%A4; _fbc=fb.1.1700000000000.OldAdClick"),
      routeContext,
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    const sent = vi.mocked(sendMetaCapiEvents).mock.calls[0]![0];
    expect(sent).toMatchObject({
      pixelId: site.metaPixelId,
      accessToken: site.metaToken,
      outboundEventName: "AddToCart",
      customData: { content_ids: ["9783690662505"], value: 18, currency: "EUR" },
    });
    expect(sent.fbc).toMatch(/^fb\.1\.\d{13}\.NewAdClick$/);
    expect(html).toContain(`"event_id":"${sent.eventId}"`);
    expect(html).toContain(`"meta":"${site.metaPixelId}"`);
    expect(html).not.toContain("dashboard-token");
    expect(sendTikTokEvents).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "AddToCart", eventId: sent.eventId }),
    );
  });
  it("keeps ordinary non-book redirects as outbound clicks", async () => {
    vi.stubEnv("META_PIXEL_ID", "123456789");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "env-token");
    resetEnvCache();
    vi.mocked(prisma.shortLink.findUnique).mockResolvedValue({
      ...link,
      destination: { ...link.destination, url: "https://www.amazon.de/dp/B0OTHER123" },
    } as never);
    await GET(request(), routeContext);
    expect(resolveBookSite).not.toHaveBeenCalled();
    expect(sendRedditCapiEvents).not.toHaveBeenCalled();
    expect(sendMetaCapiEvents).toHaveBeenCalledWith(
      expect.objectContaining({ outboundEventName: "AmazonOutboundClick" }),
    );
  });
  it.each([
    ["marketing=no", "Mozilla/5.0 Chrome/130 Safari/537.36"],
    ["marketing=yes", "Googlebot"],
  ])("does not send marketing events for denied consent or bots", async (cookie, ua) => {
    await GET(request(cookie, ua), routeContext);
    expect(sendMetaCapiEvents).not.toHaveBeenCalled();
    expect(sendTikTokEvents).not.toHaveBeenCalled();
    expect(sendRedditCapiEvents).not.toHaveBeenCalled();
  });
  it("does not override a disabled dashboard site with fallback environment pixels", async () => {
    vi.mocked(resolveBookSite).mockResolvedValue({
      ...site,
      active: false,
      metaPixelId: null,
      metaToken: null,
      tiktokPixelId: null,
      tiktokToken: null,
      ga4MeasurementId: null,
    });
    const html = await (await GET(request(), routeContext)).text();
    expect(html).toContain('"meta":null');
    expect(html).toContain('"ga4":null');
    expect(sendMetaCapiEvents).not.toHaveBeenCalled();
    expect(sendRedditCapiEvents).not.toHaveBeenCalled();
  });
});
