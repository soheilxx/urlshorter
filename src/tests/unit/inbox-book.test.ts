import { describe, expect, it } from "vitest";
import { resolveInboxPortal } from "@/lib/inbox-book-config";

describe("Inbox-Farbvariante", () => {
  it("bevorzugt gültige Kampagnenparameter vor Referrern", () => {
    expect(
      resolveInboxPortal({ portal: "webde", utm_source: "gmx" }, "https://mail.gmx.net/"),
    ).toBe("webde");
    expect(resolveInboxPortal({ portal: ["gmx", "webde"] })).toBe("gmx");
    expect(resolveInboxPortal({ portal: "fremd", utm_source: "WEB.DE" })).toBe("webde");
  });
  it("erkennt bekannte Hosts und Subdomains", () => {
    expect(resolveInboxPortal({}, "https://navigator.web.de/mail")).toBe("webde");
    expect(resolveInboxPortal({}, "https://3c.gmx.net/mail")).toBe("gmx");
    expect(resolveInboxPortal({}, "https://gmx.ch/")).toBe("gmx");
  });
  it.each([
    undefined,
    "invalid",
    "https://web.de.evil.example",
    "https://fakegmx.net",
    "https://web.de@evil.example",
    "javascript://web.de/",
    "https://example.com/?source=web.de",
  ])("verwendet für fremde oder fehlende Quellen die neutrale Ansicht: %s", (referrer) => {
    expect(resolveInboxPortal({ utm_source: "uim" }, referrer)).toBe("neutral");
  });
});
