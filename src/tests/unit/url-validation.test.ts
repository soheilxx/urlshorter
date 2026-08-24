import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALLOWED_HOSTS,
  isHostAllowed,
  parseAllowedHosts,
  validateDestinationUrl,
} from "@/lib/url-validation";

const HOSTS = DEFAULT_ALLOWED_HOSTS;

describe("validateDestinationUrl", () => {
  it("akzeptiert erlaubte Amazon-Domains", () => {
    expect(validateDestinationUrl("https://amazon.de/dp/B01", HOSTS).ok).toBe(true);
    expect(validateDestinationUrl("https://www.amazon.de/dp/B01?ref=x", HOSTS).ok).toBe(true);
    expect(validateDestinationUrl("https://amzn.eu/d/abc123", HOSTS).ok).toBe(true);
  });

  it("akzeptiert echte Subdomains erlaubter Hosts", () => {
    expect(validateDestinationUrl("https://smile.amazon.de/dp/B01", HOSTS).ok).toBe(true);
  });

  it("lehnt manipulierte Domains wie amazon.de.example.com ab", () => {
    expect(validateDestinationUrl("https://amazon.de.example.com/dp/B01", HOSTS).ok).toBe(false);
    expect(validateDestinationUrl("https://www.amazon.de.evil.io/x", HOSTS).ok).toBe(false);
    expect(validateDestinationUrl("https://xamazon.de/dp/B01", HOSTS).ok).toBe(false);
    expect(validateDestinationUrl("https://amazonxde/dp/B01", HOSTS).ok).toBe(false);
  });

  it("lehnt HTTP-Ziele ab", () => {
    expect(validateDestinationUrl("http://www.amazon.de/dp/B01", HOSTS).ok).toBe(false);
  });

  it("lehnt andere Protokolle und Zugangsdaten ab", () => {
    expect(validateDestinationUrl("ftp://amazon.de/x", HOSTS).ok).toBe(false);
    expect(validateDestinationUrl("javascript:alert(1)", HOSTS).ok).toBe(false);
    expect(validateDestinationUrl("https://user:pass@www.amazon.de/dp/B01", HOSTS).ok).toBe(false);
  });

  it("lehnt leere und unparsbare Eingaben ab", () => {
    expect(validateDestinationUrl("", HOSTS).ok).toBe(false);
    expect(validateDestinationUrl("   ", HOSTS).ok).toBe(false);
    expect(validateDestinationUrl("kein url", HOSTS).ok).toBe(false);
    expect(validateDestinationUrl("https://", HOSTS).ok).toBe(false);
  });

  it("liefert Host und normalisierte URL zurück", () => {
    const result = validateDestinationUrl("https://WWW.AMAZON.DE/dp/B01", HOSTS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.host).toBe("www.amazon.de");
      expect(result.url).toContain("amazon.de");
    }
  });
});

describe("isHostAllowed", () => {
  it("verhindert Suffix-Tricks", () => {
    expect(isHostAllowed("amazon.de.example.com", HOSTS)).toBe(false);
    expect(isHostAllowed("notamazon.de", HOSTS)).toBe(false);
    expect(isHostAllowed("amazon.de", HOSTS)).toBe(true);
    expect(isHostAllowed("sub.amazon.de", HOSTS)).toBe(true);
  });

  it("behandelt abschließende Punkte korrekt", () => {
    expect(isHostAllowed("amazon.de.", HOSTS)).toBe(true);
    expect(isHostAllowed("amazon.de.example.com.", HOSTS)).toBe(false);
  });
});

describe("parseAllowedHosts", () => {
  it("liefert Defaults bei leerer Konfiguration", () => {
    expect(parseAllowedHosts(undefined)).toEqual(DEFAULT_ALLOWED_HOSTS);
    expect(parseAllowedHosts("")).toEqual(DEFAULT_ALLOWED_HOSTS);
  });

  it("parst eine kommagetrennte Liste", () => {
    expect(parseAllowedHosts("amazon.de, www.amazon.com ,amzn.to")).toEqual([
      "amazon.de",
      "www.amazon.com",
      "amzn.to",
    ]);
  });
});
