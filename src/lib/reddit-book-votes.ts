import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireAppSecret } from "@/lib/env";
import { displayedActivity } from "@/lib/reddit-book-config";

export const VOTE_COOKIE = "lze_book_vote";
const sign = (value: string) =>
  createHmac("sha256", requireAppSecret()).update(`book-vote.v1.${value}`).digest("hex");
export function newVoteIdentity() {
  const id = randomUUID();
  return `${id}.${sign(id)}`;
}
export function voteIdentity(token: string | undefined): string | null {
  if (!token || !/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(token)) return null;
  const [id, signature] = token.split(".") as [string, string];
  const expected = sign(id);
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return sign(`stored.${id}`);
}

export async function readBookVotes(visitor: string | null) {
  const [counter, vote] = await Promise.all([
    prisma.redditBookCounter.findUnique({ where: { id: "book" } }),
    visitor ? prisma.redditBookVote.findUnique({ where: { visitor } }) : null,
  ]);
  const now = Date.now();
  return {
    ...displayedActivity(now, counter?.score ?? 0),
    vote: vote?.value ?? 0,
    serverTime: now,
  };
}

/** Ein gemeinsames Row-Lock schützt Wechsel, Rücknahme und gleichzeitige Requests. */
export async function writeBookVote(visitor: string, value: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "RedditBookCounter" (id, score) VALUES ('book', 0) ON CONFLICT (id) DO NOTHING`;
    await tx.$queryRaw`SELECT id FROM "RedditBookCounter" WHERE id = 'book' FOR UPDATE`;
    const previous = await tx.redditBookVote.findUnique({ where: { visitor } });
    const now = Date.now();
    if (previous && previous.value !== value && now - previous.updatedAt.getTime() < 700) {
      return { limited: true as const };
    }
    const delta = value - (previous?.value ?? 0);
    if (!previous || delta !== 0) {
      await tx.redditBookVote.upsert({
        where: { visitor },
        create: { visitor, value },
        update: { value, updatedAt: new Date(now) },
      });
    }
    const counter = await tx.redditBookCounter.update({
      where: { id: "book" },
      data: { score: { increment: delta } },
    });
    return {
      limited: false as const,
      ...displayedActivity(now, counter.score),
      vote: value,
      serverTime: now,
    };
  });
}
