import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Live-Suche für die Befehls-Palette (Cmd/Ctrl-K): Kurzlinks und Ziele
 * per contains-Suche, max. 8 Treffer. Nur mit gültiger Session.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return new Response("Nicht autorisiert.", { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ links: [], destinations: [] });
  }

  const [links, destinations] = await Promise.all([
    prisma.shortLink.findMany({
      where: {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { campaign: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, code: true, name: true, active: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.destination.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { url: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, host: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  return NextResponse.json(
    {
      links: links.map((l) => ({ id: l.id, code: l.code, name: l.name, active: l.active })),
      destinations: destinations.map((d) => ({ id: d.id, name: d.name, host: d.host })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
