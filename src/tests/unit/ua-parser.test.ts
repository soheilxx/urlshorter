import { describe, expect, it } from "vitest";
import { parseUserAgent } from "@/lib/ua-parser";

describe("parseUserAgent", () => {
  it("erkennt Chrome unter Windows (Desktop)", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    );
    expect(result).toEqual({ deviceType: "desktop", browser: "Chrome", os: "Windows" });
  });

  it("erkennt Safari auf dem iPhone (Mobil)", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    );
    expect(result).toEqual({ deviceType: "mobile", browser: "Safari", os: "iOS" });
  });

  it("erkennt Android-Chrome (Mobil)", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
    );
    expect(result).toEqual({ deviceType: "mobile", browser: "Chrome", os: "Android" });
  });

  it("erkennt iPad als Tablet", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    );
    expect(result.deviceType).toBe("tablet");
    expect(result.os).toBe("iPadOS");
  });

  it("erkennt Edge vor Chrome", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
    );
    expect(result.browser).toBe("Edge");
  });

  it("erkennt Firefox unter macOS", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:128.0) Gecko/20100101 Firefox/128.0",
    );
    expect(result).toEqual({ deviceType: "desktop", browser: "Firefox", os: "macOS" });
  });

  it("liefert 'Unbekannt' bei fehlendem User-Agent", () => {
    expect(parseUserAgent(null)).toEqual({
      deviceType: "unknown",
      browser: "Unbekannt",
      os: "Unbekannt",
    });
  });
});
