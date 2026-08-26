import { beforeEach, describe, expect, it } from "vitest";
import { GET, HEAD } from "@/app/[code]/route";
import { prisma } from "@/lib/db";
import {
  BOT_UA,
  buildRedirectRequest,
  createTestDestination,
  createTestLink,
  routeContext,
  truncateAll,
} from "./helpers";

describe("Redirect-Route /{code}", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("liefert menschlichen Besuchern die Bridge-Page (200) und speichert den Click-Event", async () => {
    const dest = await createTestDestination();
    const link = await createTestLink(dest.id, { code: "abcd" });

    const response = await GET(
      buildRedirectRequest("abcd", { referer: "https://instagram.com/profil" }),
      routeContext("abcd"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");

    const html = await response.text();
    expect(html).toContain("Du wirst zu Amazon weitergeleitet");
    expect(html).toContain("Jetzt zu Amazon");
    expect(html).toContain(dest.url);

    const events = await prisma.clickEvent.findMany();
    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.shortLinkId).toBe(link.id);
    expect(event.code).toBe("abcd");
    expect(event.isBot).toBe(false);
    expect(event.deviceType).toBe("desktop");
    expect(event.browser).toBe("Chrome");
    expect(event.os).toBe("Windows");
    expect(event.referrer).toBe("https://instagram.com/profil");
    expect(event.visitorHash).toMatch(/^[0-9a-f]{32}$/);
    expect(event.source).toBe("Testsource");

    // Das signierte Event-Token muss in der Seite eingebettet sein
    expect(html).toContain(event.id);
  });

  it("leitet Bots direkt per 302 weiter und markiert den Event als Bot", async () => {
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    const response = await GET(
      buildRedirectRequest("abcd", { userAgent: BOT_UA }),
      routeContext("abcd"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(dest.url);

    const event = await prisma.clickEvent.findFirstOrThrow();
    expect(event.isBot).toBe(true);
    expect(event.botReason).toMatch(/^ua-pattern:/);
    expect(event.visitorHash).toBeNull();
  });

  it("zählt HEAD-Anfragen nicht als menschlichen Klick", async () => {
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    const response = await HEAD(
      buildRedirectRequest("abcd", { method: "HEAD" }),
      routeContext("abcd"),
    );
    expect(response.status).toBe(200);

    const event = await prisma.clickEvent.findFirstOrThrow();
    expect(event.isBot).toBe(true);
    expect(event.botReason).toBe("head-request");
  });

  it("zeigt bei unbekanntem Code eine Fehlerseite (404) ohne Weiterleitung", async () => {
    const response = await GET(buildRedirectRequest("xxxx"), routeContext("xxxx"));
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain("Link nicht gefunden");
    expect(response.headers.get("location")).toBeNull();
    expect(await prisma.clickEvent.count()).toBe(0);
  });

  it("zeigt bei ungültigem Code-Format eine Fehlerseite (404)", async () => {
    for (const bad of ["abc", "abcde", "ab1d", "ABCD"]) {
      const response = await GET(buildRedirectRequest(bad), routeContext(bad));
      expect(response.status).toBe(404);
    }
  });

  it("leitet deaktivierte Links nicht weiter (410)", async () => {
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd", active: false });

    const response = await GET(buildRedirectRequest("abcd"), routeContext("abcd"));
    expect(response.status).toBe(410);
    expect(await response.text()).toContain("Link nicht mehr aktiv");
    expect(response.headers.get("location")).toBeNull();
  });

  it("leitet Links mit deaktivierter Destination nicht weiter (410)", async () => {
    const dest = await createTestDestination({ active: false });
    await createTestLink(dest.id, { code: "abcd" });

    const response = await GET(buildRedirectRequest("abcd"), routeContext("abcd"));
    expect(response.status).toBe(410);
  });

  it("leitet abgelaufene Links nicht weiter (410)", async () => {
    const dest = await createTestDestination();
    await createTestLink(dest.id, {
      code: "abcd",
      expiresAt: new Date(Date.now() - 60_000),
    });

    const response = await GET(buildRedirectRequest("abcd"), routeContext("abcd"));
    expect(response.status).toBe(410);
    expect(await response.text()).toContain("Link abgelaufen");
  });

  it("übernimmt nur die definierten UTM-Parameter", async () => {
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    await GET(
      buildRedirectRequest("abcd", {
        query:
          "?utm_source=ig&utm_medium=social&utm_campaign=launch&utm_content=v1&utm_term=buch&geheim=passwort&email=x%40y.de",
      }),
      routeContext("abcd"),
    );

    const event = await prisma.clickEvent.findFirstOrThrow();
    expect(event.utmSource).toBe("ig");
    expect(event.utmMedium).toBe("social");
    expect(event.utmCampaign).toBe("launch");
    expect(event.utmContent).toBe("v1");
    expect(event.utmTerm).toBe("buch");
    // Fremde Parameter dürfen nirgends gespeichert werden
    const raw = JSON.stringify(event);
    expect(raw).not.toContain("passwort");
    expect(raw).not.toContain("x@y.de");
  });

  it("speichert den Consent-Status und bettet ohne Consent keine Pixel ein", async () => {
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    // Ohne Consent-Cookie (Modus "required"; META/REDDIT-IDs sind in .env.test gesetzt)
    const withoutConsent = await GET(buildRedirectRequest("abcd"), routeContext("abcd"));
    const htmlWithout = await withoutConsent.text();
    expect(htmlWithout).toContain('"meta":null');
    expect(htmlWithout).toContain('"reddit":null');
    expect(htmlWithout).toContain('"tiktok":null');

    // Mit gültigem Consent-Cookie
    const withConsent = await GET(
      buildRedirectRequest("abcd", { cookie: "marketing_consent=accepted" }),
      routeContext("abcd"),
    );
    const htmlWith = await withConsent.text();
    expect(htmlWith).toContain('"meta":"123456789012345"');
    expect(htmlWith).toContain('"reddit":"a2_testpixel1"');
    expect(htmlWith).toContain('"tiktok":"TESTTIKTOK1234567890"');

    const events = await prisma.clickEvent.findMany();
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.consent).sort()).toEqual([false, true]);
  });

  it("erlaubt es eingehenden Query-Parametern nicht, die Ziel-URL zu ersetzen", async () => {
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    const response = await GET(
      buildRedirectRequest("abcd", {
        query: "?url=https://boese-seite.example&redirect=https://evil.example",
      }),
      routeContext("abcd"),
    );
    const html = await response.text();
    expect(html).toContain(dest.url);
    expect(html).not.toContain("boese-seite.example");
    expect(html).not.toContain("evil.example");
  });
});
