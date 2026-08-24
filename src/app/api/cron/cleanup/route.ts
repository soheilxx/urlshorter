import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runRetentionCleanup } from "@/lib/retention";

/**
 * Geschützter Cron-Endpoint für die Datenbereinigung.
 * Vercel Cron sendet automatisch "Authorization: Bearer <CRON_SECRET>",
 * wenn die Environment Variable CRON_SECRET im Projekt hinterlegt ist.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function handle(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json(
      { error: "Nicht autorisiert." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await runRetentionCleanup(getEnv().EVENT_RETENTION_DAYS);
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("cron.cleanup_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return Response.json(
      { ok: false, error: "Bereinigung fehlgeschlagen." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
