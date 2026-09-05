import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/reddit/book-vote/route";
import { newVoteIdentity, voteIdentity, VOTE_COOKIE, writeBookVote } from "@/lib/reddit-book-votes";
import { ACTIVITY_DISPLAY, displayedActivity, nextReaderCount } from "@/lib/reddit-book-config";
import { resetEnvCache } from "@/lib/env";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    redditBookCounter: { findUnique: vi.fn().mockResolvedValue({ score: 0 }) },
    redditBookVote: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
beforeEach(() => {
  vi.stubEnv("APP_SECRET", "x".repeat(64));
  resetEnvCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
  vi.clearAllMocks();
});
const endpoint = "https://lizenzzumerfolg.com/api/reddit/book-vote";
function request(value: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(endpoint, {
    method: "POST",
    headers: {
      origin: "https://lizenzzumerfolg.com",
      "user-agent": "Mozilla/5.0 Chrome/130 Safari/537.36",
      cookie: `${VOTE_COOKIE}=${newVoteIdentity()}`,
      ...headers,
    },
    body: JSON.stringify(value),
  });
}
describe("Buch-Stimmen", () => {
  it("weist manipulierte Identitäten zurück und speichert nur einen abgeleiteten Hash", () => {
    const token = newVoteIdentity();
    expect(voteIdentity(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(voteIdentity(token)).not.toBe(token.split(".")[0]);
    expect(voteIdentity(token)).toBe(voteIdentity(token));
    expect(voteIdentity(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"))).toBeNull();
    expect(voteIdentity(undefined)).toBeNull();
  });
  it("liefert dieselbe öffentliche Anzeige zur selben Zeit und addiert Stimmen einmal", () => {
    const now = ACTIVITY_DISPLAY.epoch + 5 * ACTIVITY_DISPLAY.stepMs;
    expect(displayedActivity(now, 1).score - displayedActivity(now).score).toBe(1);
    expect(displayedActivity(now)).toEqual(displayedActivity(now));
    expect(displayedActivity(now + ACTIVITY_DISPLAY.stepMs).score).toBe(
      displayedActivity(now).score + 1,
    );
    expect(displayedActivity(now).score).toBeGreaterThan(8400);
    expect(displayedActivity(now).readers).toBeGreaterThanOrEqual(100);
    expect(displayedActivity(now).readers).toBeLessThan(1000);
  });
  it("variiert die dreistellige Leserzahl bei jedem Aufruf in kleinen Schritten, auch an Grenzen", () => {
    for (const previous of [184, 185, 230, 325, 326])
      for (const seed of [0, 0.1, 0.5, 0.99, 1]) {
        const next = nextReaderCount(previous, seed);
        expect(next).not.toBe(previous);
        expect(next).toBeGreaterThanOrEqual(ACTIVITY_DISPLAY.minimumReaders);
        expect(next).toBeLessThanOrEqual(ACTIVITY_DISPLAY.maximumReaders);
        expect(Math.abs(next - previous)).toBeLessThanOrEqual(12);
      }
  });
  it("setzt eine signierte, nicht per JavaScript lesbare Identität", async () => {
    const response = await GET(new NextRequest(endpoint));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).vote).toBe(0);
  });
  it("blockiert fremde Origins, Bots, fehlende Identität, ungültige Stimmen und übergroße Daten", async () => {
    expect((await POST(request({ vote: 1 }, { origin: "https://other.example" }))).status).toBe(
      403,
    );
    expect((await POST(request({ vote: 1 }, { "user-agent": "Googlebot" }))).status).toBe(403);
    expect((await POST(request({ vote: 1 }, { cookie: "" }))).status).toBe(403);
    expect((await POST(request({ vote: 2 }))).status).toBe(400);
    expect((await POST(request({ vote: 1, extra: "x" }))).status).toBe(400);
    expect((await POST(request({ vote: 1, extra: "x".repeat(250) }))).status).toBe(413);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    { previous: 1, next: 1, delta: 0 },
    { previous: 1, next: 0, delta: -1 },
    { previous: 1, next: -1, delta: -2 },
    { previous: 0, next: 1, delta: 1 },
  ])("wendet Wechsel $previous → $next mit Delta $delta an", async ({ previous, next, delta }) => {
    const tx = {
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      redditBookVote: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ value: previous, updatedAt: new Date(Date.now() - 2000) }),
        upsert: vi.fn(),
      },
      redditBookCounter: { update: vi.fn().mockResolvedValue({ score: 10 + delta }) },
    };
    vi.mocked(prisma.$transaction).mockImplementation((async (
      fn: (value: typeof tx) => Promise<unknown>,
    ) => fn(tx)) as never);
    const result = await writeBookVote("visitor-hash", next);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.redditBookCounter.update).toHaveBeenCalledWith({
      where: { id: "book" },
      data: { score: { increment: delta } },
    });
    expect(result).toMatchObject({ vote: next, limited: false });
    expect(tx.redditBookVote.upsert).toHaveBeenCalledTimes(delta === 0 ? 0 : 1);
  });
  it("begrenzt schnelle Wechsel und antwortet bei Ausfall ohne interne Details", async () => {
    const tx = {
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      redditBookVote: {
        findUnique: vi.fn().mockResolvedValue({ value: 1, updatedAt: new Date() }),
      },
    };
    vi.mocked(prisma.$transaction).mockImplementation((async (
      fn: (value: typeof tx) => Promise<unknown>,
    ) => fn(tx)) as never);
    expect((await POST(request({ vote: -1 }))).status).toBe(429);
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("secret database URL"));
    const response = await POST(request({ vote: 1 }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
  });
});
