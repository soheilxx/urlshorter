import { prisma } from "@/lib/db";

/** Leert alle Tabellen zwischen Testfällen. */
export async function truncateAll(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "ClickEvent", "ShortLink", "Destination", "DailyAggregate", "AuditLog", "AppSetting", "LoginAttempt" CASCADE',
  );
}

export async function createTestDestination(
  overrides: Partial<{ url: string; active: boolean }> = {},
) {
  return prisma.destination.create({
    data: {
      name: "Amazon Buchseite (Test)",
      url: overrides.url ?? "https://www.amazon.de/dp/B0TEST1234",
      host: "www.amazon.de",
      active: overrides.active ?? true,
    },
  });
}

export async function createTestLink(
  destinationId: string,
  overrides: Partial<{
    code: string;
    active: boolean;
    expiresAt: Date | null;
    source: string;
    campaign: string | null;
  }> = {},
) {
  return prisma.shortLink.create({
    data: {
      code: overrides.code ?? "tstl",
      name: "Testlink",
      source: overrides.source ?? "Testsource",
      campaign: overrides.campaign ?? "Testkampagne",
      active: overrides.active ?? true,
      expiresAt: overrides.expiresAt ?? null,
      destinationId,
    },
  });
}

export const HUMAN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export const BOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/** Baut einen GET-Request an die Redirect-Route. */
export function buildRedirectRequest(
  code: string,
  opts: Partial<{
    method: string;
    userAgent: string | null;
    query: string;
    cookie: string;
    referer: string;
  }> = {},
): Request {
  const headers = new Headers();
  const ua = opts.userAgent === undefined ? HUMAN_UA : opts.userAgent;
  if (ua) headers.set("user-agent", ua);
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.referer) headers.set("referer", opts.referer);
  headers.set("x-forwarded-for", "203.0.113.10");
  headers.set("accept-language", "de-DE,de;q=0.9");
  return new Request(`http://127.0.0.1:3100/${code}${opts.query ?? ""}`, {
    method: opts.method ?? "GET",
    headers,
  });
}

export function routeContext(code: string): { params: Promise<{ code: string }> } {
  return { params: Promise.resolve({ code }) };
}
