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
 * Meta-CAPI-Versand im Redirect-Flow (mit gestubbtem fetch – es verlässt
 * kein Request die Testumgebung).
 */

const originalFetch = globalThis.fetch;

function stubFetch() {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    });
    return new Response(JSON.stringify({ events_received: 2 }), { status: 200 });
  }) as typeof fetch;
  return calls;
}

describe("Meta Conversions API im Redirect-Flow", () => {
  beforeEach(async () => {
    await truncateAll();
    process.env.META_CAPI_ACCESS_TOKEN = "test-capi-token";
    process.env.META_CAPI_TEST_EVENT_CODE = "TEST99999";
    resetEnvCache();
  });

  afterEach(() => {
    delete process.env.META_CAPI_ACCESS_TOKEN;
    delete process.env.META_CAPI_TEST_EVENT_CODE;
    resetEnvCache();
    globalThis.fetch = originalFetch;
  });

  it("sendet für menschliche Klicks mit Consent dieselbe event_id an die Graph API", async () => {
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

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain("graph.facebook.com");
    expect(call.url).toContain("/123456789012345/events");

    const data = call.body.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(2);
    expect(data.map((d) => d.event_name)).toEqual(["PageView", "AmazonOutboundClick"]);

    // Dieselbe event_id wie der gespeicherte Click-Event (Browser-Dedup)
    const { prisma } = await import("@/lib/db");
    const event = await prisma.clickEvent.findFirstOrThrow();
    expect(data[0]?.event_id).toBe(event.id);

    const userData = data[0]?.user_data as Record<string, string>;
    expect(userData.fbp).toBe("fb.1.1700000000000.42");
    expect(userData.fbc).toContain(".TestKlick123");
    expect(userData.client_user_agent).toBeTruthy();
    expect(call.body.test_event_code).toBe("TEST99999");
    expect(call.body.access_token).toBe("test-capi-token");
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

  it("sendet nichts ohne konfiguriertes Token", async () => {
    delete process.env.META_CAPI_ACCESS_TOKEN;
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

  it("ein CAPI-Fehler verhindert die Bridge-Page nicht", async () => {
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
