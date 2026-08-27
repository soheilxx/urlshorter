import { describe, expect, it } from "vitest";
import { classifyChannel, referrerHost, type ChannelInput } from "@/lib/channels";

const OWN_HOST = "lizenzzumerfolg.com";

function input(partial: Partial<ChannelInput>): ChannelInput {
  return {
    source: null,
    medium: null,
    utmSource: null,
    utmMedium: null,
    referrer: null,
    ...partial,
  };
}

describe("referrerHost", () => {
  it("extrahiert den Hostnamen ohne www", () => {
    expect(referrerHost("https://www.google.de/search?q=x")).toBe("google.de");
    expect(referrerHost("https://l.instagram.com/")).toBe("l.instagram.com");
  });

  it("liefert null bei ungültigen Werten", () => {
    expect(referrerHost(null)).toBeNull();
    expect(referrerHost("kein-url")).toBeNull();
  });
});

describe("classifyChannel", () => {
  it("erkennt Paid über medium/utm_medium (auch paid_social)", () => {
    expect(classifyChannel(input({ source: "facebook", medium: "cpc" }), OWN_HOST)).toBe("paid");
    expect(
      classifyChannel(input({ source: "facebook", utmMedium: "paid_social" }), OWN_HOST),
    ).toBe("paid");
    expect(classifyChannel(input({ source: "google", medium: "ads" }), OWN_HOST)).toBe("paid");
  });

  it("erkennt E-Mail über medium oder source", () => {
    expect(classifyChannel(input({ source: "newsletter", medium: "email" }), OWN_HOST)).toBe(
      "email",
    );
    expect(classifyChannel(input({ source: "mailchimp" }), OWN_HOST)).toBe("email");
  });

  it("erkennt Organic Social über source oder Referrer", () => {
    expect(classifyChannel(input({ source: "instagram", medium: "social" }), OWN_HOST)).toBe(
      "organic_social",
    );
    expect(
      classifyChannel(input({ source: "bio", referrer: "https://l.instagram.com/" }), OWN_HOST),
    ).toBe("organic_social");
    expect(classifyChannel(input({ source: "tiktok" }), OWN_HOST)).toBe("organic_social");
  });

  it("erkennt Suche über source oder Referrer", () => {
    expect(classifyChannel(input({ source: "google", medium: "organic" }), OWN_HOST)).toBe(
      "search",
    );
    expect(
      classifyChannel(input({ source: "seo", referrer: "https://www.bing.com/" }), OWN_HOST),
    ).toBe("search");
  });

  it("UTM-Parameter haben Vorrang vor Link-Metadaten", () => {
    // Link als "instagram" angelegt, tatsächlich aber bezahlte Kampagne
    expect(
      classifyChannel(
        input({ source: "instagram", medium: "social", utmMedium: "cpc" }),
        OWN_HOST,
      ),
    ).toBe("paid");
  });

  it("fremder Referrer ohne Social/Suche ist Referral", () => {
    expect(
      classifyChannel(
        input({ source: "partner", referrer: "https://buchtipps-blog.de/artikel" }),
        OWN_HOST,
      ),
    ).toBe("referral");
  });

  it("ohne Referrer und ohne Source ist Direct, sonst Sonstiges", () => {
    expect(classifyChannel(input({}), OWN_HOST)).toBe("direct");
    expect(classifyChannel(input({ source: "qr-flyer" }), OWN_HOST)).toBe("other");
  });

  it("Self-Referrer zählt nicht als Referral", () => {
    expect(
      classifyChannel(
        input({ source: "qr-flyer", referrer: `https://${OWN_HOST}/abcd` }),
        OWN_HOST,
      ),
    ).toBe("direct");
  });
});
