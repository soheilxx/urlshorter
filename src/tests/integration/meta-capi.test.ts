import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/[code]/route";
import { resetEnvCache } from "@/lib/env";
import {
  BOT_UA,
  buildRedirectRequest,
  createTestDestination,
  createTestLink,
  routeContext,
  truncateAll,
} from "./helpers";

/**
 * Serverseitige Event-APIs (Meta CAPI + TikTok Events API) im Redirect-Flow –
 * mit gestubbtem fetch, es verlässt kein Request die Testumgebung.
 */

const originalFetch = globalThis.fetch;

interface CapturedCall {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function stubFetch(): CapturedCall[] {
  const calls: CapturedCall[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {})),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    });
    return new Response(JSON.stringify({ events_received: 2, code: 0 }), { status: 200 });
  }) as typeof fetch;
  return calls;
}

describe("Serverseitige Event-APIs im Redirect-Flow", () => {
  beforeEach(async () => {
    await truncateAll();
    process.env.META_CAPI_ACCESS_TOKEN = "test-capi-token";
    process.env.META_CAPI_TEST_EVENT_CODE = "TEST99999";
    process.env.TIKTOK_EVENTS_API_TOKEN = "test-tiktok-token";
    resetEnvCache();
  });

  afterEach(() => {
    delete process.env.META_CAPI_ACCESS_TOKEN;
    delete process.env.META_CAPI_TEST_EVENT_CODE;
    delete process.env.TIKTOK_EVENTS_API_TOKEN;
    resetEnvCache();
    globalThis.fetch = originalFetch;
  });

  it("Meta CAPI: sendet für menschliche Klicks mit Consent dieselbe event_id", async () => {
    const calls = stubFetch();
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    const response = await GET(
      buildRedirectRequest("abcd", {
        cookie: "marketing_consent=accepted; _fbp=fb.1.1700000000000.42",
        query: "?fbclid=TestKlick123",
      }),
      routeContext("abcd"),
    );
    expect(response.status).toBe(200);

    const metaCalls = calls.filter((c) => c.url.includes("graph.facebook.com"));
    expect(metaCalls).toHaveLength(1);
    const call = metaCalls[0]!;
    expect(call.url).toContain("/123456789012345/events");

    const data = call.body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(2);
    expect(data.map((d) => d.event_name)).toEqual(["PageView", "AmazonOutboundClick"]);

    const { prisma } = await import("@/lib/db");
    const event = await prisma.clickEvent.findFirstOrThrow();
    expect(data[0]?.event_id).toBe(event.id);

    const userData = data[0]?.user_data as Record<string, string>;
    expect(userData.fbp).toBe("fb.1.1700000000000.42");
    expect(userData.fbc).toContain(".TestKlick123");
    expect(call.body.test_event_code).toBe("TEST99999");
    expect(call.body.access_token).toBe("test-capi-token");
  });

  it("TikTok Events API: sendet ClickButton mit derselben event_id und ttclid", async () => {
    const calls = stubFetch();
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    await GET(
      buildRedirectRequest("abcd", {
        cookie: "marketing_consent=accepted; _ttp=TtpCookie42",
        query: "?ttclid=TikTokKlick_987",
      }),
      routeContext("abcd"),
    );

    const ttCalls = calls.filter((c) => c.url.includes("business-api.tiktok.com"));
    expect(ttCalls).toHaveLength(1);
    const call = ttCalls[0]!;
    expect(call.headers["Access-Token"]).toBe("test-tiktok-token");
    expect(call.body.event_source).toBe("web");
    expect(call.body.event_source_id).toBe("TESTTIKTOK1234567890");

    const data = call.body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0]?.event).toBe("ClickButton");

    const { prisma } = await import("@/lib/db");
    const event = await prisma.clickEvent.findFirstOrThrow();
    expect(data[0]?.event_id).toBe(event.id);

    const user = data[0]?.user as Record<string, string>;
    expect(user.ttclid).toBe("TikTokKlick_987");
    expect(user.ttp).toBe("TtpCookie42");
    expect(user.user_agent).toBeTruthy();
  });

  it("sendet nichts ohne Consent", async () => {
    const calls = stubFetch();
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    await GET(buildRedirectRequest("abcd"), routeContext("abcd"));
    expect(calls).toHaveLength(0);
  });

  it("sendet nichts für Bots", async () => {
    const calls = stubFetch();
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    await GET(
      buildRedirectRequest("abcd", {
        userAgent: BOT_UA,
        cookie: "marketing_consent=accepted",
      }),
      routeContext("abcd"),
    );
    expect(calls).toHaveLength(0);
  });

  it("sendet nichts ohne konfigurierte Tokens", async () => {
    delete process.env.META_CAPI_ACCESS_TOKEN;
    delete process.env.TIKTOK_EVENTS_API_TOKEN;
    resetEnvCache();
    const calls = stubFetch();
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    await GET(
      buildRedirectRequest("abcd", { cookie: "marketing_consent=accepted" }),
      routeContext("abcd"),
    );
    expect(calls).toHaveLength(0);
  });

  it("API-Fehler verhindern die Bridge-Page nicht", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Netzwerkfehler simuliert");
    }) as typeof fetch;

    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    const response = await GET(
      buildRedirectRequest("abcd", { cookie: "marketing_consent=accepted" }),
      routeContext("abcd"),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Jetzt zu Amazon");
  });
});
