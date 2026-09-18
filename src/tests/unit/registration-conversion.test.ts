import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { evaluateConsent, readCookieValue } from "@/lib/consent";
import { resetEnvCache } from "@/lib/env";
import {
  hasRegistrationTrackingConsent,
  REGISTRATION_EVENT_NAME,
  sendRegistrationConversion,
} from "@/lib/registration-conversion";
import { sendMetaCapiSingle, sendTikTokSingle } from "@/lib/tag-capi";

vi.mock("@/lib/db", () => ({
  prisma: { tagEvent: { create: vi.fn(), update: vi.fn().mockResolvedValue({}) } },
}));
vi.mock("@/lib/tag-capi", () => ({
  sendMetaCapiSingle: vi.fn().mockResolvedValue(true),
  sendTikTokSingle: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/tag-sites", () => ({ resolveTagSite: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const EVENT_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function input(overrides: Partial<Parameters<typeof sendRegistrationConversion>[0]> = {}) {
  return {
    eventId: EVENT_ID,
    campaign: "dubai_2026" as const,
    landingPath: "/verlosung" as const,
    eventTimeMs: 1_760_000_000_000,
    clientIp: "203.0.113.7",
    userAgent: CHROME,
    cookieHeader: "lze_marketing_consent=accepted; _fbp=fb.1.1700000000000.123456789; _ttp=ttp123",
    utm: { source: "adcloud", medium: "email", campaign: "buch_verlosung_2026", content: null, term: null },
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("APP_SECRET", "x".repeat(64));
  vi.stubEnv("PUBLIC_BASE_URL", "https://lizenzzumerfolg.com");
  vi.stubEnv("META_PIXEL_ID", "123456789012345");
  vi.stubEnv("META_CAPI_ACCESS_TOKEN", "meta-test-token");
  vi.stubEnv("TIKTOK_PIXEL_ID", "CTESTPIXEL");
  vi.stubEnv("TIKTOK_EVENTS_API_TOKEN", "tiktok-test-token");
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

describe("Registrierungsevent (Server): Consent-Modus je Teilnahmeweg", () => {
  it("Betreiber-Entscheidung: /verlosung und /gewinn senden ohne Cookie-Entscheidung (not-required)", async () => {
    expect(hasRegistrationTrackingConsent("/verlosung", null)).toBe(true);
    expect(hasRegistrationTrackingConsent("/gewinn", null)).toBe(true);
    const r = await sendRegistrationConversion(input({ cookieHeader: null }));
    expect(r).toEqual({ sent: true });
    expect(prisma.tagEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ path: "/verlosung" }) }),
    );
  });

  it("auch ein abgelehnter Consent-Cookie stoppt das Event im Modus not-required nicht", async () => {
    const r = await sendRegistrationConversion(
      input({ cookieHeader: "lze_marketing_consent=denied; _fbp=fb.1.1.1" }),
    );
    expect(r.sent).toBe(true);
    expect(sendMetaCapiSingle).toHaveBeenCalledTimes(1);
  });

  it("der Consent-Cookie wird ausgewertet, sobald ein Weg auf 'required' steht", () => {
    // Mechanik bleibt erhalten: mit "required" würde nur der akzeptierte Cookie freigeben.
    expect(
      evaluateConsent({
        mode: "required",
        cookieName: "lze_marketing_consent",
        acceptedValue: "accepted",
        cookieValue: readCookieValue("lze_marketing_consent=accepted", "lze_marketing_consent"),
      }).hasMarketingConsent,
    ).toBe(true);
    expect(
      evaluateConsent({
        mode: "required",
        cookieName: "lze_marketing_consent",
        acceptedValue: "accepted",
        cookieValue: readCookieValue("lze_marketing_consent=denied", "lze_marketing_consent"),
      }).hasMarketingConsent,
    ).toBe(false);
  });
});

describe("Registrierungsevent (Server): Dedup + Payload", () => {
  it("speichert TagEvent mit der Ereignis-ID und sendet CompleteRegistration an Meta und TikTok mit derselben ID", async () => {
    const r = await sendRegistrationConversion(input());
    expect(r).toEqual({ sent: true });
    expect(prisma.tagEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: EVENT_ID,
        siteId: "lizenzzumerfolg",
        eventName: REGISTRATION_EVENT_NAME,
        path: "/verlosung",
        url: "https://lizenzzumerfolg.com/verlosung",
        utmSource: "adcloud",
        utmCampaign: "buch_verlosung_2026",
      }),
    });
    expect(sendMetaCapiSingle).toHaveBeenCalledTimes(1);
    const meta = vi.mocked(sendMetaCapiSingle).mock.calls[0]!;
    expect(meta[0]).toBe("123456789012345");
    expect(meta[1]).toBe("meta-test-token");
    expect(meta[3]).toMatchObject({
      eventId: EVENT_ID,
      eventName: "CompleteRegistration",
      eventTimeMs: 1_760_000_000_000,
      sourceUrl: "https://lizenzzumerfolg.com/verlosung",
      fbp: "fb.1.1700000000000.123456789",
      clientUserAgent: CHROME,
    });
    // Nur Allowlist-Daten – keinerlei Formularinhalte
    expect(Object.keys(meta[3].customData ?? {}).sort()).toEqual([
      "content_category",
      "content_name",
      "giveaway_campaign",
      "landing_path",
      "status",
    ]);

    expect(sendTikTokSingle).toHaveBeenCalledTimes(1);
    const tiktok = vi.mocked(sendTikTokSingle).mock.calls[0]!;
    expect(tiktok[3]).toMatchObject({
      eventId: EVENT_ID,
      eventName: "CompleteRegistration",
      ttp: "ttp123",
    });
    expect(prisma.tagEvent.update).toHaveBeenCalledTimes(2);
  });

  it("Retry mit derselben Ereignis-ID (Unique-Key) erzeugt keine zweite Conversion", async () => {
    vi.mocked(prisma.tagEvent.create).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );
    const r = await sendRegistrationConversion(input());
    expect(r).toEqual({ sent: false, reason: "duplicate" });
    expect(sendMetaCapiSingle).not.toHaveBeenCalled();
    expect(sendTikTokSingle).not.toHaveBeenCalled();
  });

  it("Bots (User-Agent) erzeugen keine Conversion", async () => {
    const r = await sendRegistrationConversion(input({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" }));
    expect(r).toEqual({ sent: false, reason: "bot" });
    expect(prisma.tagEvent.create).not.toHaveBeenCalled();
  });

  it("verwirft ungültige Pixel-Cookie-Werte statt sie weiterzureichen", async () => {
    await sendRegistrationConversion(
      input({ cookieHeader: "lze_marketing_consent=accepted; _fbp=<script>; _ttp=ok_value" }),
    );
    const meta = vi.mocked(sendMetaCapiSingle).mock.calls[0]!;
    expect(meta[3].fbp).toBeNull();
    const tiktok = vi.mocked(sendTikTokSingle).mock.calls[0]!;
    expect(tiktok[3].ttp).toBe("ok_value");
  });

  it("ohne konfigurierte Anbieter: Event gespeichert, nichts gesendet, kein Fehler", async () => {
    vi.stubEnv("META_PIXEL_ID", "");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    vi.stubEnv("TIKTOK_PIXEL_ID", "");
    vi.stubEnv("TIKTOK_EVENTS_API_TOKEN", "");
    resetEnvCache();
    const r = await sendRegistrationConversion(input());
    expect(r).toEqual({ sent: false });
    expect(prisma.tagEvent.create).toHaveBeenCalledTimes(1);
    expect(sendMetaCapiSingle).not.toHaveBeenCalled();
  });
});
