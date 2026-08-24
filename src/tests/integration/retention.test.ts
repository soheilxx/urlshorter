import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as cronGet } from "@/app/api/cron/cleanup/route";
import { prisma } from "@/lib/db";
import { runRetentionCleanup } from "@/lib/retention";
import { createTestDestination, createTestLink, truncateAll } from "./helpers";

async function seedEvent(
  linkId: string,
  destId: string,
  code: string,
  daysAgo: number,
  isBot = false,
) {
  return prisma.clickEvent.create({
    data: {
      id: randomUUID(),
      shortLinkId: linkId,
      code,
      destinationId: destId,
      linkName: "Testlink",
      source: "Testsource",
      isBot,
      botReason: isBot ? "ua-pattern:test" : null,
      visitorHash: isBot ? null : randomUUID().replace(/-/g, "").slice(0, 32),
      ts: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    },
  });
}

describe("Datenaufbewahrung (Retention)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("aggregiert alte Events zu Tageswerten und löscht sie anschließend", async () => {
    const dest = await createTestDestination();
    const link = await createTestLink(dest.id, { code: "abcd" });

    await seedEvent(link.id, dest.id, "abcd", 100);
    await seedEvent(link.id, dest.id, "abcd", 100);
    await seedEvent(link.id, dest.id, "abcd", 100, true);
    await seedEvent(link.id, dest.id, "abcd", 5); // bleibt erhalten

    const result = await runRetentionCleanup(90);
    expect(result.deletedClickEvents).toBe(3);

    expect(await prisma.clickEvent.count()).toBe(1);

    const aggregates = await prisma.dailyAggregate.findMany();
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0]?.humanClicks).toBe(2);
    expect(aggregates[0]?.botClicks).toBe(1);
    expect(aggregates[0]?.uniqueVisitors).toBe(2);
    expect(aggregates[0]?.shortLinkId).toBe(link.id);
  });

  it("ist idempotent (zweiter Lauf ändert nichts)", async () => {
    const dest = await createTestDestination();
    const link = await createTestLink(dest.id, { code: "abcd" });
    await seedEvent(link.id, dest.id, "abcd", 120);

    await runRetentionCleanup(90);
    const second = await runRetentionCleanup(90);

    expect(second.deletedClickEvents).toBe(0);
    const aggregates = await prisma.dailyAggregate.findMany();
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0]?.humanClicks).toBe(1);
  });

  it("Cron-Endpoint verlangt das CRON_SECRET", async () => {
    const unauthorized = await cronGet(new Request("http://127.0.0.1:3100/api/cron/cleanup"));
    expect(unauthorized.status).toBe(401);

    const wrongSecret = await cronGet(
      new Request("http://127.0.0.1:3100/api/cron/cleanup", {
        headers: { authorization: "Bearer falsches-secret" },
      }),
    );
    expect(wrongSecret.status).toBe(401);

    const authorized = await cronGet(
      new Request("http://127.0.0.1:3100/api/cron/cleanup", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(authorized.status).toBe(200);
    const body = (await authorized.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
