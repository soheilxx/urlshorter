import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classifyRequest } from "@/lib/bot-detection";
import { logger } from "@/lib/logger";
import {
  newVoteIdentity,
  readBookVotes,
  voteIdentity,
  VOTE_COOKIE,
  writeBookVote,
} from "@/lib/reddit-book-votes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const schema = z.object({ vote: z.number().int().min(-1).max(1) }).strict();

export async function GET(request: NextRequest) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site")
      return new NextResponse(null, { status: 403, headers });
    let token = request.cookies.get(VOTE_COOKIE)?.value;
    let identity = voteIdentity(token);
    if (!identity) {
      token = newVoteIdentity();
      identity = voteIdentity(token);
    }
    const response = NextResponse.json(await readBookVotes(identity), { headers });
    if (token !== request.cookies.get(VOTE_COOKIE)?.value)
      response.cookies.set(VOTE_COOKIE, token!, {
        httpOnly: true,
        secure: new URL(request.url).protocol === "https:",
        sameSite: "lax",
        path: "/api/reddit/book-vote",
        maxAge: 365 * 24 * 60 * 60,
      });
    return response;
  } catch {
    logger.warn("reddit_book.vote_unavailable", {});
    return NextResponse.json(
      { error: "Die Abstimmung ist gerade nicht erreichbar." },
      { status: 503, headers },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return new NextResponse(null, { status: 403, headers });
    if (Number(request.headers.get("content-length")) > 200)
      return new NextResponse(null, { status: 413, headers });
    const text = await request.text();
    if (Buffer.byteLength(text) > 200) return new NextResponse(null, { status: 413, headers });
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return new NextResponse(null, { status: 400, headers });
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return new NextResponse(null, { status: 400, headers });
    const identity = voteIdentity(request.cookies.get(VOTE_COOKIE)?.value);
    if (
      !identity ||
      classifyRequest({ method: "POST", userAgent: request.headers.get("user-agent") }).isBot
    )
      return new NextResponse(null, { status: 403, headers });
    const result = await writeBookVote(identity, parsed.data.vote);
    if (result.limited)
      return NextResponse.json(
        { error: "Bitte warte einen Moment." },
        { status: 429, headers: { ...headers, "Retry-After": "1" } },
      );
    return NextResponse.json(result, { headers });
  } catch {
    logger.warn("reddit_book.vote_failed", {});
    return NextResponse.json(
      { error: "Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut." },
      { status: 503, headers },
    );
  }
}
