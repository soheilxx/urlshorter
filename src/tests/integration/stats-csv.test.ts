import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildClickWhere, parseClickFilters } from "@/lib/click-filters";
import { streamClicksCsv } from "@/lib/csv";
import { addDays, todayBerlin } from "@/lib/date-range";
import { prisma } from "@/lib/db";
import { getClicksByDimension, getClicksPerDay, getOverviewStats, resolveRange } from "@/lib/stats";
import { createTestDestination, createTestLink, truncateAll } from "./helpers";

async function seed(opts: {
  linkId: string;
  destId: string;
  code: string;
  source?: string;
  campaign?: string | null;
  isBot?: boolean;
  daysAgo?: number;
  visitorHash?: string;
}) {
  return prisma.clickEvent.create({
    data: {
      id: randomUUID(),
      shortLinkId: opts.linkId,
      code: opts.code,
      destinationId: opts.destId,
      linkName: "Testlink",
      source: opts.source ?? "Instagram",
      campaign: opts.campaign ?? "Buchlaunch",
      isBot: opts.isBot ?? false,
      visitorHash: opts.visitorHash ?? randomUUID().replace(/-/g, "").slice(0, 32),
      deviceType: "desktop",
      country: "DE",
      ts: new Date(Date.now() - (opts.daysAgo ?? 0) * 24 * 60 * 60 * 1000),
    },
  });
}

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

describe("Statistiken und CSV-Export", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("schließt Bots aus den Standardstatistiken aus", async () => {
    const dest = await createTestDestination();
    const link = await createTestLink(dest.id, { code: "abcd" });

    await seed({ linkId: link.id, destId: dest.id, code: "abcd" });
    await seed({ linkId: link.id, destId: dest.id, code: "abcd" });
    await seed({ linkId: link.id, destId: dest.id, code: "abcd", isBot: true });

    const range = resolveRange("7d");
    const scope = { ...range, botFilter: "human" as const };
    const stats = await getOverviewStats(scope);

    expect(stats.humanClicks).toBe(2);
    expect(stats.botClicks).toBe(1);
    expect(stats.uniqueVisitors).toBe(2);

    const perDay = await getClicksPerDay(scope);
    const total = perDay.reduce((sum, d) => sum + d.clicks, 0);
    expect(total).toBe(2);

    const botScope = { ...range, botFilter: "bot" as const };
    const botPerDay = await getClicksPerDay(botScope);
    expect(botPerDay.reduce((sum, d) => sum + d.clicks, 0)).toBe(1);
  });

  it("aggregiert nach Dimensionen (Source, Kampagne, Gerät, Land)", async () => {
    const dest = await createTestDestination();
    const link = await createTestLink(dest.id, { code: "abcd" });
    await seed({ linkId: link.id, destId: dest.id, code: "abcd", source: "Instagram" });
    await seed({ linkId: link.id, destId: dest.id, code: "abcd", source: "Instagram" });
    await seed({ linkId: link.id, destId: dest.id, code: "abcd", source: "Newsletter" });

    const range = resolveRange("7d");
    const scope = { ...range, botFilter: "human" as const };

    const bySource = await getClicksByDimension(scope, "source");
    expect(bySource[0]).toEqual({ label: "Instagram", clicks: 2 });
    expect(bySource[1]).toEqual({ label: "Newsletter", clicks: 1 });

    const byCountry = await getClicksByDimension(scope, "country");
    expect(byCountry[0]).toEqual({ label: "DE", clicks: 3 });
  });

  it("Filter liefern korrekte Ergebnisse (Source, Bot, Datum)", async () => {
    const dest = await createTestDestination();
    const link = await createTestLink(dest.id, { code: "abcd" });
    await seed({ linkId: link.id, destId: dest.id, code: "abcd", source: "Instagram" });
    await seed({ linkId: link.id, destId: dest.id, code: "abcd", source: "Newsletter" });
    await seed({
      linkId: link.id,
      destId: dest.id,
      code: "abcd",
      source: "Instagram",
      isBot: true,
    });

    const humanInstagram = await prisma.clickEvent.count({
      where: buildClickWhere(parseClickFilters({ source: "Instagram" })),
    });
    expect(humanInstagram).toBe(1);

    const botsOnly = await prisma.clickEvent.count({
      where: buildClickWhere(parseClickFilters({ bot: "bot" })),
    });
    expect(botsOnly).toBe(1);

    const all = await prisma.clickEvent.count({
      where: buildClickWhere(parseClickFilters({ bot: "all" })),
    });
    expect(all).toBe(3);

    const today = todayBerlin();
    const todayCount = await prisma.clickEvent.count({
      where: buildClickWhere(parseClickFilters({ from: today, to: today })),
    });
    expect(todayCount).toBe(2);

    const past = await prisma.clickEvent.count({
      where: buildClickWhere(
        parseClickFilters({ from: addDays(today, -10), to: addDays(today, -5) }),
      ),
    });
    expect(past).toBe(0);
  });

  it("CSV-Export streamt die gefilterten Daten korrekt", async () => {
    const dest = await createTestDestination();
    const link = await createTestLink(dest.id, { code: "abcd" });
    await seed({ linkId: link.id, destId: dest.id, code: "abcd", source: "Instagram" });
    await seed({ linkId: link.id, destId: dest.id, code: "abcd", source: "Newsletter" });
    await seed({ linkId: link.id, destId: dest.id, code: "abcd", isBot: true });

    const csv = await streamToString(streamClicksCsv(parseClickFilters({})));
    const lines = csv.trim().split("\r\n");
    // Header + 2 menschliche Klicks (Bot-Standardfilter aktiv)
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Datum;Uhrzeit;Kurzcode");
    expect(csv).toContain("Instagram");
    expect(csv).toContain("Newsletter");

    const botCsv = await streamToString(streamClicksCsv(parseClickFilters({ bot: "bot" })));
    expect(botCsv.trim().split("\r\n")).toHaveLength(2);
  });

  it("CSV-Export escaped Sonderzeichen korrekt", async () => {
    const dest = await createTestDestination();
    const link = await createTestLink(dest.id, {
      code: "abcd",
      source: 'Mit;Semikolon "und" Anführung',
    });
    await seed({
      linkId: link.id,
      destId: dest.id,
      code: "abcd",
      source: 'Mit;Semikolon "und" Anführung',
    });

    const csv = await streamToString(streamClicksCsv(parseClickFilters({})));
    expect(csv).toContain('"Mit;Semikolon ""und"" Anführung"');
  });
});
