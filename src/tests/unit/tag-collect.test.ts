import { describe, expect, it } from "vitest";
import { originAllowed, parseTagCollectPayload } from "@/lib/tag-collect";
import { findTagSite, hostnameAllowed } from "@/lib/tag-config";

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    site: "soheil-hosseini",
    id: "0b6f8c2a-1d2e-4f3a-9b4c-5d6e7f8a9b0c",
    name: "page_view",
    url: "https://www.soheil-hosseini.de/leseprobe?utm_source=ig&x=1",
    ref: "https://l.instagram.com/",
    cid: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    fbp: "fb.1.1700000000.123456",
    utm: { source: "ig", campaign: "launch" },
    ...overrides,
  };
}

describe("Tag-Konfiguration", () => {
  it("erlaubt Domains inklusive Subdomains", () => {
    const site = findTagSite("soheil-hosseini");
    expect(site).not.toBeNull();
    if (!site) return;
    expect(hostnameAllowed(site, "soheil-hosseini.de")).toBe(true);
    expect(hostnameAllowed(site, "www.soheil-hosseini.de")).toBe(true);
    expect(hostnameAllowed(site, "boese-soheil-hosseini.de")).toBe(false);
    expect(hostnameAllowed(site, "soheil-hosseini.de.evil.com")).toBe(false);
  });
});

describe("parseTagCollectPayload", () => {
  it("akzeptiert gültige Payloads und entfernt den Query-String", () => {
    const result = parseTagCollectPayload(validPayload());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.url).toBe("https://www.soheil-hosseini.de/leseprobe");
    expect(result.data.path).toBe("/leseprobe");
    expect(result.data.utm.source).toBe("ig");
    expect(result.data.eventName).toBe("page_view");
  });

  it("lehnt unbekannte Sites ab", () => {
    const result = parseTagCollectPayload(validPayload({ site: "fremd" }));
    expect(result).toMatchObject({ ok: false, reason: "unknown_site" });
  });

  it("lehnt URLs außerhalb der Domain-Allowlist ab (Fremdeinbettung)", () => {
    const result = parseTagCollectPayload(
      validPayload({ url: "https://konkurrenz.de/produkt" }),
    );
    expect(result).toMatchObject({ ok: false, reason: "host_not_allowed" });
  });

  it("lehnt ungültige Event-Namen und IDs ab", () => {
    expect(parseTagCollectPayload(validPayload({ name: "Böses Event!" })).ok).toBe(false);
    expect(parseTagCollectPayload(validPayload({ id: "keine-uuid" })).ok).toBe(false);
  });

  it("normalisiert Event-Namen auf Kleinschreibung", () => {
    const result = parseTagCollectPayload(validPayload({ name: "Buch_Kauf" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.eventName).toBe("buch_kauf");
  });
});

describe("originAllowed", () => {
  const site = findTagSite("soheil-hosseini");
  if (!site) throw new Error("Site fehlt");

  it("akzeptiert erlaubte Origins und fehlenden Header", () => {
    expect(originAllowed(site, "https://www.soheil-hosseini.de")).toBe(true);
    expect(originAllowed(site, null)).toBe(true);
  });

  it("lehnt fremde Origins ab", () => {
    expect(originAllowed(site, "https://evil.example.com")).toBe(false);
    expect(originAllowed(site, "kein-origin")).toBe(false);
  });
});
