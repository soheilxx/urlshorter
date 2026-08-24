import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAppSecret } from "@/lib/env";
import { verifyEventToken } from "@/lib/event-token";
import { logger } from "@/lib/logger";

/**
 * Clientseitige Event-Bestätigung der Bridge-Page.
 *
 * Sicherheit: Änderungen sind NUR mit einem gültigen, signierten und nicht
 * abgelaufenen Event-Token möglich. Die Kenntnis einer Event-ID allein
 * genügt nicht. Es können ausschließlich vordefinierte Status-Flags von
 * false auf true gesetzt werden – keine weiteren Daten.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-store",
};

const beaconSchema = z.object({
  token: z.string().min(10).max(512),
  stage: z.enum(["bridge", "tracking", "redirect", "manual"]),
});

const STAGE_FIELD: Record<z.infer<typeof beaconSchema>["stage"], string> = {
  bridge: "bridgeLoaded",
  tracking: "trackingFired",
  redirect: "redirectStarted",
  manual: "manualClick",
};

export async function POST(request: Request): Promise<Response> {
  let parsed: z.infer<typeof beaconSchema>;
  try {
    const raw: unknown = JSON.parse(await request.text());
    parsed = beaconSchema.parse(raw);
  } catch {
    return new Response(null, { status: 400, headers: NO_CACHE_HEADERS });
  }

  let eventId: string | null = null;
  try {
    eventId = await verifyEventToken(parsed.token, requireAppSecret());
  } catch (error) {
    logger.error("beacon.secret_missing", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return new Response(null, { status: 500, headers: NO_CACHE_HEADERS });
  }

  if (!eventId) {
    return new Response(null, { status: 401, headers: NO_CACHE_HEADERS });
  }

  try {
    const field = STAGE_FIELD[parsed.stage];
    // updateMany wirft nicht, falls der Event (noch) nicht existiert.
    await prisma.clickEvent.updateMany({
      where: { id: eventId },
      data: { [field]: true },
    });
  } catch (error) {
    logger.error("beacon.update_failed", {
      eventId,
      stage: parsed.stage,
      message: error instanceof Error ? error.message : "unknown",
    });
    return new Response(null, { status: 500, headers: NO_CACHE_HEADERS });
  }

  return new Response(null, { status: 204, headers: NO_CACHE_HEADERS });
}
