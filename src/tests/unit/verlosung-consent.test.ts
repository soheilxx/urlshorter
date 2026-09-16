import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/book/events/route";
import {
  createBookConversionConfig,
  verifyBookConversionContext,
} from "@/lib/book-conversion-context";
import { prisma } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { createRedditTrackingConfig, verifyRedditContext } from "@/lib/reddit-context";
import { sendMetaCapiSingle } from "@/lib/tag-capi";

vi.mock("@/lib/db", () => ({
  prisma: { tagEvent: { create: vi.fn(), update: vi.fn().mockResolvedValue({}) } },
}));
vi.mock("@/lib/tag-capi", () => ({
  sendMetaCapiSingle: vi.fn().mockResolvedValue(true),
  sendTikTokSingle: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/linkedin-capi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/linkedin-capi")>()),
  sendLinkedInCapiEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/tag-sites", () => ({ resolveTagSite: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/server", () => ({
  after: () => {
    throw new Error("outside Next request");
  },
}));

/**
 * /verlosung im Buch-Conversion-Collector: Route ist in der Allowlist, der
 * Consent-Modus "required" wird serverseitig über das First-Party-Cookie des
 * Consent-Banners (Default lze_marketing_consent) durchgesetzt – auch ohne
 * Env-Konfiguration eines externen Consent-Cookies.
 */

beforeEach(() => {
  vi.stubEnv("APP_SECRET", "x".repeat(64));
  vi.stubEnv("PUBLIC_BASE_URL", "https://lizenzzumerfolg.com");
  vi.stubEnv("META_PIXEL_ID", "123456789012345");
  vi.stubEnv("META_CAPI_ACCESS_TOKEN", "meta-test-token");
  vi.stubEnv("TIKTOK_PIXEL_ID", "CTESTPIXEL");
  vi.stubEnv("TIKTOK_EVENTS_API_TOKEN", "tiktok-test-token");
  vi.stubEnv("REDDIT_PIXEL_ID", "a2_testpixel1");
  vi.stubEnv("CONSENT_COOKIE_NAME", "");
  vi.stubEnv("CONSENT_COOKIE_ACCEPTED_VALUE", "");
  resetEnvCache();
  vi.mocked(prisma.tagEvent.create).mockResolvedValue({} as never);
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
  vi.clearAllMocks();
});

async function verlosungPayload() {
  const config = (await createBookConversionConfig("/verlosung", "required"))!;
  return {
    id: "6f1c2a4e-9d3b-4c8e-8a6f-2b7d1e5c9a10",
    type: "PageView",
    timestamp: Date.now(),
    context: config.context,
    path: config.path,
  };
}

function request(body: unknown, cookie: string) {
  return new Request("https://lizenzzumerfolg.com/api/book/events", {
    method: "POST",
    headers: {
      origin: "https://lizenzzumerfolg.com",
      cookie,
      "user-agent": "Mozilla/5.0 Chrome/130 Safari/537.36",
    },
    body: JSON.stringify(body),
  });
}

describe("/verlosung in den Tracking-Allowlisten", () => {
  it("signiert Buch- und Reddit-Kontext für /verlosung mit Consent-Modus 'required'", async () => {
    const book = (await createBookConversionConfig("/verlosung", "required"))!;
    expect(verifyBookConversionContext(book.context)).toMatchObject({
      path: "/verlosung",
      consentMode: "required",
    });
    const reddit = createRedditTrackingConfig("/verlosung", "required")!;
    expect(verifyRedditContext(reddit.context)).toMatchObject({
      path: "/verlosung",
      consentMode: "required",
    });
  });
});

describe("/api/book/events: Consent-Cookie des Banners für /verlosung", () => {
  it("ohne Entscheidung: 204, aber nichts gespeichert und nichts gesendet", async () => {
    expect((await POST(request(await verlosungPayload(), ""))).status).toBe(204);
    expect(prisma.tagEvent.create).not.toHaveBeenCalled();
    expect(sendMetaCapiSingle).not.toHaveBeenCalled();
  });
  it("abgelehnt: nichts gespeichert", async () => {
    expect(
      (await POST(request(await verlosungPayload(), "lze_marketing_consent=denied"))).status,
    ).toBe(204);
    expect(prisma.tagEvent.create).not.toHaveBeenCalled();
  });
  it("zugestimmt: PageView gespeichert und an Meta CAPI weitergereicht", async () => {
    const body = await verlosungPayload();
    expect((await POST(request(body, "lze_marketing_consent=accepted"))).status).toBe(204);
    expect(prisma.tagEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: body.id, path: "/verlosung", eventName: "book_page_view" }),
      }),
    );
    expect(sendMetaCapiSingle).toHaveBeenCalledTimes(1);
  });
  it("ein extern konfigurierter Consent-Cookie ersetzt den Banner-Default", async () => {
    vi.stubEnv("CONSENT_COOKIE_NAME", "cmp");
    vi.stubEnv("CONSENT_COOKIE_ACCEPTED_VALUE", "yes");
    resetEnvCache();
    const body = await verlosungPayload();
    expect((await POST(request(body, "lze_marketing_consent=accepted"))).status).toBe(204);
    expect(prisma.tagEvent.create).not.toHaveBeenCalled();
    expect((await POST(request(body, "cmp=yes"))).status).toBe(204);
    expect(prisma.tagEvent.create).toHaveBeenCalledTimes(1);
  });
});
