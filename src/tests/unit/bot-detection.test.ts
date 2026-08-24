import { describe, expect, it } from "vitest";
import { classifyRequest } from "@/lib/bot-detection";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function classify(userAgent: string | null, method = "GET") {
  return classifyRequest({ method, userAgent });
}

describe("classifyRequest", () => {
  it("erkennt typische Crawler", () => {
    expect(
      classify("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)").isBot,
    ).toBe(true);
    expect(classify("Mozilla/5.0 (compatible; bingbot/2.0)").isBot).toBe(true);
    expect(classify("facebookexternalhit/1.1").isBot).toBe(true);
    expect(classify("WhatsApp/2.23.20.0").isBot).toBe(true);
    expect(classify("TelegramBot (like TwitterBot)").isBot).toBe(true);
    expect(classify("Slackbot-LinkExpanding 1.0").isBot).toBe(true);
    expect(classify("curl/8.4.0").isBot).toBe(true);
    expect(classify("python-requests/2.31.0").isBot).toBe(true);
    expect(
      classify("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36").isBot,
    ).toBe(true);
  });

  it("liefert einen nachvollziehbaren Grund", () => {
    const result = classify("Googlebot/2.1");
    expect(result.reason).toMatch(/^ua-pattern:/);
  });

  it("wertet HEAD-Anfragen als Bot", () => {
    const result = classify(CHROME_UA, "HEAD");
    expect(result.isBot).toBe(true);
    expect(result.reason).toBe("head-request");
  });

  it("wertet fehlenden User-Agent als Bot", () => {
    expect(classify(null).reason).toBe("missing-user-agent");
    expect(classify("").reason).toBe("missing-user-agent");
  });

  it("erkennt Prefetch/Preview-Header", () => {
    const result = classifyRequest({
      method: "GET",
      userAgent: CHROME_UA,
      secPurposeHeader: "prefetch;prerender",
    });
    expect(result.isBot).toBe(true);
    expect(result.reason).toBe("prefetch-or-preview");
  });

  it("klassifiziert normale Browser als Mensch", () => {
    expect(classify(CHROME_UA).isBot).toBe(false);
    expect(classify(IPHONE_UA).isBot).toBe(false);
  });
});
