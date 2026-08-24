import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/beacon/route";
import { prisma } from "@/lib/db";
import { createEventToken } from "@/lib/event-token";
import { createTestDestination, createTestLink, truncateAll } from "./helpers";

function beaconRequest(body: unknown): Request {
  return new Request("http://127.0.0.1:3100/api/beacon", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "text/plain" },
  });
}

async function createEvent(): Promise<string> {
  const dest = await createTestDestination();
  const link = await createTestLink(dest.id, { code: "abcd" });
  const eventId = randomUUID();
  await prisma.clickEvent.create({
    data: {
      id: eventId,
      shortLinkId: link.id,
      code: link.code,
      destinationId: dest.id,
      linkName: link.name,
      source: link.source,
    },
  });
  return eventId;
}

describe("Beacon-Endpoint /api/beacon", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("aktualisiert Status-Flags nur mit gültigem Event-Token", async () => {
    const eventId = await createEvent();
    const token = await createEventToken(eventId, process.env.APP_SECRET!);

    for (const [stage, field] of [
      ["bridge", "bridgeLoaded"],
      ["tracking", "trackingFired"],
      ["redirect", "redirectStarted"],
      ["manual", "manualClick"],
    ] as const) {
      const response = await POST(beaconRequest({ token, stage }));
      expect(response.status).toBe(204);
      const event = await prisma.clickEvent.findUniqueOrThrow({ where: { id: eventId } });
      expect(event[field]).toBe(true);
    }
  });

  it("lehnt Anfragen mit bloßer Event-ID bzw. ungültiger Signatur ab (401)", async () => {
    const eventId = await createEvent();

    // Angreifer kennt die Event-ID, hat aber kein gültiges Token
    const forged = `${eventId}.${Date.now() + 60_000}.gefaelschte-signatur`;
    const response = await POST(beaconRequest({ token: forged, stage: "bridge" }));
    expect(response.status).toBe(401);

    const event = await prisma.clickEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.bridgeLoaded).toBe(false);
  });

  it("lehnt abgelaufene Tokens ab (401)", async () => {
    const eventId = await createEvent();
    const expired = await createEventToken(
      eventId,
      process.env.APP_SECRET!,
      1000,
      Date.now() - 60_000,
    );
    const response = await POST(beaconRequest({ token: expired, stage: "bridge" }));
    expect(response.status).toBe(401);
  });

  it("lehnt fehlerhafte Bodies ab (400)", async () => {
    expect((await POST(beaconRequest("kein json"))).status).toBe(400);
    expect((await POST(beaconRequest({ stage: "bridge" }))).status).toBe(400);
    expect((await POST(beaconRequest({ token: "abc.def.ghi", stage: "explode" }))).status).toBe(
      400,
    );
  });

  it("antwortet 204 auch für gültige Tokens ohne (noch) existierenden Event", async () => {
    const token = await createEventToken(randomUUID(), process.env.APP_SECRET!);
    const response = await POST(beaconRequest({ token, stage: "bridge" }));
    expect(response.status).toBe(204);
  });
});
