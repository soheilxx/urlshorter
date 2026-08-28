import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/tag/collect/route";
import { GET as getTagScript } from "@/app/t.js/route";
import { prisma } from "@/lib/db";

/**
 * Integrationstests des Tracking-Snippets: Script-Auslieferung und
 * Collect-Endpoint gegen die echte Test-Datenbank.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function collectRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3100/api/tag/collect", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "text/plain",
      "user-agent": BROWSER_UA,
      origin: "http://localhost:8777",
      ...headers,
    },
  });
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    site: "test",
    id: randomUUID(),
    name: "page_view",
    url: "http://localhost:8777/unterseite?utm_source=newsletter",
    ref: "https://www.google.de/",
    cid: randomUUID(),
    utm: { source: "newsletter" },
    ...overrides,
  };
}

beforeEach(async () => {
  await prisma.tagEvent.deleteMany();
});

describe("GET /t.js", () => {
  it("liefert das Script mit Pixel-Konfiguration und Site-Allowlist", async () => {
    const response = await getTagScript();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
    expect(response.headers.get("cache-control")).toContain("s-maxage");
    const js = await response.text();
    expect(js).toContain("window.lze");
    expect(js).toContain("page_view");
    expect(js).toContain('"test":["localhost","127.0.0.1"]');
    expect(js).toContain("/api/tag/collect");
    // Meta-Pixel-ID aus .env.test eingebettet
    expect(js).toContain("123456789012345");
  });
});

describe("POST /api/tag/collect", () => {
  it("speichert gültige Events mit Anreicherung", async () => {
    const body = validBody();
    const response = await POST(collectRequest(body));
    expect(response.status).toBe(204);

    const row = await prisma.tagEvent.findUnique({ where: { id: body.id as string } });
    expect(row).not.toBeNull();
    expect(row?.siteId).toBe("test");
    expect(row?.eventName).toBe("page_view");
    expect(row?.url).toBe("http://localhost:8777/unterseite");
    expect(row?.path).toBe("/unterseite");
    expect(row?.utmSource).toBe("newsletter");
    expect(row?.visitorHash).toBeTruthy();
    expect(row?.cookieHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.browser).toBe("Chrome");
  });

  it("verwirft Duplikate derselben Event-ID", async () => {
    const body = validBody();
    await POST(collectRequest(body));
    await POST(collectRequest(body));
    expect(await prisma.tagEvent.count()).toBe(1);
  });

  it("verwirft Events mit fremder URL oder fremdem Origin still", async () => {
    const fremdeUrl = await POST(
      collectRequest(validBody({ url: "https://fremde-seite.de/" })),
    );
    expect(fremdeUrl.status).toBe(204);

    const fremderOrigin = await POST(
      collectRequest(validBody(), { origin: "https://evil.example.com" }),
    );
    expect(fremderOrigin.status).toBe(204);

    expect(await prisma.tagEvent.count()).toBe(0);
  });

  it("verwirft Bot-Anfragen und kaputte Payloads still", async () => {
    await POST(collectRequest(validBody(), { "user-agent": "curl/8.5.0" }));
    const kaputt = await POST(
      new Request("http://127.0.0.1:3100/api/tag/collect", {
        method: "POST",
        body: "kein json",
        headers: { "user-agent": BROWSER_UA },
      }),
    );
    expect(kaputt.status).toBe(204);
    expect(await prisma.tagEvent.count()).toBe(0);
  });

  it("nimmt eigene Events über beliebige Unterseiten an", async () => {
    const body = validBody({
      name: "buch_kauf",
      url: "http://127.0.0.1:8777/kapitel/3?x=1",
    });
    await POST(collectRequest(body));
    const row = await prisma.tagEvent.findUnique({ where: { id: body.id as string } });
    expect(row?.eventName).toBe("buch_kauf");
    expect(row?.path).toBe("/kapitel/3");
  });
});
