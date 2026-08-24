import { prisma } from "@/lib/db";

/**
 * Health-Endpoint ohne Preisgabe sensibler Informationen.
 * Prüft die Datenbankverbindung mit einer minimalen Query.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return Response.json(
    { status: dbOk ? "ok" : "degraded", db: dbOk },
    {
      status: dbOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
