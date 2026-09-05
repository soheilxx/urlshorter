import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { readBookVotes, writeBookVote } from "@/lib/reddit-book-votes";

beforeEach(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/urlshorter_test")
    throw new Error("Nur lokale Testdatenbank erlaubt.");
  await prisma.redditBookVote.deleteMany();
  await prisma.redditBookCounter.upsert({
    where: { id: "book" },
    create: { id: "book", score: 0 },
    update: { score: 0 },
  });
});
afterAll(() => prisma.$disconnect());
describe("Buch-Votes mit PostgreSQL", () => {
  it("verliert bei gleichzeitigen unterschiedlichen Besuchern keine Stimmen", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => writeBookVote(`integration-${i}`, 1)),
    );
    expect(results.every((x) => !x.limited)).toBe(true);
    expect(await prisma.redditBookVote.count()).toBe(12);
    expect(
      (await prisma.redditBookCounter.findUniqueOrThrow({ where: { id: "book" } })).score,
    ).toBe(12);
  });
  it("zählt gleichzeitige Wiederholungen derselben Stimme nur einmal", async () => {
    await Promise.all(Array.from({ length: 8 }, () => writeBookVote("same-visitor", 1)));
    expect(await prisma.redditBookVote.count()).toBe(1);
    expect(
      (await prisma.redditBookCounter.findUniqueOrThrow({ where: { id: "book" } })).score,
    ).toBe(1);
    expect((await readBookVotes("same-visitor")).vote).toBe(1);
  });
  it("speichert Wechsel und Rücknahme konsistent und begrenzt schnelle Richtungswechsel", async () => {
    await writeBookVote("visitor", 1);
    expect(await writeBookVote("visitor", -1)).toEqual({ limited: true });
    await prisma.redditBookVote.update({
      where: { visitor: "visitor" },
      data: { updatedAt: new Date(Date.now() - 2000) },
    });
    await writeBookVote("visitor", -1);
    expect(
      (await prisma.redditBookCounter.findUniqueOrThrow({ where: { id: "book" } })).score,
    ).toBe(-1);
    await prisma.redditBookVote.update({
      where: { visitor: "visitor" },
      data: { updatedAt: new Date(Date.now() - 2000) },
    });
    await writeBookVote("visitor", 0);
    expect((await readBookVotes("visitor")).vote).toBe(0);
    expect(
      (await prisma.redditBookCounter.findUniqueOrThrow({ where: { id: "book" } })).score,
    ).toBe(0);
  });
  it("erzwingt gültige Werte auch direkt auf Datenbankebene", async () => {
    await expect(
      prisma.redditBookVote.create({ data: { visitor: "invalid", value: 2 } }),
    ).rejects.toThrow();
    expect(await prisma.redditBookVote.count()).toBe(0);
  });
});
