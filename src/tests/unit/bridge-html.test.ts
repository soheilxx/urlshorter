import { describe, expect, it } from "vitest";
import {
  buildBridgeCsp,
  destinationLabel,
  renderBridgePage,
  renderLinkErrorPage,
  sanitizeTrackingConfig,
  type BridgePageOptions,
} from "@/lib/bridge-html";

function baseOptions(overrides: Partial<BridgePageOptions> = {}): BridgePageOptions {
  return {
    destinationUrl: "https://www.amazon.de/dp/B0TEST1234",
    delayMs: 900,
    eventToken: "event.token.sig",
    hasMarketingConsent: true,
    tracking: {
      gtmContainerId: "GTM-ABC1234",
      ga4MeasurementId: "G-ABC1234567",
      metaPixelId: "123456789012345",
      redditPixelId: "a2_abc123def",
      tiktokPixelId: "DA79R2JC77UES9742I10",
    },
    eventParams: {
      event_id: "11111111-2222-3333-4444-555555555555",
      short_code: "abcd",
      link_name: "Testlink",
      source: "Instagram",
      medium: "social",
      campaign: "Buchlaunch",
      content: "",
      destination_host: "www.amazon.de",
    },
    privacyUrl: "https://soheil-hosseini.de/datenschutz",
    imprintUrl: "https://soheil-hosseini.de/impressum",
    ...overrides,
  };
}

describe("destinationLabel", () => {
  it("erkennt Amazon-Hosts", () => {
    expect(destinationLabel("www.amazon.de")).toBe("Amazon");
    expect(destinationLabel("amazon.de")).toBe("Amazon");
    expect(destinationLabel("amazon.co.uk")).toBe("Amazon");
    expect(destinationLabel("amzn.eu")).toBe("Amazon");
    expect(destinationLabel("smile.amazon.de")).toBe("Amazon");
  });

  it("liefert für andere Hosts den bereinigten Hostnamen", () => {
    expect(destinationLabel("www.example.com")).toBe("example.com");
    expect(destinationLabel("shop.meine-seite.de")).toBe("shop.meine-seite.de");
    expect(destinationLabel("notamazon.de")).toBe("notamazon.de");
  });
});

describe("renderBridgePage", () => {
  it("enthält Hinweistext, Button, Spinner und noscript-Fallback (Amazon-Ziel)", () => {
    const html = renderBridgePage(baseOptions());
    expect(html).toContain("Du wirst zu Amazon weitergeleitet");
    expect(html).toContain("Jetzt zu Amazon");
    expect(html).toContain('class="spinner"');
    expect(html).toContain("<noscript>");
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain("window.location.replace");
    expect(html).toContain("Datenschutz");
    expect(html).toContain("Impressum");
  });

  it("zeigt für Nicht-Amazon-Ziele den Hostnamen an", () => {
    const html = renderBridgePage(
      baseOptions({
        destinationUrl: "https://www.example.com/produkt",
        eventParams: { ...baseOptions().eventParams, destination_host: "www.example.com" },
      }),
    );
    expect(html).toContain("Du wirst zu example.com weitergeleitet");
    expect(html).toContain("Jetzt zu example.com");
    expect(html).not.toContain("Jetzt zu Amazon");
  });

  it("nutzt die konfigurierte Verzögerung (geklemmt auf 300–2000 ms)", () => {
    expect(renderBridgePage(baseOptions({ delayMs: 900 }))).toContain('"delay":900');
    expect(renderBridgePage(baseOptions({ delayMs: 50 }))).toContain('"delay":300');
    expect(renderBridgePage(baseOptions({ delayMs: 99999 }))).toContain('"delay":2000');
  });

  it("bindet mit Consent GTM, Meta, Reddit und TikTok ein, GA4 aber nicht zusätzlich zu GTM", () => {
    const html = renderBridgePage(baseOptions());
    expect(html).toContain('"gtm":"GTM-ABC1234"');
    expect(html).toContain('"meta":"123456789012345"');
    expect(html).toContain('"reddit":"a2_abc123def"');
    expect(html).toContain('"tiktok":"DA79R2JC77UES9742I10"');
    expect(html).toContain('"ga4":null');
    expect(html).toContain("amazon_outbound_click");
    expect(html).toContain("AmazonOutboundClick");
    expect(html).toContain("redditstatic.com/ads/pixel.js");
    expect(html).toContain('rdt("track","PageVisit")');
    expect(html).toContain('customEventName:"OutboundClick"');
    expect(html).toContain("analytics.tiktok.com/i18n/pixel/events.js");
    expect(html).toContain("ttq.page()");
    expect(html).toContain('ttq.track("ClickButton"');
    expect(html).toContain("event_id:C.params.event_id");
  });

  it("bindet GA4 nativ ein, wenn kein GTM konfiguriert ist", () => {
    const html = renderBridgePage(
      baseOptions({
        tracking: {
          gtmContainerId: null,
          ga4MeasurementId: "G-ABC1234567",
          metaPixelId: null,
          redditPixelId: null,
          tiktokPixelId: null,
        },
      }),
    );
    expect(html).toContain('"ga4":"G-ABC1234567"');
    expect(html).toContain('"gtm":null');
  });

  it("lädt ohne Consent keinerlei Marketing-Pixel und setzt Consent Mode auf denied", () => {
    const html = renderBridgePage(baseOptions({ hasMarketingConsent: false }));
    expect(html).toContain('"gtm":null');
    expect(html).toContain('"ga4":null');
    expect(html).toContain('"meta":null');
    expect(html).toContain('"reddit":null');
    expect(html).toContain('"tiktok":null');
    expect(html).toContain('"consent":false');
    expect(html).toContain('ad_storage:C.consent?"granted":"denied"');
  });

  it("escaped die Ziel-URL im HTML-Kontext", () => {
    const html = renderBridgePage(
      baseOptions({
        destinationUrl: 'https://www.amazon.de/dp/B01?a=1&b="<script>x</script>',
      }),
    );
    expect(html).not.toContain('b="<script>');
    expect(html).toContain("&amp;");
  });

  it("verhindert </script>-Injection über eingebettete Werte", () => {
    const html = renderBridgePage(
      baseOptions({
        eventParams: {
          ...baseOptions().eventParams,
          link_name: "</script><script>alert(1)</script>",
        },
      }),
    );
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script");
  });
});

describe("sanitizeTrackingConfig", () => {
  it("akzeptiert nur syntaktisch gültige IDs", () => {
    expect(
      sanitizeTrackingConfig({
        gtmContainerId: "GTM-ABC1234",
        ga4MeasurementId: "G-ABC1234567",
        metaPixelId: "123456789012345",
        redditPixelId: "a2_jkbr3o78lsrk",
        tiktokPixelId: "DA79R2JC77UES9742I10",
      }),
    ).toEqual({
      gtmContainerId: "GTM-ABC1234",
      ga4MeasurementId: "G-ABC1234567",
      metaPixelId: "123456789012345",
      redditPixelId: "a2_jkbr3o78lsrk",
      tiktokPixelId: "DA79R2JC77UES9742I10",
    });
  });

  it("verwirft manipulierte IDs (XSS-Schutz)", () => {
    const result = sanitizeTrackingConfig({
      gtmContainerId: 'GTM-X"><script>',
      ga4MeasurementId: "G-<img src=x>",
      metaPixelId: "123abc",
      redditPixelId: 'a2_"><script>alert(1)</script>',
      tiktokPixelId: 'DA79"><script>alert(1)</script>',
    });
    expect(result).toEqual({
      gtmContainerId: null,
      ga4MeasurementId: null,
      metaPixelId: null,
      redditPixelId: null,
      tiktokPixelId: null,
    });
  });

  it("verwirft Reddit-IDs ohne a2_-Präfix", () => {
    expect(
      sanitizeTrackingConfig({
        gtmContainerId: null,
        ga4MeasurementId: null,
        metaPixelId: null,
        redditPixelId: "jkbr3o78lsrk",
        tiktokPixelId: null,
      }).redditPixelId,
    ).toBeNull();
  });
});

describe("buildBridgeCsp", () => {
  it("enthält die Tracking-Anbieter und optionale Zusatz-Hosts", () => {
    const csp = buildBridgeCsp(["cdn.example.com"]);
    expect(csp).toContain("script-src 'unsafe-inline' https://www.googletagmanager.com");
    expect(csp).toContain("https://connect.facebook.net");
    expect(csp).toContain("https://www.redditstatic.com");
    expect(csp).toContain("https://alb.reddit.com");
    expect(csp).toContain("https://analytics.tiktok.com");
    expect(csp).toContain("https://*.tiktok.com");
    expect(csp).toContain("https://cdn.example.com");
    expect(csp).toContain("default-src 'none'");
  });
});

describe("renderLinkErrorPage", () => {
  it("zeigt passende Texte ohne Weiterleitung", () => {
    const html = renderLinkErrorPage("inactive", { privacyUrl: null, imprintUrl: null });
    expect(html).toContain("Link nicht mehr aktiv");
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).not.toContain("window.location");
  });
});
