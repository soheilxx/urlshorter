import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { POST } from "@/app/api/book/events/route";
import {
  createBookConversionConfig,
  verifyBookConversionContext,
} from "@/lib/book-conversion-context";
import { prisma } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { sendLinkedInCapiEvent } from "@/lib/linkedin-capi";
import { sendMetaCapiSingle, sendTikTokSingle } from "@/lib/tag-capi";

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
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/server", () => ({
  after: () => {
    throw new Error("outside Next request");
  },
}));

const AMAZON = "https://link.amazon/B0eyhvaQw";

beforeEach(() => {
  vi.stubEnv("APP_SECRET", "x".repeat(64));
  vi.stubEnv("PUBLIC_BASE_URL", "https://lizenzzumerfolg.com");
  vi.stubEnv("META_PIXEL_ID", "123456789012345");
  vi.stubEnv("META_CAPI_ACCESS_TOKEN", "meta-test-token");
  vi.stubEnv("META_CAPI_TEST_EVENT_CODE", "TEST123");
  vi.stubEnv("TIKTOK_PIXEL_ID", "CTESTPIXEL");
  vi.stubEnv("TIKTOK_EVENTS_API_TOKEN", "tiktok-test-token");
  vi.stubEnv("LINKEDIN_PARTNER_ID", "1234567");
  vi.stubEnv("LINKEDIN_CONVERSION_RULE_ID", "urn:lla:llaPartnerConversion:987654");
  vi.stubEnv("LINKEDIN_CAPI_ACCESS_TOKEN", "li-test-token");
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
  const config = createBookConversionConfig("/gewinn", "required")!;
  return {
    id: "6f1c2a4e-9d3b-4c8e-8a6f-2b7d1e5c9a10",
    type: "PageView",
    timestamp: Date.now(),
    context: config.context,
    path: config.path,
    fbp: "fb.1.1700000000000.123456789",
    ...overrides,
  };
}
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://lizenzzumerfolg.com/api/book/events", {
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

describe("Buch-Conversion-Kontext", () => {
  it("bindet Route und Consent kryptografisch, läuft ab und trägt keine Tokens", () => {
    const config = createBookConversionConfig("/gewinn", "required")!;
    expect(config).toMatchObject({
      path: "/gewinn",
      amazonUrl: AMAZON,
      metaPixelId: "123456789012345",
      tiktokPixelId: "CTESTPIXEL",
      linkedInConversionId: "987654",
    });
    expect(JSON.stringify(config)).not.toContain("test-token");
    expect(verifyBookConversionContext(config.context)?.consentMode).toBe("required");
    expect(
      verifyBookConversionContext(config.context, Date.now() + 25 * 60 * 60 * 1000),
    ).toBeNull();
    const [body, signature] = config.context.split(".");
    const changed = JSON.parse(Buffer.from(body!, "base64url").toString());
    changed.consentMode = "not-required";
    expect(
      verifyBookConversionContext(
        `${Buffer.from(JSON.stringify(changed)).toString("base64url")}.${signature}`,
      ),
    ).toBeNull();
  });
  it("liefert ohne konfigurierte Pixel keine Konfiguration", () => {
    vi.stubEnv("META_PIXEL_ID", "");
    vi.stubEnv("TIKTOK_PIXEL_ID", "");
    vi.stubEnv("LINKEDIN_PARTNER_ID", "");
    resetEnvCache();
    expect(createBookConversionConfig("/das-buch", "not-required")).toBeNull();
  });
});

describe("POST /api/book/events", () => {
  it("leitet ein PageView mit exakt der Browser-ID an Meta CAPI weiter (kein TikTok)", async () => {
    const body = payload();
    expect((await POST(request(body))).status).toBe(204);
    expect(sendMetaCapiSingle).toHaveBeenCalledWith(
      "123456789012345",
      "meta-test-token",
      "TEST123",
      expect.objectContaining({
        eventId: body.id,
        eventName: "PageView",
        eventTimeMs: body.timestamp,
        sourceUrl: "https://lizenzzumerfolg.com/gewinn",
        fbp: body.fbp,
        customData: undefined,
      }),
    );
    expect(sendTikTokSingle).not.toHaveBeenCalled();
    expect(sendLinkedInCapiEvent).not.toHaveBeenCalled();
    expect(prisma.tagEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: body.id,
          eventName: "book_page_view",
          path: "/gewinn",
        }),
      }),
    );
  });
  it("meldet einen Amazon-Klick als AddToCart an Meta, TikTok und LinkedIn mit Produktdaten", async () => {
    const body = payload({
      type: "AddToCart",
      destination: AMAZON,
      ctaId: "hero_schritt_1",
      fbclid: "IwAR0abc",
      ttp: "ttp-cookie-1",
      ttclid: "ttclid-1",
      liFatId: "li-fat-id-12345",
    });
    expect((await POST(request(body))).status).toBe(204);
    const contents = expect.objectContaining({
      content_ids: ["9783690662505"],
      value: 18,
      currency: "EUR",
    });
    expect(sendMetaCapiSingle).toHaveBeenCalledWith(
      "123456789012345",
      "meta-test-token",
      "TEST123",
      expect.objectContaining({
        eventId: body.id,
        eventName: "AddToCart",
        fbc: `fb.1.${body.timestamp}.IwAR0abc`,
        customData: contents,
      }),
    );
    expect(sendTikTokSingle).toHaveBeenCalledWith(
      "CTESTPIXEL",
      "tiktok-test-token",
      null,
      expect.objectContaining({
        eventId: body.id,
        eventName: "AddToCart",
        ttp: "ttp-cookie-1",
        ttclid: "ttclid-1",
        properties: expect.objectContaining({ value: 18, currency: "EUR" }),
      }),
    );
    expect(sendLinkedInCapiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        conversionRuleId: "urn:lla:llaPartnerConversion:987654",
        eventId: body.id,
        liFatId: "li-fat-id-12345",
      }),
    );
    expect(prisma.tagEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventName: "book_add_to_cart" }) }),
    );
  });
  it("sendet LinkedIn ohne Klick-ID nicht und TikTok ohne Token nicht", async () => {
    vi.stubEnv("TIKTOK_EVENTS_API_TOKEN", "");
    resetEnvCache();
    await POST(request(payload({ type: "AddToCart", destination: AMAZON })));
    expect(sendMetaCapiSingle).toHaveBeenCalledTimes(1);
    expect(sendTikTokSingle).not.toHaveBeenCalled();
    expect(sendLinkedInCapiEvent).not.toHaveBeenCalled();
  });
  it("lehnt fremden Origin und manipulierte Pfade ab", async () => {
    expect((await POST(request(payload(), { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(request(payload({ path: "/gutschein" })))).status).toBe(403);
    expect(sendMetaCapiSingle).not.toHaveBeenCalled();
  });
  it("akzeptiert den Browser-Origin auch hinter Proxy oder lokalem next start (Host-Header)", async () => {
    const body = JSON.stringify(payload());
    const headers = {
      cookie: "marketing=yes",
      "user-agent": "Mozilla/5.0 Chrome/130 Safari/537.36",
    };
    const local = new Request("http://localhost:3100/api/book/events", {
      method: "POST",
      headers: { ...headers, host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" },
      body,
    });
    expect((await POST(local)).status).toBe(204);
    const proxied = new Request("http://internal:3000/api/book/events", {
      method: "POST",
      headers: {
        ...headers,
        "x-forwarded-proto": "https",
        "x-forwarded-host": "lizenzzumerfolg.com",
        origin: "https://lizenzzumerfolg.com",
      },
      body,
    });
    expect((await POST(proxied)).status).toBe(204);
    const foreign = new Request("http://localhost:3100/api/book/events", {
      method: "POST",
      headers: { ...headers, host: "127.0.0.1:3100", origin: "http://evil.example" },
      body,
    });
    expect((await POST(foreign)).status).toBe(403);
  });
  it("sendet und speichert nichts bei abgelehntem Consent oder Bots", async () => {
    await POST(request(payload(), { cookie: "marketing=no" }));
    await POST(request(payload(), { "user-agent": "Googlebot" }));
    expect(prisma.tagEvent.create).not.toHaveBeenCalled();
    expect(sendMetaCapiSingle).not.toHaveBeenCalled();
  });
  it("behält den serverseitig gesetzten Consent-Modus not-required", async () => {
    const context = createBookConversionConfig("/das-buch", "not-required")!.context;
    await POST(request(payload({ context, path: "/das-buch" }), { cookie: "" }));
    expect(sendMetaCapiSingle).toHaveBeenCalledTimes(1);
  });
  it("verwirft unbekannte Typen, veraltete Ereignisse, fremde Ziele und ATC auf der Root-Seite", async () => {
    expect((await POST(request(payload({ type: "Purchase" })))).status).toBe(400);
    expect((await POST(request(payload({ timestamp: Date.now() - 11 * 60 * 1000 })))).status).toBe(
      400,
    );
    expect(
      (await POST(request(payload({ type: "AddToCart", destination: "https://evil.example" }))))
        .status,
    ).toBe(400);
    const root = createBookConversionConfig("/", "not-required")!;
    expect(
      (
        await POST(
          request(
            payload({ type: "AddToCart", destination: AMAZON, context: root.context, path: "/" }),
          ),
        )
      ).status,
    ).toBe(400);
    expect(sendMetaCapiSingle).not.toHaveBeenCalled();
  });
  it("sendet bei atomarem Unique-Konflikt keinen zweiten Serverevent", async () => {
    vi.mocked(prisma.tagEvent.create).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6" }),
    );
    expect((await POST(request(payload()))).status).toBe(204);
    expect(sendMetaCapiSingle).not.toHaveBeenCalled();
  });
  it("meldet DB-Ausfall als 503 ohne Body", async () => {
    vi.mocked(prisma.tagEvent.create).mockRejectedValueOnce(new Error("database unavailable"));
    const response = await POST(request(payload()));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(sendMetaCapiSingle).not.toHaveBeenCalled();
  });
  it("antwortet ohne Meta-Token weiterhin 204 und sendet nichts", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    resetEnvCache();
    expect((await POST(request(payload()))).status).toBe(204);
    expect(sendMetaCapiSingle).not.toHaveBeenCalled();
    expect(prisma.tagEvent.create).toHaveBeenCalledTimes(1);
  });
});
