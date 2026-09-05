import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRedditCapiPayload,
  sendRedditCapiEvents,
  type RedditCapiInput,
} from "@/lib/reddit-capi";
import { logger } from "@/lib/logger";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const base: RedditCapiInput = {
  pixelId: "a2_testpixel",
  accessToken: "secret-never-log",
  sourceUrl: "https://lizenzzumerfolg.com/das-buch?email=private@example.com#x",
  events: [
    { id: "e4e41316-e722-4b21-9fa5-74d7cbd84351", type: "AddToCart", timestamp: 1_780_000_000_000 },
  ],
  clickId: "3184742045291813272",
  uuid: "user-cookie",
  clientIp: "203.0.113.1",
  clientUserAgent: "Mozilla/5.0",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Reddit CAPI v3", () => {
  it("verwendet v3-Felder, Millisekunden, dieselbe ID und keine Umsatzbehauptung", () => {
    const payload = buildRedditCapiPayload(base);
    expect(payload.data.events[0]).toMatchObject({
      event_at: base.events[0]!.timestamp,
      action_source: "WEBSITE",
      event_source_url: "https://lizenzzumerfolg.com/das-buch",
      click_id: "3184742045291813272",
      type: { tracking_type: "ADD_TO_CART" },
      metadata: { conversion_id: base.events[0]!.id },
      user: { ip_address: "203.0.113.1", uuid: "user-cookie" },
    });
    expect(payload.data.events[0]!.metadata).not.toHaveProperty("value");
    expect(JSON.stringify(payload)).not.toMatch(/secret-never-log|private@example|event_type/);
  });
  it("mappt PageVisit und Custom: OutboundClick ohne sie in ATC umzuwandeln", () => {
    const payload = buildRedditCapiPayload({
      ...base,
      events: [
        { ...base.events[0]!, type: "PageVisit" },
        { ...base.events[0]!, type: "OutboundClick", id: "other-id" },
      ],
    });
    expect(payload.data.events.map((e) => e.type)).toEqual([
      { tracking_type: "PAGE_VISIT" },
      { tracking_type: "CUSTOM", custom_event_name: "OutboundClick" },
    ]);
  });
  it("verwirft ungültige Matchwerte und trennt Test- von Produktionsevents", () => {
    const input = { ...base, clientIp: "not-an-ip", uuid: "<script>", clickId: "bad id" };
    expect(buildRedditCapiPayload(input).data).not.toHaveProperty("test_id");
    const payload = buildRedditCapiPayload({ ...input, testId: "test-only" });
    expect(payload.data.test_id).toBe("test-only");
    expect(payload.data.events[0]).not.toHaveProperty("click_id");
    expect(payload.data.events[0]!.user).toEqual({ user_agent: "Mozilla/5.0" });
  });
  it("sendet das Token nur als Bearer an Reddit und akzeptiert eine gültige Bestätigung", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: { message: "Successfully processed 1 conversion events." } }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await sendRedditCapiEvents(base)).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://ads-api.reddit.com/api/v3/pixels/a2_testpixel/conversion_events",
      expect.objectContaining({
        redirect: "error",
        headers: { "Content-Type": "application/json", Authorization: "Bearer secret-never-log" },
      }),
    );
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(base.accessToken);
  });
  it("wiederholt Authentifizierungsfehler nicht und loggt keine Anbieterantwort", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(base.accessToken, { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    expect(await sendRedditCapiEvents(base)).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(base.accessToken);
  });
  it("wiederholt einen 503 mit identischem Body und identischer Conversion-ID", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ data: { message: "accepted" } }));
    vi.stubGlobal("fetch", fetch);
    const sent = sendRedditCapiEvents(base);
    await vi.runAllTimersAsync();
    expect(await sent).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![1].body).toBe(fetch.mock.calls[1]![1].body);
  });
  it("meldet keine Scheinerfolge bei leerem 200 oder fehlendem Token", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    expect(await sendRedditCapiEvents(base)).toBe(false);
    expect(await sendRedditCapiEvents({ ...base, accessToken: "" })).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
