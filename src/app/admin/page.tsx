import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/admin/bar-list";
import { BucketBarChart, ClicksPerDayChart } from "@/components/admin/charts";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import {
  getClicksByDimension,
  getClicksByHour,
  getClicksByWeekday,
  getClicksPerDay,
  getOverviewStats,
  resolveRange,
  type BotFilter,
  type StatsScope,
} from "@/lib/stats";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Übersicht" };
export const dynamic = "force-dynamic";

const RANGE_OPTIONS = [
  { key: "today", label: "Heute" },
  { key: "yesterday", label: "Gestern" },
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "90d", label: "90 Tage" },
  { key: "all", label: "Gesamt" },
];

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const params = await searchParams;
  const rangeParam = typeof params.range === "string" ? params.range : undefined;
  const botFilter: BotFilter = params.bots === "only" ? "bot" : "human";

  const range = resolveRange(rangeParam);
  const scope: StatsScope = {
    from: range.from,
    to: range.to,
    fromDay: range.fromDay,
    toDay: range.toDay,
    botFilter,
  };

  const [stats, perDay, byHour, byWeekday, bySource, byCampaign, byCode, byDevice, byCountry] =
    await Promise.all([
      getOverviewStats(scope),
      getClicksPerDay(scope),
      getClicksByHour(scope),
      getClicksByWeekday(scope),
      getClicksByDimension(scope, "source"),
      getClicksByDimension(scope, "campaign"),
      getClicksByDimension(scope, "code"),
      getClicksByDimension(scope, "deviceType"),
      getClicksByDimension(scope, "country"),
    ]);

  const buildHref = (nextRange: string, nextBots: BotFilter) => {
    const sp = new URLSearchParams();
    if (nextRange !== "30d") sp.set("range", nextRange);
    if (nextBots === "bot") sp.set("bots", "only");
    const qs = sp.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Übersicht</h1>
          <p className="text-sm text-zinc-500">
            {range.label}
            {botFilter === "bot" ? " · Nur Bot-Aufrufe" : " · Ohne Bots"} · Zeitzone Europe/Berlin
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-zinc-200 bg-surface p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <Link
                key={opt.key}
                href={buildHref(opt.key, botFilter)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium",
                  range.key === opt.key
                    ? "bg-primary text-white"
                    : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                {opt.label}
              </Link>
            ))}
          </div>
          <Link
            href={buildHref(range.key, botFilter === "bot" ? "human" : "bot")}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-medium",
              botFilter === "bot"
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-zinc-200 bg-surface text-zinc-600 hover:bg-zinc-100",
            )}
          >
            {botFilter === "bot" ? "Bot-Ansicht aktiv" : "Bot-Auswertung"}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={botFilter === "bot" ? "Bot-Aufrufe (Zeitraum)" : "Menschliche Klicks"}
          value={formatNumber(botFilter === "bot" ? stats.botClicks : stats.humanClicks)}
          hint={range.label}
        />
        <StatCard
          label="Unique Visitors"
          value={formatNumber(stats.uniqueVisitors)}
          hint="anonymisiert, täglich rotierender Hash"
        />
        <StatCard
          label="Erkannte Bots"
          value={formatNumber(stats.botClicks)}
          hint="im gewählten Zeitraum"
        />
        <StatCard label="Aktive Kurzlinks" value={formatNumber(stats.activeLinks)} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Klicks heute" value={formatNumber(stats.clicksToday)} />
        <StatCard label="Klicks gestern" value={formatNumber(stats.clicksYesterday)} />
        <StatCard label="Letzte 7 Tage" value={formatNumber(stats.clicksLast7Days)} />
        <StatCard label="Letzte 30 Tage" value={formatNumber(stats.clicksLast30Days)} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Ø Klicks pro Tag"
          value={formatNumber(Math.round(stats.avgClicksPerDay * 10) / 10)}
          hint={range.label}
        />
        <StatCard
          label="Bridge-Page geladen"
          value={formatPercent(stats.bridgeLoadedRate)}
          hint="Anteil clientseitig bestätigter Aufrufe"
        />
        <StatCard
          label="Tracking angestoßen"
          value={formatPercent(stats.trackingFiredRate)}
          hint="Anteil mit ausgelösten Pixel-Events"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Klicks pro Tag</CardTitle>
        </CardHeader>
        <CardContent>
          <ClicksPerDayChart data={perDay} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Klicks nach Uhrzeit</CardTitle>
          </CardHeader>
          <CardContent>
            <BucketBarChart data={byHour} title="Klicks nach Uhrzeit" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Klicks nach Wochentag</CardTitle>
          </CardHeader>
          <CardContent>
            <BucketBarChart data={byWeekday} title="Klicks nach Wochentag" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Klicks nach Source</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList data={bySource} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Klicks nach Kampagne</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList data={byCampaign} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Klicks nach Kurzlink</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList data={byCode.map((d) => ({ ...d, label: `/${d.label}` }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Klicks nach Gerätetyp</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList data={byDevice} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Klicks nach Land</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList data={byCountry} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
