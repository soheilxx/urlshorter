import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMetaCapiSingle, sendTikTokSingle, type TagCapiEvent } from "@/lib/tag-capi";
import { logger } from "@/lib/logger";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const event: TagCapiEvent = {
  eventId: "26f02632-f006-46b9-983e-366685269196",
  eventName: "add_to_cart",
  eventTimeMs: 1756000000000,
  sourceUrl: "https://example.com/book",
  clientIp: null,
  clientUserAgent: "Mozilla/5.0",
  fbp: "fb.1.1756000000000.123",
  fbc: "fb.1.1756000000000.ClickId",
  ttp: null,
  ttclid: null,
  customData: { content_ids: ["9783690662505"], value: 18, currency: "EUR" },
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function reply(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}
function payload() {
  return JSON.parse(fetchMock.mock.calls[0]![1].body as string);
}

describe("single event provider delivery", () => {
  it.each(["add_to_cart", "addtocart", "AddToCart"])(
    "maps %s to Meta standard AddToCart with the browser ID",
    async (eventName) => {
      reply({ events_received: 1 });
      expect(await sendMetaCapiSingle("123456789", "token", null, { ...event, eventName })).toBe(
        true,
      );
      expect(payload().data[0]).toMatchObject({
        event_name: "AddToCart",
        event_id: event.eventId,
        custom_data: event.customData,
      });
    },
  );
  it("does not report Meta success for zero accepted events or a malformed response", async () => {
    for (const body of [
      { events_received: 0 },
      {},
      { error: { code: 190, message: "token secret" } },
    ]) {
      reply(body);
      expect(await sendMetaCapiSingle("123456789", "token", null, event)).toBe(false);
    }
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("secret");
  });
  it("accepts TikTok only when its response code is zero", async () => {
    reply({ code: 0 });
    expect(await sendTikTokSingle("PIXEL", "token", null, event)).toBe(true);
    expect(payload().data[0]).toMatchObject({ event: "AddToCart", event_id: event.eventId });
    reply({ code: 40002, message: "rejected" });
    expect(await sendTikTokSingle("PIXEL", "token", null, event)).toBe(false);
    reply({});
    expect(await sendTikTokSingle("PIXEL", "token", null, event)).toBe(false);
  });
  it("omits test_event_code in production for both providers", async () => {
    vi.stubEnv("NODE_ENV", "production");
    reply({ events_received: 1 });
    await sendMetaCapiSingle("123456789", "token", "TEST123", event);
    expect(payload().test_event_code).toBeUndefined();
    fetchMock.mockClear();
    reply({ code: 0 });
    await sendTikTokSingle("PIXEL", "token", "TEST123", event);
    expect(payload().test_event_code).toBeUndefined();
  });
  it("returns false on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));
    expect(await sendMetaCapiSingle("123456789", "token", null, event)).toBe(false);
  });
});
