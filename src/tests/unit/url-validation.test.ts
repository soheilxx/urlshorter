import { describe, expect, it } from "vitest";
import {
  ALLOW_ALL_HOSTS,
  allowsAllHosts,
  AMAZON_HOSTS,
  DEFAULT_ALLOWED_HOSTS,
  isHostAllowed,
  parseAllowedHosts,
  validateDestinationUrl,
} from "@/lib/url-validation";

const ALL = [ALLOW_ALL_HOSTS];

describe("validateDestinationUrl – Standard (alle Hosts erlaubt)", () => {
  it("akzeptiert beliebige HTTPS-Ziele", () => {
    expect(validateDestinationUrl("https://www.amazon.de/dp/B01", ALL).ok).toBe(true);
    expect(validateDestinationUrl("https://example.com/landingpage", ALL).ok).toBe(true);
    expect(validateDestinationUrl("https://shop.meine-seite.de/produkt?x=1", ALL).ok).toBe(true);
    expect(validateDestinationUrl("https://sub.domain.co.uk/pfad#anker", ALL).ok).toBe(true);
  });

  it("lehnt HTTP und andere Protokolle weiterhin ab", () => {
    expect(validateDestinationUrl("http://example.com/x", ALL).ok).toBe(false);
    expect(validateDestinationUrl("ftp://example.com/x", ALL).ok).toBe(false);
    expect(validateDestinationUrl("javascript:alert(1)", ALL).ok).toBe(false);
  });

  it("lehnt eingebettete Zugangsdaten weiterhin ab", () => {
    expect(validateDestinationUrl("https://user:pass@example.com/x", ALL).ok).toBe(false);
  });

  it("lehnt leere, unparsbare und hostlose Eingaben ab", () => {
    expect(validateDestinationUrl("", ALL).ok).toBe(false);
    expect(validateDestinationUrl("   ", ALL).ok).toBe(false);
    expect(validateDestinationUrl("kein url", ALL).ok).toBe(false);
    expect(validateDestinationUrl("https://", ALL).ok).toBe(false);
    expect(validateDestinationUrl("https://localhost/x", ALL).ok).toBe(false);
  });
});

describe("validateDestinationUrl – mit Host-Allowlist", () => {
  it("akzeptiert erlaubte Amazon-Domains", () => {
    expect(validateDestinationUrl("https://amazon.de/dp/B01", AMAZON_HOSTS).ok).toBe(true);
    expect(validateDestinationUrl("https://www.amazon.de/dp/B01?ref=x", AMAZON_HOSTS).ok).toBe(
      true,
    );
    expect(validateDestinationUrl("https://amzn.eu/d/abc123", AMAZON_HOSTS).ok).toBe(true);
  });

  it("akzeptiert echte Subdomains erlaubter Hosts", () => {
    expect(validateDestinationUrl("https://smile.amazon.de/dp/B01", AMAZON_HOSTS).ok).toBe(true);
  });

  it("lehnt manipulierte Domains wie amazon.de.example.com ab", () => {
    expect(validateDestinationUrl("https://amazon.de.example.com/dp/B01", AMAZON_HOSTS).ok).toBe(
      false,
    );
    expect(validateDestinationUrl("https://www.amazon.de.evil.io/x", AMAZON_HOSTS).ok).toBe(false);
    expect(validateDestinationUrl("https://xamazon.de/dp/B01", AMAZON_HOSTS).ok).toBe(false);
  });

  it("lehnt fremde Hosts ab", () => {
    expect(validateDestinationUrl("https://example.com/x", AMAZON_HOSTS).ok).toBe(false);
  });

  it("liefert Host und normalisierte URL zurück", () => {
    const result = validateDestinationUrl("https://WWW.AMAZON.DE/dp/B01", AMAZON_HOSTS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.host).toBe("www.amazon.de");
      expect(result.url).toContain("amazon.de");
    }
  });
});

describe("isHostAllowed", () => {
  it("verhindert Suffix-Tricks bei aktiver Allowlist", () => {
    expect(isHostAllowed("amazon.de.example.com", AMAZON_HOSTS)).toBe(false);
    expect(isHostAllowed("notamazon.de", AMAZON_HOSTS)).toBe(false);
    expect(isHostAllowed("amazon.de", AMAZON_HOSTS)).toBe(true);
    expect(isHostAllowed("sub.amazon.de", AMAZON_HOSTS)).toBe(true);
  });

  it("behandelt abschließende Punkte korrekt", () => {
    expect(isHostAllowed("amazon.de.", AMAZON_HOSTS)).toBe(true);
    expect(isHostAllowed("amazon.de.example.com.", AMAZON_HOSTS)).toBe(false);
  });

  it("erlaubt mit '*' jeden Host", () => {
    expect(isHostAllowed("irgendwas.example", ALL)).toBe(true);
    expect(isHostAllowed("amazon.de", ALL)).toBe(true);
  });
});

describe("parseAllowedHosts", () => {
  it("Standard ist 'alle Hosts erlaubt'", () => {
    expect(parseAllowedHosts(undefined)).toEqual(DEFAULT_ALLOWED_HOSTS);
    expect(parseAllowedHosts("")).toEqual(DEFAULT_ALLOWED_HOSTS);
    expect(allowsAllHosts(parseAllowedHosts(undefined))).toBe(true);
  });

  it("parst '*' als Allow-All", () => {
    expect(parseAllowedHosts("*")).toEqual([ALLOW_ALL_HOSTS]);
    expect(parseAllowedHosts(" * ")).toEqual([ALLOW_ALL_HOSTS]);
    expect(parseAllowedHosts("amazon.de,*")).toEqual([ALLOW_ALL_HOSTS]);
  });

  it("parst eine kommagetrennte Allowlist", () => {
    const parsed = parseAllowedHosts("amazon.de, www.amazon.com ,amzn.to");
    expect(parsed).toEqual(["amazon.de", "www.amazon.com", "amzn.to"]);
    expect(allowsAllHosts(parsed)).toBe(false);
  });
});
