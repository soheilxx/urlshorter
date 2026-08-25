import { describe, expect, it } from "vitest";
import { buildMetaCapiPayload, deriveFbc, type MetaCapiInput } from "@/lib/meta-capi";

function baseInput(overrides: Partial<MetaCapiInput> = {}): MetaCapiInput {
  return {
    pixelId: "123456789012345",
    accessToken: "test-token",
    eventId: "11111111-2222-3333-4444-555555555555",
    eventTimeMs: 1_756_000_000_000,
    eventSourceUrl: "https://lizenzzumerfolg.com/abcd",
    clientIp: "203.0.113.10",
    clientUserAgent: "Mozilla/5.0 Test",
    fbp: "fb.1.1700000000000.123456789",
    fbc: "fb.1.1700000000000.AbCdEf",
    customData: {
      short_code: "abcd",
      link_name: "Testlink",
      source: "Instagram",
      medium: "social",
      campaign: "Buchlaunch",
      content: "",
      destination_host: "www.amazon.de",
    },
    ...overrides,
  };
}

describe("buildMetaCapiPayload", () => {
  it("sendet PageView und AmazonOutboundClick mit derselben event_id (Deduplication)", () => {
    const payload = buildMetaCapiPayload(baseInput());
    expect(payload.data).toHaveLength(2);
    expect(payload.data[0]?.event_name).toBe("PageView");
    expect(payload.data[1]?.event_name).toBe("AmazonOutboundClick");
    expect(payload.data[0]?.event_id).toBe("11111111-2222-3333-4444-555555555555");
    expect(payload.data[1]?.event_id).toBe("11111111-2222-3333-4444-555555555555");
    expect(payload.data[0]?.action_source).toBe("website");
    expect(payload.data[0]?.event_time).toBe(1_756_000_000);
    expect(payload.data[0]?.event_source_url).toBe("https://lizenzzumerfolg.com/abcd");
  });

  it("überträgt user_data (IP, UA, fbp, fbc) und custom_data", () => {
    const payload = buildMetaCapiPayload(baseInput());
    expect(payload.data[0]?.user_data).toEqual({
      client_ip_address: "203.0.113.10",
      client_user_agent: "Mozilla/5.0 Test",
      fbp: "fb.1.1700000000000.123456789",
      fbc: "fb.1.1700000000000.AbCdEf",
    });
    expect(payload.data[1]?.custom_data?.source).toBe("Instagram");
    expect(payload.data[0]?.custom_data).toBeUndefined();
  });

  it("lässt fehlende Felder weg statt leere Werte zu senden", () => {
    const payload = buildMetaCapiPayload(baseInput({ fbp: null, fbc: null, clientIp: null }));
    expect(payload.data[0]?.user_data).toEqual({ client_user_agent: "Mozilla/5.0 Test" });
  });

  it("nimmt den test_event_code nur auf, wenn er gesetzt ist", () => {
    expect(buildMetaCapiPayload(baseInput()).test_event_code).toBeUndefined();
    expect(buildMetaCapiPayload(baseInput({ testEventCode: "TEST12345" })).test_event_code).toBe(
      "TEST12345",
    );
  });

  it("enthält das Access Token NICHT im Payload-Objekt (wird separat übergeben)", () => {
    const payload = buildMetaCapiPayload(baseInput());
    expect(JSON.stringify(payload)).not.toContain("test-token");
  });
});

describe("deriveFbc", () => {
  it("bevorzugt das vorhandene _fbc-Cookie", () => {
    expect(deriveFbc("KlickId123", "fb.1.1700000000000.CookieWert")).toBe(
      "fb.1.1700000000000.CookieWert",
    );
  });

  it("leitet fbc aus fbclid im offiziellen Format ab", () => {
    expect(deriveFbc("AbC-123_xyz", null, 1_756_000_000_000)).toBe(
      "fb.1.1756000000000.AbC-123_xyz",
    );
  });

  it("liefert null ohne fbclid und Cookie", () => {
    expect(deriveFbc(null, null)).toBeNull();
    expect(deriveFbc("", "")).toBeNull();
  });

  it("verwirft fbclid mit unerlaubten Zeichen", () => {
    expect(deriveFbc('abc"<script>', null)).toBeNull();
  });
});
