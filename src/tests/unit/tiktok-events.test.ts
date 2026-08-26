import { describe, expect, it } from "vitest";
import { buildTikTokEventsPayload, type TikTokEventsInput } from "@/lib/tiktok-events";

function baseInput(overrides: Partial<TikTokEventsInput> = {}): TikTokEventsInput {
  return {
    pixelId: "DA79R2JC77UES9742I10",
    accessToken: "test-tt-token",
    eventId: "11111111-2222-3333-4444-555555555555",
    eventTimeMs: 1_756_000_000_000,
    pageUrl: "https://lizenzzumerfolg.com/abcd",
    clientIp: "203.0.113.10",
    clientUserAgent: "Mozilla/5.0 Test",
    ttclid: "E.Klick-Id_123",
    ttp: "ttp-cookie-wert",
    properties: {
      content_name: "Testlink",
      content_category: "Instagram",
      short_code: "abcd",
      campaign: "Buchlaunch",
      destination_host: "www.amazon.de",
    },
    ...overrides,
  };
}

describe("buildTikTokEventsPayload", () => {
  it("sendet ClickButton mit korrekter Struktur und event_id (Deduplication)", () => {
    const payload = buildTikTokEventsPayload(baseInput());
    expect(payload.event_source).toBe("web");
    expect(payload.event_source_id).toBe("DA79R2JC77UES9742I10");
    expect(payload.data).toHaveLength(1);
    const event = payload.data[0]!;
    expect(event.event).toBe("ClickButton");
    expect(event.event_id).toBe("11111111-2222-3333-4444-555555555555");
    expect(event.event_time).toBe(1_756_000_000);
    expect(event.page.url).toBe("https://lizenzzumerfolg.com/abcd");
    expect(event.properties?.content_name).toBe("Testlink");
  });

  it("überträgt user-Daten (IP, UA, ttclid, ttp)", () => {
    const payload = buildTikTokEventsPayload(baseInput());
    expect(payload.data[0]?.user).toEqual({
      ip: "203.0.113.10",
      user_agent: "Mozilla/5.0 Test",
      ttclid: "E.Klick-Id_123",
      ttp: "ttp-cookie-wert",
    });
  });

  it("lässt fehlende Felder weg und verwirft ungültige ttclid-Werte", () => {
    const payload = buildTikTokEventsPayload(
      baseInput({ clientIp: null, ttclid: 'böse"<script>', ttp: null }),
    );
    expect(payload.data[0]?.user).toEqual({ user_agent: "Mozilla/5.0 Test" });
  });

  it("nimmt den test_event_code nur auf, wenn er gesetzt ist", () => {
    expect(buildTikTokEventsPayload(baseInput()).test_event_code).toBeUndefined();
    expect(buildTikTokEventsPayload(baseInput({ testEventCode: "TEST777" })).test_event_code).toBe(
      "TEST777",
    );
  });

  it("enthält das Access Token NICHT im Payload (wird als Header gesendet)", () => {
    expect(JSON.stringify(buildTikTokEventsPayload(baseInput()))).not.toContain("test-tt-token");
  });
});
