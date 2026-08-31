import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAmazonSettings } from "@/lib/amazon/amazon-settings";
import { CATEGORY_TYPE_WEBSITE, PROVIDER_LABELS } from "@/lib/amazon/constants";
import { buildEditionClickStats } from "@/lib/amazon/clicks";
import { buildCategoryKpis, loadCanonicalSeries } from "@/lib/amazon/kpis";
import { creatorsAwaitingEligibility } from "@/lib/amazon/provider-display";
import { forecastQuota } from "@/lib/amazon/quota";
import { MovementBadge, RankValue, StaleBadge } from "@/components/admin/amazon/movement-badge";
import { PageHeader } from "@/components/admin/page-header";
import { RankChart, type RankChartSeries } from "@/components/admin/amazon/rank-chart";
import { ManualJobForm } from "@/components/admin/amazon/amazon-forms";
import { RankSparkline } from "@/components/admin/amazon/sparkline";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBerlinDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Amazon Rankings" };
export const dynamic = "force-dynamic";

/* Mitteltöne, die in hellem UND dunklem Theme lesbar bleiben. */
const CHART_COLORS = ["#1f62ff", "#7c3aed", "#16a34a", "#d97706", "#dc2626", "#0891b2", "#db2777"];

/** Amazon-Rankings-Übersicht: eigenes Buch, KPIs, Hauptchart, Status. */
export default async function AmazonOverviewPage() {
  const session = await requireRole("ADMIN", "MARKETER", "VIEWER");
  const isAdmin = session.role === "ADMIN";
  const settings = await getAmazonSettings();

  const edition = await prisma.amazonEdition.findFirst({
    where: { active: true },
    include: { book: true },
    orderBy: { createdAt: "asc" },
  });

  if (!edition) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Amazon Rankings</h1>
          <p className="text-sm text-zinc-500">
            Verkaufsrang-Tracking für „Die Lizenz zum Erfolg“ über Amazon Creators API und
            Rainforest API.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Modul noch nicht initialisiert</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-500">
              Es wurde noch kein Buch angelegt. Der erste Lauf des Rang-Jobs legt Buch, Edition
              (ASIN 3690662508) und die Pflichtkategorien automatisch an.
              {settings.enabled
                ? " Das Modul ist aktiv – der nächste Scheduler-Tick übernimmt das automatisch."
                : " Das Modul ist derzeit deaktiviert (Einstellungen → Modul aktiv)."}
            </p>
            {isAdmin ? (
              <ManualJobForm
                jobs={[{ type: "refresh-primary-book-ranks", label: "Ersteinrichtung + Rang-Abruf starten" }]}
              />
            ) : (
              <p className="text-sm text-zinc-400">
                Die Ersteinrichtung kann nur ein Administrator ausführen.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [categories, providerStatuses, alerts, latestLeaderboard, clickStats, gapCount7d, creatorsWaiting] =
    await Promise.all([
      prisma.amazonCategory.findMany({
        where: {
          active: true,
          OR: [
            { categoryType: CATEGORY_TYPE_WEBSITE },
            { required: true },
            { editionCategories: { some: { editionId: edition.id } } },
          ],
        },
        orderBy: [{ categoryType: "asc" }, { canonicalName: "asc" }],
      }),
      prisma.amazonProviderStatus.findMany(),
      prisma.amazonAlertEvent.findMany({ orderBy: { triggeredAt: "desc" }, take: 8 }),
      prisma.amazonLeaderboardSnapshot.findFirst({
        orderBy: { observedAt: "desc" },
        include: {
          category: { select: { canonicalName: true, id: true } },
          entries: { orderBy: { position: "asc" }, take: 5 },
        },
      }),
      buildEditionClickStats(edition),
      prisma.amazonCanonicalRankSnapshot.count({
        where: {
          editionId: edition.id,
          dataGap: true,
          observedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      creatorsAwaitingEligibility(),
    ]);

  const websiteCategory = categories.find((c) => c.categoryType === CATEGORY_TYPE_WEBSITE);
  const websiteKpis = websiteCategory
    ? await buildCategoryKpis({
        editionId: edition.id,
        categoryId: websiteCategory.id,
        categoryName: websiteCategory.canonicalName,
        categoryType: websiteCategory.categoryType,
        expectedIntervalMinutes: settings.rankIntervalMinutes,
        preorderStartAt: edition.preorderStartAt,
      })
    : null;

  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const chartSeries: RankChartSeries[] = [];
  const categoryRows: Array<{
    id: string;
    name: string;
    rank: number | null;
    movement: number | null;
    percent: number | null;
    stale: boolean;
    sparkPoints: Array<{ rank: number | null }>;
  }> = [];

  for (const [index, category] of categories.entries()) {
    const points = await loadCanonicalSeries(edition.id, category.id, { since: since90d });
    if (points.length > 0) {
      chartSeries.push({
        key: category.id,
        label: category.canonicalName,
        color: CHART_COLORS[index % CHART_COLORS.length]!,
        points: points.map((p) => ({
          t: p.observedAt.getTime(),
          rank: p.rank,
          provider: p.selectedProvider,
          stale: p.stale,
        })),
      });
    }
    // Kategorien ohne jede Messung nicht als "Datenlücke" anzeigen –
    // z. B. Sachbücher (keine eigene Amazon-Liste, Buch dort nie gerankt).
    // Echte Lücken INNERHALB einer Zeitreihe bleiben sichtbar.
    if (points.length === 0) continue;
    const withRank = points.filter((p) => p.rank !== null);
    const current = withRank[withRank.length - 1] ?? null;
    const previous = withRank[withRank.length - 2] ?? null;
    categoryRows.push({
      id: category.id,
      name: category.canonicalName,
      rank: current?.rank ?? null,
      movement:
        previous?.rank != null && current?.rank != null ? previous.rank - current.rank : null,
      percent:
        previous?.rank != null && current?.rank != null && previous.rank > 0
          ? ((previous.rank - current.rank) / previous.rank) * 100
          : null,
      stale: current?.stale ?? false,
      sparkPoints: points.slice(-40).map((p) => ({ rank: p.rank })),
    });
  }

  const annotations = await prisma.amazonAnnotation.findMany({
    where: { timestamp: { gte: since90d } },
    orderBy: { timestamp: "asc" },
    take: 30,
  });

  const rainforestStatus = providerStatuses.find((p) => p.provider === "RAINFOREST");
  const quota = rainforestStatus?.quota as {
    plan?: string;
    creditsUsed?: number;
    creditsLimit?: number;
    creditsRemaining?: number;
    creditsResetAt?: string;
  } | null;
  const forecast = quota
    ? forecastQuota({
        rankIntervalMinutes: settings.rankIntervalMinutes,
        leaderboardIntervalMinutes: settings.leaderboardIntervalMinutes,
        activeLeaderboardCategories: categories.filter((c) => c.leaderboardEnabled).length,
        metadataIntervalMinutes: settings.metadataIntervalMinutes,
        accountStatusIntervalMinutes: settings.accountStatusIntervalMinutes,
        salesEstimationEnabled: settings.salesEstimationEnabled,
        creditsRemaining: quota.creditsRemaining ?? null,
        creditsLimit: quota.creditsLimit ?? null,
        creditsResetAt: quota.creditsResetAt ? new Date(quota.creditsResetAt) : null,
        now: new Date(),
        dailyCreditBudget: settings.dailyCreditBudget,
      })
    : null;

  const w = websiteKpis;
  const websiteRank = w?.summary.current?.rank ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Amazon Rankings"
        description={
          <>
            Verkaufsränge auf Amazon.de – zwei Provider, kanonische Auswahl, alle Zeiten in
            Europe/Berlin.
            {!settings.enabled ? " · Modul derzeit DEAKTIVIERT (keine automatischen Abrufe)." : ""}
          </>
        }
      />

      {/* Buchkarte + KPI-Kacheln */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex gap-4 pt-6">
            {edition.coverMediumUrl ? (
              <div className="relative h-44 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-100 shadow">
                <Image
                  src={edition.coverMediumUrl}
                  alt={`Buchcover: ${edition.book.title}`}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="112px"
                />
              </div>
            ) : (
              <div className="flex h-44 w-28 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-center text-xs text-zinc-400">
                Cover folgt nach erstem Metadaten-Abruf
              </div>
            )}
            <div className="min-w-0 space-y-1.5">
              <p className="font-semibold leading-tight text-zinc-900">{edition.book.title}</p>
              <p className="text-sm text-zinc-500">{edition.book.author}</p>
              <p className="text-xs text-zinc-400">
                {edition.format} · ASIN <span className="font-mono">{edition.asin}</span>
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {edition.preorder ? (
                  <Badge variant="warning">Vorbestellbar</Badge>
                ) : (
                  <Badge variant="success">Erschienen</Badge>
                )}
                {edition.asinValidated ? (
                  <Badge variant="success">ASIN bestätigt</Badge>
                ) : (
                  <Badge variant="muted">ASIN unbestätigt</Badge>
                )}
              </div>
              <p className="pt-1 text-sm text-zinc-700">
                {edition.currentPrice !== null
                  ? `${Number(edition.currentPrice).toLocaleString("de-DE", { minimumFractionDigits: 2 })} ${edition.currency ?? "EUR"}`
                  : "Preis: noch keine Messung"}
              </p>
              <p className="text-xs text-zinc-500">
                {edition.currentRating !== null
                  ? `★ ${edition.currentRating.toLocaleString("de-DE")} (${formatNumber(edition.currentReviewCount ?? 0)} Bewertungen)`
                  : "Noch keine Bewertungen erfasst"}
              </p>
              {edition.metadataObservedAt ? (
                <p className="text-xs text-zinc-400">
                  Stand {formatBerlinDateTime(edition.metadataObservedAt)} ·{" "}
                  {PROVIDER_LABELS[edition.metadataProvider ?? ""] ?? "–"}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <StatCard
            label="Gesamtrang Bücher"
            value={websiteRank !== null ? formatNumber(websiteRank) : "– (Lücke)"}
            hint={
              w?.lastPoint
                ? `Stand ${formatBerlinDateTime(w.lastPoint.observedAt)}`
                : "noch keine Messung"
            }
          />
          <StatCard
            label="Bestwert (gesamt)"
            value={w?.summary.best ? formatNumber(w.summary.best.rank) : "–"}
            hint={w?.summary.best ? formatBerlinDateTime(w.summary.best.observedAt) : undefined}
          />
          <StatCard
            label="24-h-Veränderung"
            value={
              w?.windows["24h"].movement !== null && w?.windows["24h"].movement !== undefined
                ? `${w.windows["24h"].movement > 0 ? "+" : ""}${formatNumber(w.windows["24h"].movement)}`
                : "–"
            }
            hint={
              w?.windows["24h"].improvementPercent != null
                ? `${w.windows["24h"].improvementPercent > 0 ? "+" : ""}${w.windows["24h"].improvementPercent.toFixed(1)} %`
                : undefined
            }
          />
          <StatCard
            label="7-Tage-Veränderung"
            value={
              w?.windows["7d"].movement != null
                ? `${w.windows["7d"].movement > 0 ? "+" : ""}${formatNumber(w.windows["7d"].movement)}`
                : "–"
            }
            hint={
              w?.windows["7d"].improvementPercent != null
                ? `${w.windows["7d"].improvementPercent > 0 ? "+" : ""}${w.windows["7d"].improvementPercent.toFixed(1)} %`
                : undefined
            }
          />
          <StatCard label="Klicks 24 h" value={formatNumber(clickStats.windows["24h"])} hint="eigene Kurzlinks" />
          <StatCard
            label="Datenlücken (7 Tage)"
            value={formatNumber(gapCount7d)}
            hint={gapCount7d > 0 ? "fehlende Messungen bleiben sichtbar" : "vollständig"}
          />
        </div>
      </div>

      {/* Hauptchart */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking-Verlauf (Rang 1 oben)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartSeries.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">
              Noch keine Messungen – nach dem ersten Rang-Abruf erscheint hier der Verlauf.
            </p>
          ) : (
            <RankChart
              series={chartSeries}
              annotations={annotations.map((a) => ({ t: a.timestamp.getTime(), title: a.title }))}
            />
          )}
        </CardContent>
      </Card>

      {/* Kategorienränge */}
      <Card>
        <CardHeader>
          <CardTitle>Aktuelle Kategorienränge</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryRows.length === 0 ? (
            <p className="text-sm text-zinc-400">Noch keine Kategorien erfasst.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryRows.map((row) => (
                <li key={row.id} className="rounded-xl border border-zinc-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-800">{row.name}</p>
                    <RankSparkline points={row.sparkPoints} label={row.name} width={80} height={24} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-lg font-bold tabular-nums text-zinc-900">
                      <RankValue rank={row.rank} />
                    </span>
                    <MovementBadge movement={row.movement} percent={row.percent} />
                  </div>
                  {row.stale ? (
                    <div className="mt-1.5">
                      <StaleBadge />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Providerstatus + Credits */}
        <Card>
          <CardHeader>
            <CardTitle>Provider & Credits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {providerStatuses.length === 0 ? (
              <p className="text-zinc-400">Noch kein Health-Check gelaufen.</p>
            ) : (
              providerStatuses.map((status) => (
                <div key={status.provider} className="flex items-center justify-between gap-2">
                  <span>{PROVIDER_LABELS[status.provider] ?? status.provider}</span>
                  {!status.configured ? (
                    <Badge variant="muted">nicht konfiguriert</Badge>
                  ) : status.circuitBreakerState === "open" ? (
                    <Badge variant="danger">Circuit offen</Badge>
                  ) : status.healthy ? (
                    <Badge variant="success">gesund</Badge>
                  ) : status.provider === "CREATORS" && creatorsWaiting ? (
                    <Badge variant="warning">wartet auf Amazon-Freischaltung</Badge>
                  ) : (
                    <Badge variant="warning">gestört</Badge>
                  )}
                </div>
              ))
            )}
            {quota ? (
              <div className="border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                <p>
                  Rainforest: {formatNumber(quota.creditsRemaining ?? 0)} von{" "}
                  {formatNumber(quota.creditsLimit ?? 0)} Credits übrig
                  {quota.plan ? ` · Plan ${quota.plan}` : ""}
                </p>
                {forecast ? (
                  <p className="mt-1">
                    Prognose: ~{formatNumber(Math.round(forecast.projectedCreditsPerDay))} Credits/Tag
                    {forecast.warnLevel !== "ok" ? (
                      <span className="ml-1 font-medium text-amber-600">
                        ({forecast.warnLevel === "critical" ? "kritisch" : forecast.warnLevel === "warning" ? "Warnung" : forecast.warnLevel === "hint" ? "Hinweis" : "Budgetprognose überschritten"})
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="border-t border-zinc-100 pt-3 text-xs text-zinc-400">
                Credit-Status folgt nach dem ersten Account-Abruf.
              </p>
            )}
            <Link
              href="/admin/amazon/provider"
              className="block text-xs font-medium text-zinc-600 underline-offset-2 hover:underline"
            >
              Zum Providerstatus →
            </Link>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-zinc-400">Keine Alerts ausgelöst.</p>
            ) : (
              <ul className="space-y-2.5">
                {alerts.map((alert) => (
                  <li key={alert.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          alert.severity === "critical"
                            ? "danger"
                            : alert.severity === "warning"
                              ? "warning"
                              : "success"
                        }
                      >
                        {alert.severity === "critical" ? "Kritisch" : alert.severity === "warning" ? "Warnung" : "Info"}
                      </Badge>
                      <span className="min-w-0 truncate font-medium text-zinc-800">{alert.title}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{alert.message}</p>
                    <p className="text-[11px] text-zinc-400">
                      {formatBerlinDateTime(alert.triggeredAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top-25-Vorschau */}
        <Card>
          <CardHeader>
            <CardTitle>Top-25-Vorschau</CardTitle>
          </CardHeader>
          <CardContent>
            {!latestLeaderboard ? (
              <p className="text-sm text-zinc-400">
                Noch kein Bestseller-Snapshot. Kategorien auflösen und Top-25-Job ausführen.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">
                  {latestLeaderboard.category.canonicalName} ·{" "}
                  {formatBerlinDateTime(latestLeaderboard.observedAt)}
                </p>
                <ol className="space-y-1.5">
                  {latestLeaderboard.entries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                        {entry.bestsellerRank}
                      </span>
                      <span className="min-w-0 truncate">{entry.titleSnapshot}</span>
                      {entry.editionId ? <Badge variant="success">Dein Buch</Badge> : null}
                    </li>
                  ))}
                </ol>
                <Link
                  href={`/admin/amazon/top25?category=${latestLeaderboard.category.id}`}
                  className="block text-xs font-medium text-zinc-600 underline-offset-2 hover:underline"
                >
                  Vollständige Liste →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
