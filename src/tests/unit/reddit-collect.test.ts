import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { POST } from "@/app/api/reddit/events/route";
import { createRedditTrackingConfig, verifyRedditContext } from "@/lib/reddit-context";
import { resetEnvCache } from "@/lib/env";
import { prisma } from "@/lib/db";
import { sendRedditCapiEvents } from "@/lib/reddit-capi";

vi.mock("@/lib/db", () => ({ prisma: { tagEvent: { create: vi.fn() } } }));
vi.mock("@/lib/reddit-capi", () => ({ sendRedditCapiEvents: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/server", () => ({
  after: () => {
    throw new Error("outside Next request");
  },
}));

beforeEach(() => {
  vi.stubEnv("APP_SECRET", "x".repeat(64));
  vi.stubEnv("REDDIT_PIXEL_ID", "a2_testpixel");
  vi.stubEnv("REDDIT_CAPI_ACCESS_TOKEN", "test-token");
  vi.stubEnv("REDDIT_CAPI_TEST_ID", "t2_test_only");
  vi.stubEnv("PUBLIC_BASE_URL", "https://lizenzzumerfolg.com");
  vi.stubEnv("CONSENT_COOKIE_NAME", "marketing");
  vi.stubEnv("CONSENT_COOKIE_ACCEPTED_VALUE", "yes");
  resetEnvCache();
  vi.mocked(prisma.tagEvent.create).mockResolvedValue({} as never);
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
  vi.clearAllMocks();
});

function payload(overrides = {}) {
  const config = createRedditTrackingConfig("/das-buch", "required")!;
  return {
    id: "e4e41316-e722-4b21-9fa5-74d7cbd84351",
    type: "PageVisit",
    timestamp: Date.now(),
    context: config.context,
    path: config.path,
    clickId: "3184742045291813272",
    ...overrides,
  };
}
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://lizenzzumerfolg.com/api/reddit/events", {
    method: "POST",
    headers: {
      origin: "https://lizenzzumerfolg.com",
      cookie: "marketing=yes",
      "user-agent": "Mozilla/5.0 Chrome/130 Safari/537.36",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("Reddit-Kontext und Collect", () => {
  it("bindet Route, Pixel und Consent kryptografisch und läuft ab", () => {
    const config = createRedditTrackingConfig("/das-buch", "required")!;
    expect(verifyRedditContext(config.context)?.consentMode).toBe("required");
    expect(verifyRedditContext(config.context, Date.now() + 25 * 60 * 60 * 1000)).toBeNull();
    const [body, signature] = config.context.split(".");
    const changed = JSON.parse(Buffer.from(body!, "base64url").toString());
    changed.consentMode = "not-required";
    expect(
      verifyRedditContext(
        `${Buffer.from(JSON.stringify(changed)).toString("base64url")}.${signature}`,
      ),
    ).toBeNull();
  });
  it("übermittelt ein freigegebenes PageVisit mit exakt der Browser-ID", async () => {
    const body = payload();
    expect((await POST(request(body))).status).toBe(204);
    expect(sendRedditCapiEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        pixelId: "a2_testpixel",
        testId: null,
        clickId: body.clickId,
        events: [{ id: body.id, type: "PageVisit", timestamp: body.timestamp }],
      }),
    );
    expect(prisma.tagEvent.create).toHaveBeenCalledTimes(1);
  });
  it("wendet die konfigurierte Reddit-Test-ID nur auf ausdrücklich markierte Prüfläufe an", async () => {
    await POST(request(payload({ utm: { source: "reddit_capi_verification" } })));
    expect(sendRedditCapiEvents).toHaveBeenCalledWith(
      expect.objectContaining({ testId: "t2_test_only" }),
    );
  });
  it("lehnt fremden Origin und manipulierte Pfade ab", async () => {
    expect((await POST(request(payload(), { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(request(payload({ path: "/gutschein" })))).status).toBe(403);
    expect(sendRedditCapiEvents).not.toHaveBeenCalled();
  });
  it("sendet und speichert nichts bei abgelehntem Consent oder Bots", async () => {
    await POST(request(payload(), { cookie: "marketing=no" }));
    await POST(request(payload(), { "user-agent": "Googlebot" }));
    expect(prisma.tagEvent.create).not.toHaveBeenCalled();
    expect(sendRedditCapiEvents).not.toHaveBeenCalled();
  });
  it("behält den ausdrücklich serverseitig gesetzten Bestands-Consent-Modus", async () => {
    const context = createRedditTrackingConfig("/das-buch", "not-required")!.context;
    await POST(request(payload({ context }), { cookie: "" }));
    expect(sendRedditCapiEvents).toHaveBeenCalledTimes(1);
  });
  it("zählt Likes, veraltete Ereignisse und fremde Ziele nicht als ATC", async () => {
    expect((await POST(request(payload({ type: "Like" })))).status).toBe(400);
    expect((await POST(request(payload({ timestamp: Date.now() - 11 * 60 * 1000 })))).status).toBe(
      400,
    );
    expect(
      (await POST(request(payload({ type: "AddToCart", destination: "https://evil.example" }))))
        .status,
    ).toBe(400);
    expect(sendRedditCapiEvents).not.toHaveBeenCalled();
  });
  it("nimmt nur den konfigurierten Amazon-CTA an", async () => {
    const config = createRedditTrackingConfig("/das-buch", "required")!;
    await POST(request(payload({ type: "AddToCart", destination: config.amazonUrl })));
    expect(sendRedditCapiEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [expect.objectContaining({ type: "AddToCart" })],
      }),
    );
  });
  it("sendet bei atomarem Unique-Konflikt keinen zweiten Serverevent", async () => {
    vi.mocked(prisma.tagEvent.create).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6" }),
    );
    expect((await POST(request(payload()))).status).toBe(204);
    expect(sendRedditCapiEvents).not.toHaveBeenCalled();
  });
  it("meldet DB-Ausfall als Fehler und gibt keine Secrets preis", async () => {
    vi.mocked(prisma.tagEvent.create).mockRejectedValueOnce(new Error("database unavailable"));
    const response = await POST(request(payload()));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(sendRedditCapiEvents).not.toHaveBeenCalled();
  });
});
