import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, berlinDayStartUtc, resolveRange, todayBerlin } from "@/lib/date-range";

/**
 * Serverseitig aggregierte Dashboard-Statistiken.
 * Bots sind standardmäßig ausgeschlossen; über botFilter="bot" ist die
 * separate Bot-Auswertung möglich. Für Zeiträume jenseits der Retention
 * werden Tagesaggregate (DailyAggregate) in die Tagesreihe eingerechnet.
 */

export type BotFilter = "human" | "bot";

export interface StatsScope {
  from: Date;
  to: Date;
  fromDay: string;
  toDay: string;
  botFilter: BotFilter;
  shortLinkId?: string | null;
}

function botCond(botFilter: BotFilter): Prisma.Sql {
  return botFilter === "bot" ? Prisma.sql`ce."isBot"` : Prisma.sql`NOT ce."isBot"`;
}

function linkCond(shortLinkId: string | null | undefined): Prisma.Sql {
  return shortLinkId ? Prisma.sql`AND ce."shortLinkId" = ${shortLinkId}` : Prisma.empty;
}

function aggLinkCond(shortLinkId: string | null | undefined): Prisma.Sql {
  return shortLinkId ? Prisma.sql`AND da."shortLinkId" = ${shortLinkId}` : Prisma.empty;
}

export interface OverviewStats {
  humanClicks: number;
  botClicks: number;
  uniqueVisitors: number;
  clicksToday: number;
  clicksYesterday: number;
  clicksLast7Days: number;
  clicksLast30Days: number;
  activeLinks: number;
  avgClicksPerDay: number;
  bridgeLoadedRate: number;
  trackingFiredRate: number;
}

export async function getOverviewStats(scope: StatsScope): Promise<OverviewStats> {
  const { from, to, shortLinkId } = scope;
  const linkWhere = shortLinkId ? { shortLinkId } : {};

  const today = todayBerlin();
  const todayStart = berlinDayStartUtc(today);
  const tomorrowStart = berlinDayStartUtc(addDays(today, 1));
  const yesterdayStart = berlinDayStartUtc(addDays(today, -1));
  const last7Start = berlinDayStartUtc(addDays(today, -6));
  const last30Start = berlinDayStartUtc(addDays(today, -29));

  const humanBase = { isBot: false, ...linkWhere };

  const [
    humanClicks,
    botClicks,
    uniqueRows,
    clicksToday,
    clicksYesterday,
    clicksLast7Days,
    clicksLast30Days,
    activeLinks,
    bridgeLoaded,
    trackingFired,
  ] = await Promise.all([
    prisma.clickEvent.count({ where: { ...humanBase, ts: { gte: from, lt: to } } }),
    prisma.clickEvent.count({ where: { isBot: true, ...linkWhere, ts: { gte: from, lt: to } } }),
    prisma.$queryRaw<Array<{ uniques: number }>>(Prisma.sql`
      SELECT count(DISTINCT ce."visitorHash")::int AS uniques
      FROM "ClickEvent" ce
      WHERE NOT ce."isBot" AND ce."visitorHash" IS NOT NULL
        AND ce."ts" >= ${from} AND ce."ts" < ${to}
        ${linkCond(shortLinkId)}
    `),
    prisma.clickEvent.count({
      where: { ...humanBase, ts: { gte: todayStart, lt: tomorrowStart } },
    }),
    prisma.clickEvent.count({
      where: { ...humanBase, ts: { gte: yesterdayStart, lt: todayStart } },
    }),
    prisma.clickEvent.count({
      where: { ...humanBase, ts: { gte: last7Start, lt: tomorrowStart } },
    }),
    prisma.clickEvent.count({
      where: { ...humanBase, ts: { gte: last30Start, lt: tomorrowStart } },
    }),
    prisma.shortLink.count({ where: { active: true } }),
    prisma.clickEvent.count({
      where: { ...humanBase, bridgeLoaded: true, ts: { gte: from, lt: to } },
    }),
    prisma.clickEvent.count({
      where: { ...humanBase, trackingFired: true, ts: { gte: from, lt: to } },
    }),
  ]);

  const rangeDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));

  return {
    humanClicks,
    botClicks,
    uniqueVisitors: uniqueRows[0]?.uniques ?? 0,
    clicksToday,
    clicksYesterday,
    clicksLast7Days,
    clicksLast30Days,
    activeLinks,
    avgClicksPerDay: humanClicks / rangeDays,
    bridgeLoadedRate: humanClicks > 0 ? bridgeLoaded / humanClicks : 0,
    trackingFiredRate: humanClicks > 0 ? trackingFired / humanClicks : 0,
  };
}

export interface DayPoint {
  day: string;
  clicks: number;
}

/** Klicks pro Berliner Kalendertag (inkl. DailyAggregate für alte Zeiträume). */
export async function getClicksPerDay(scope: StatsScope): Promise<DayPoint[]> {
  const aggColumn =
    scope.botFilter === "bot" ? Prisma.sql`da."botClicks"` : Prisma.sql`da."humanClicks"`;

  const rows = await prisma.$queryRaw<Array<{ day: string; clicks: number }>>(Prisma.sql`
    SELECT to_char(t.day, 'YYYY-MM-DD') AS day, sum(t.clicks)::int AS clicks
    FROM (
      SELECT (ce."ts" AT TIME ZONE 'Europe/Berlin')::date AS day, count(*) AS clicks
      FROM "ClickEvent" ce
      WHERE ${botCond(scope.botFilter)}
        AND ce."ts" >= ${scope.from} AND ce."ts" < ${scope.to}
        ${linkCond(scope.shortLinkId)}
      GROUP BY 1
      UNION ALL
      SELECT da."date" AS day, ${aggColumn} AS clicks
      FROM "DailyAggregate" da
      WHERE da."date" >= ${scope.fromDay}::date AND da."date" < ${scope.toDay}::date
        ${aggLinkCond(scope.shortLinkId)}
    ) t
    GROUP BY t.day
    ORDER BY t.day
  `);

  // Lücken (Tage ohne Klicks) mit 0 auffüllen
  const byDay = new Map(rows.map((r) => [r.day, r.clicks]));
  const result: DayPoint[] = [];
  for (let day = scope.fromDay; day < scope.toDay; day = addDays(day, 1)) {
    result.push({ day, clicks: byDay.get(day) ?? 0 });
    if (result.length > 400) break; // Sicherheitsgrenze
  }
  return result;
}

export interface BucketPoint {
  label: string;
  clicks: number;
}

/** Klicks nach Stunde (0–23, Europe/Berlin). */
export async function getClicksByHour(scope: StatsScope): Promise<BucketPoint[]> {
  const rows = await prisma.$queryRaw<Array<{ hour: number; clicks: number }>>(Prisma.sql`
    SELECT EXTRACT(HOUR FROM ce."ts" AT TIME ZONE 'Europe/Berlin')::int AS hour,
           count(*)::int AS clicks
    FROM "ClickEvent" ce
    WHERE ${botCond(scope.botFilter)}
      AND ce."ts" >= ${scope.from} AND ce."ts" < ${scope.to}
      ${linkCond(scope.shortLinkId)}
    GROUP BY 1
    ORDER BY 1
  `);
  const byHour = new Map(rows.map((r) => [r.hour, r.clicks]));
  return Array.from({ length: 24 }, (_, h) => ({
    label: `${String(h).padStart(2, "0")} Uhr`,
    clicks: byHour.get(h) ?? 0,
  }));
}

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Klicks nach Wochentag (Mo–So, Europe/Berlin). */
export async function getClicksByWeekday(scope: StatsScope): Promise<BucketPoint[]> {
  const rows = await prisma.$queryRaw<Array<{ dow: number; clicks: number }>>(Prisma.sql`
    SELECT EXTRACT(ISODOW FROM ce."ts" AT TIME ZONE 'Europe/Berlin')::int AS dow,
           count(*)::int AS clicks
    FROM "ClickEvent" ce
    WHERE ${botCond(scope.botFilter)}
      AND ce."ts" >= ${scope.from} AND ce."ts" < ${scope.to}
      ${linkCond(scope.shortLinkId)}
    GROUP BY 1
    ORDER BY 1
  `);
  const byDow = new Map(rows.map((r) => [r.dow, r.clicks]));
  return WEEKDAY_LABELS.map((label, i) => ({
    label,
    clicks: byDow.get(i + 1) ?? 0,
  }));
}

export type StatsDimension = "source" | "campaign" | "code" | "deviceType" | "country";

const DIMENSION_COLUMNS: Record<StatsDimension, Prisma.Sql> = {
  source: Prisma.sql`ce."source"`,
  campaign: Prisma.sql`ce."campaign"`,
  code: Prisma.sql`ce."code"`,
  deviceType: Prisma.sql`ce."deviceType"`,
  country: Prisma.sql`ce."country"`,
};

/** Top-N-Auswertung nach einer Dimension (Source, Kampagne, Link, Gerät, Land). */
export async function getClicksByDimension(
  scope: StatsScope,
  dimension: StatsDimension,
  limit = 15,
): Promise<BucketPoint[]> {
  const column = DIMENSION_COLUMNS[dimension];
  const rows = await prisma.$queryRaw<Array<{ label: string | null; clicks: number }>>(Prisma.sql`
    SELECT ${column} AS label, count(*)::int AS clicks
    FROM "ClickEvent" ce
    WHERE ${botCond(scope.botFilter)}
      AND ce."ts" >= ${scope.from} AND ce."ts" < ${scope.to}
      ${linkCond(scope.shortLinkId)}
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT ${Math.min(50, Math.max(1, limit))}
  `);
  return rows.map((r) => ({ label: r.label ?? "(unbekannt)", clicks: r.clicks }));
}

export { resolveRange };
