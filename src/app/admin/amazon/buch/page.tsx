import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAmazonSettings } from "@/lib/amazon/amazon-settings";
import {
  CLICK_CORRELATION_DISCLAIMER,
  KPI_WINDOWS,
  PROVIDER_LABELS,
  SALES_ESTIMATE_DISCLAIMER,
} from "@/lib/amazon/constants";
import { buildEditionClickStats } from "@/lib/amazon/clicks";
import { buildCategoryKpis } from "@/lib/amazon/kpis";
import { EditionForm } from "@/components/admin/amazon/amazon-forms";
import { MovementBadge, RankValue, StaleBadge } from "@/components/admin/amazon/movement-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBerlinDate, formatBerlinDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Amazon Buchdetail" };
export const dynamic = "force-dynamic";

function formatDuration(ms: number | null): string {
  if (ms === null) return "–";
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} Tage`;
}

/** Buchdetail: Editionen, KPIs, Providervergleich, Klicks, Snapshots. */
export default async function AmazonBookPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const session = await requireRole("ADMIN", "MARKETER", "VIEWER");
  const isAdmin = session.role === "ADMIN";
  const params = await searchParams;
  const settings = await getAmazonSettings();

  const book = await prisma.amazonBook.findFirst({
    include: { editions: { orderBy: { createdAt: "asc" } } },
  });
  if (!book || book.editions.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold tracking-tight">Buchdetail</h1>
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-400">
            Noch kein Buch angelegt –{" "}
            <Link href="/admin/amazon" className="underline">
              zur Übersicht (Ersteinrichtung)
            </Link>
            .
          </CardContent>
        </Card>
      </div>
    );
  }

  const edition =
    book.editions.find((e) => e.id === params.edition) ??
    book.editions.find((e) => e.id === book.primaryEditionId) ??
    book.editions[0]!;

  const [editionCategories, clickStats, annotations, canonicalSnapshots, latestObservations, salesEstimates, actualSales] =
    await Promise.all([
      prisma.amazonEditionCategory.findMany({
        where: { editionId: edition.id },
        include: { category: true },
        orderBy: { firstSeenAt: "asc" },
      }),
      buildEditionClickStats(edition),
      prisma.amazonAnnotation.findMany({ orderBy: { timestamp: "desc" }, take: 10 }),
      prisma.amazonCanonicalRankSnapshot.findMany({
        where: { editionId: edition.id },
        include: { category: { select: { canonicalName: true } } },
        orderBy: { observedAt: "desc" },
        take: 50,
      }),
      prisma.amazonRankObservation.findMany({
        where: {
          editionId: edition.id,
          observedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
        include: { category: { select: { canonicalName: true, id: true } } },
        orderBy: { observedAt: "desc" },
      }),
      prisma.amazonSalesEstimate.findMany({
        where: { editionId: edition.id },
        orderBy: { observedAt: "desc" },
        take: 3,
      }),
      prisma.amazonActualSalesImport.findMany({
        where: { editionId: edition.id },
        orderBy: { periodStart: "desc" },
        take: 5,
      }),
    ]);

  // Kategorien inkl. WEBSITE-Kategorie für die KPI-Tabellen
  const websiteCategory = await prisma.amazonCategory.findFirst({
    where: { marketplace: edition.marketplace, categoryType: "WEBSITE" },
  });
  const kpiCategories = [
    ...(websiteCategory ? [websiteCategory] : []),
    ...editionCategories.filter((ec) => ec.category.active).map((ec) => ec.category),
  ];
  const kpis = await Promise.all(
    kpiCategories.map((category) =>
      buildCategoryKpis({
        editionId: edition.id,
        categoryId: category.id,
        categoryName: category.canonicalName,
        categoryType: category.categoryType,
        expectedIntervalMinutes: category.refreshIntervalOverride ?? settings.rankIntervalMinutes,
        preorderStartAt: edition.preorderStartAt,
      }),
    ),
  );

  // Providervergleich: jüngste Beobachtung je Kategorie und Provider
  const comparison = new Map<
    string,
    { name: string; creators: number | null; rainforest: number | null; difference: number | null }
  >();
  for (const observation of latestObservations) {
    const key = observation.category.id;
    const entry = comparison.get(key) ?? {
      name: observation.category.canonicalName,
      creators: null,
      rainforest: null,
      difference: null,
    };
    if (observation.provider === "CREATORS" && entry.creators === null) {
      entry.creators = observation.rank;
    }
    if (observation.provider === "RAINFOREST" && entry.rainforest === null) {
      entry.rainforest = observation.rank;
    }
    if (entry.creators !== null && entry.rainforest !== null) {
      entry.difference = Math.abs(entry.creators - entry.rainforest);
    }
    comparison.set(key, entry);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/amazon" className="text-sm text-zinc-500 hover:underline">
            ← Amazon Rankings
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{book.title}</h1>
          <p className="text-sm text-zinc-500">
            {book.author} · {book.publisher ?? "–"} · {book.language ?? "–"}
          </p>
        </div>
        <div className="flex gap-1">
          {book.editions.map((e) => (
            <Link
              key={e.id}
              href={`/admin/amazon/buch?edition=${e.id}`}
              className={
                e.id === edition.id
                  ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
              }
            >
              {e.format}
            </Link>
          ))}
        </div>
      </div>

      {/* Edition-Stammdaten */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex gap-4 pt-6">
            {edition.coverLargeUrl || edition.coverMediumUrl ? (
              <div className="relative h-52 w-32 shrink-0 overflow-hidden rounded-lg bg-zinc-100 shadow">
                <Image
                  src={(edition.coverLargeUrl ?? edition.coverMediumUrl)!}
                  alt={`Buchcover: ${book.title}`}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="128px"
                />
              </div>
            ) : (
              <div className="flex h-52 w-32 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-center text-xs text-zinc-400">
                Kein Cover
              </div>
            )}
            <dl className="min-w-0 space-y-1 text-sm">
              <div>
                <dt className="text-xs text-zinc-400">ASIN</dt>
                <dd className="font-mono">{edition.asin}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">ISBN-13 / ISBN-10</dt>
                <dd className="font-mono text-xs">
                  {edition.isbn13 ?? "–"} / {edition.isbn10 ?? "–"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">Erscheinungstermin</dt>
                <dd>{edition.publicationDate ? formatBerlinDate(edition.publicationDate) : "–"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">Preis / Verfügbarkeit</dt>
                <dd>
                  {edition.currentPrice !== null
                    ? `${Number(edition.currentPrice).toLocaleString("de-DE", { minimumFractionDigits: 2 })} ${edition.currency ?? "EUR"}`
                    : "–"}{" "}
                  · {edition.currentAvailability ?? "–"}
                </dd>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {edition.preorder ? (
                  <Badge variant="warning">Vorbestellbar</Badge>
                ) : (
                  <Badge variant="success">Erschienen</Badge>
                )}
                {edition.asinValidated ? (
                  <Badge variant="success">
                    ASIN bestätigt ({PROVIDER_LABELS[edition.asinValidationProvider ?? ""] ?? "?"})
                  </Badge>
                ) : (
                  <Badge variant="muted">ASIN noch unbestätigt</Badge>
                )}
              </div>
              {edition.productUrl ? (
                <a
                  href={edition.affiliateUrl ?? edition.productUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="block pt-1 text-xs font-medium text-zinc-600 underline-offset-2 hover:underline"
                >
                  Amazon-Produktseite ↗
                </a>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Edition bearbeiten</CardTitle>
            </CardHeader>
            <CardContent>
              <EditionForm
                edition={{
                  id: edition.id,
                  asin: edition.asin,
                  isbn10: edition.isbn10,
                  isbn13: edition.isbn13,
                  format: edition.format,
                  preorder: edition.preorder,
                  trackedShortCode: edition.trackedShortCode,
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Klickzahlen (eigene Kurzlinks)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              {(["1h", "6h", "24h", "7d", "30d"] as const).map((key) => (
                <div key={key}>
                  <p className="text-xs uppercase text-zinc-400">{key}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatNumber(clickStats.windows[key])}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* KPI-Tabellen je Kategorie */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking-Kennzahlen je Kategorie</CardTitle>
        </CardHeader>
        <TableWrapper>
          <Table>
            <Thead>
              <tr>
                <Th>Kategorie</Th>
                <Th className="text-right">Aktuell</Th>
                <Th>Δ letzte Messung</Th>
                {KPI_WINDOWS.map((w) => (
                  <Th key={w.key} className="text-right">
                    {w.key}
                  </Th>
                ))}
                <Th className="text-right">Best</Th>
                <Th className="text-right">Schlechtest</Th>
                <Th className="text-right">Ø / Median</Th>
                <Th className="text-right">Vollständigkeit</Th>
              </tr>
            </Thead>
            <tbody>
              {kpis.map((kpi) => (
                <tr key={kpi.categoryId} className="hover:bg-zinc-50/60">
                  <Td className="font-medium">
                    {kpi.categoryName}
                    {kpi.isStale ? (
                      <span className="ml-1.5">
                        <StaleBadge />
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-right font-semibold tabular-nums">
                    <RankValue rank={kpi.summary.current?.rank ?? null} />
                  </Td>
                  <Td>
                    <MovementBadge
                      movement={kpi.summary.movement}
                      percent={kpi.summary.improvementPercent}
                    />
                  </Td>
                  {KPI_WINDOWS.map((w) => {
                    const change = kpi.windows[w.key];
                    return (
                      <Td key={w.key} className="text-right tabular-nums text-xs">
                        {change.movement !== null ? (
                          <span
                            className={
                              change.movement > 0
                                ? "text-emerald-700"
                                : change.movement < 0
                                  ? "text-red-700"
                                  : "text-zinc-500"
                            }
                          >
                            {change.movement > 0 ? "▲ +" : change.movement < 0 ? "▼ " : "= "}
                            {formatNumber(change.movement)}
                          </span>
                        ) : (
                          <span className="text-zinc-300">–</span>
                        )}
                      </Td>
                    );
                  })}
                  <Td className="text-right text-xs tabular-nums text-emerald-700">
                    {kpi.summary.best ? formatNumber(kpi.summary.best.rank) : "–"}
                  </Td>
                  <Td className="text-right text-xs tabular-nums text-zinc-500">
                    {kpi.summary.worst ? formatNumber(kpi.summary.worst.rank) : "–"}
                  </Td>
                  <Td className="text-right text-xs tabular-nums text-zinc-500">
                    {kpi.summary.average !== null ? formatNumber(Math.round(kpi.summary.average)) : "–"}
                    {" / "}
                    {kpi.summary.median !== null ? formatNumber(Math.round(kpi.summary.median)) : "–"}
                  </Td>
                  <Td className="text-right text-xs tabular-nums">
                    {kpi.summary.completenessPercent !== null
                      ? `${kpi.summary.completenessPercent.toFixed(0)} %`
                      : "–"}
                    {kpi.summary.gaps.count > 0 ? (
                      <span className="ml-1 text-amber-600">({kpi.summary.gaps.count} Lücken)</span>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      </Card>

      {/* Weitere Kennzahlen + Schwellen */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dynamik & Serien</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {kpis.map((kpi) => (
                <li key={kpi.categoryId} className="rounded-lg border border-zinc-100 p-2.5">
                  <p className="font-medium text-zinc-800">{kpi.categoryName}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Geschwindigkeit:{" "}
                    {kpi.summary.velocityPerDay !== null
                      ? `${kpi.summary.velocityPerDay > 0 ? "+" : ""}${formatNumber(Math.round(kpi.summary.velocityPerDay))} Plätze/Tag`
                      : "–"}{" "}
                    · Momentum:{" "}
                    {kpi.summary.momentum !== null
                      ? `${kpi.summary.momentum > 0 ? "+" : ""}${formatNumber(Math.round(kpi.summary.momentum))}`
                      : "–"}{" "}
                    · Serie: {kpi.summary.streaks.current > 0 ? `+${kpi.summary.streaks.current}` : kpi.summary.streaks.current}{" "}
                    (max. +{kpi.summary.streaks.longestImprovement} / −{kpi.summary.streaks.longestDecline})
                  </p>
                  <p className="text-xs text-zinc-500">
                    Größter Sprung:{" "}
                    {kpi.summary.jumps.biggestImprovement
                      ? `+${formatNumber(kpi.summary.jumps.biggestImprovement.movement)}`
                      : "–"}{" "}
                    /{" "}
                    {kpi.summary.jumps.biggestDecline
                      ? formatNumber(kpi.summary.jumps.biggestDecline.movement)
                      : "–"}{" "}
                    · Seit Verbesserung: {formatDuration(kpi.summary.timeSinceImprovementMs)} · Seit
                    Bestwert: {formatDuration(kpi.summary.timeSinceBestMs)}
                  </p>
                  {kpi.bestSincePreorder ? (
                    <p className="text-xs text-zinc-500">
                      Bester Rang seit Vorbestellstart: {formatNumber(kpi.bestSincePreorder.rank)} (
                      {formatBerlinDateTime(kpi.bestSincePreorder.observedAt)})
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schwellen (Dauer & Eintritt)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {kpis.map((kpi) => (
                <li key={kpi.categoryId}>
                  <p className="mb-1 font-medium text-zinc-800">{kpi.categoryName}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {kpi.thresholds.map((threshold) => (
                      <span
                        key={threshold.threshold}
                        title={
                          threshold.firstReachedAt
                            ? `Erstmals erreicht: ${formatBerlinDateTime(threshold.firstReachedAt)} · Dauer: ${formatDuration(threshold.totalDurationMs)}`
                            : "Noch nicht erreicht"
                        }
                        className={
                          threshold.currentlyIn
                            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                            : threshold.reached
                              ? "rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                              : "rounded-full bg-zinc-50 px-2 py-0.5 text-xs text-zinc-300"
                        }
                      >
                        Top {formatNumber(threshold.threshold)}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Providervergleich */}
      <Card>
        <CardHeader>
          <CardTitle>Providervergleich (jüngste Messungen, 48 h)</CardTitle>
        </CardHeader>
        <TableWrapper>
          <Table>
            <Thead>
              <tr>
                <Th>Kategorie</Th>
                <Th className="text-right">Amazon Creators</Th>
                <Th className="text-right">Rainforest</Th>
                <Th className="text-right">Abweichung</Th>
              </tr>
            </Thead>
            <tbody>
              {comparison.size === 0 ? (
                <tr>
                  <Td colSpan={4} className="py-8 text-center text-zinc-400">
                    Noch keine Beobachtungen in den letzten 48 Stunden.
                  </Td>
                </tr>
              ) : (
                [...comparison.values()].map((row) => (
                  <tr key={row.name} className="hover:bg-zinc-50/60">
                    <Td className="font-medium">{row.name}</Td>
                    <Td className="text-right tabular-nums">
                      <RankValue rank={row.creators} />
                    </Td>
                    <Td className="text-right tabular-nums">
                      <RankValue rank={row.rainforest} />
                    </Td>
                    <Td className="text-right tabular-nums">
                      {row.difference !== null ? (
                        <span className={row.difference > 0 ? "text-amber-600" : "text-zinc-400"}>
                          {formatNumber(row.difference)}
                        </span>
                      ) : (
                        "–"
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrapper>
        <CardContent className="border-t border-zinc-100">
          <p className="text-xs text-zinc-400">
            Provider aktualisieren zeitversetzt – eine Abweichung ist ein
            Datenqualitätsindikator, kein Fehler eines Providers. Beide Werte werden gespeichert.
          </p>
        </CardContent>
      </Card>

      {/* Klicks + Annotationen */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Klick-Verknüpfung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-5 gap-2">
              {(["1h", "6h", "24h", "7d", "30d"] as const).map((key) => (
                <div key={key}>
                  <p className="text-xs uppercase text-zinc-400">{key}</p>
                  <p className="font-semibold tabular-nums">{formatNumber(clickStats.windows[key])}</p>
                </div>
              ))}
            </div>
            {clickStats.bySource.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-500">Klicks je Quelle (30 Tage)</p>
                <ul className="space-y-1 text-xs">
                  {clickStats.bySource.slice(0, 6).map((row) => (
                    <li key={row.source} className="flex justify-between">
                      <span>{row.source}</span>
                      <span className="tabular-nums">{formatNumber(row.clicks)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {clickStats.spikes.length > 0 ? (
              <p className="text-xs text-zinc-500">
                Klickspitzen (7 Tage):{" "}
                {clickStats.spikes
                  .slice(-3)
                  .map((s) => `${formatBerlinDateTime(new Date(s.hourIso))} (${s.clicks})`)
                  .join(", ")}
              </p>
            ) : null}
            <p className="rounded-lg bg-zinc-50 p-2.5 text-xs text-zinc-500">
              {CLICK_CORRELATION_DISCLAIMER}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kampagnen-Annotationen</CardTitle>
          </CardHeader>
          <CardContent>
            {annotations.length === 0 ? (
              <p className="text-sm text-zinc-400">
                Keine Annotationen – anlegen unter Einstellungen.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {annotations.map((annotation) => (
                  <li key={annotation.id} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-800">{annotation.title}</p>
                      {annotation.description ? (
                        <p className="text-xs text-zinc-500">{annotation.description}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-zinc-400">
                      {formatBerlinDateTime(annotation.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Verkaufsschätzung + echte Verkäufe */}
      {(salesEstimates.length > 0 || actualSales.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {salesEstimates.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Verkaufsschätzung (extern, geschätzt)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {salesEstimates.map((estimate) => (
                  <p key={estimate.id}>
                    <Badge variant="warning">geschätzt</Badge>{" "}
                    {estimate.estimateLow !== null && estimate.estimateHigh !== null
                      ? `${formatNumber(estimate.estimateLow)}–${formatNumber(estimate.estimateHigh)}`
                      : estimate.estimateValue !== null
                        ? `≈ ${formatNumber(estimate.estimateValue)}`
                        : "–"}{" "}
                    Exemplare ({estimate.estimatedPeriod}) ·{" "}
                    {PROVIDER_LABELS[estimate.provider] ?? estimate.provider} · Stand{" "}
                    {formatBerlinDateTime(estimate.observedAt)}
                  </p>
                ))}
                <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                  {SALES_ESTIMATE_DISCLAIMER}
                </p>
              </CardContent>
            </Card>
          ) : null}
          {actualSales.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Importierte echte Verkäufe</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {actualSales.map((row) => (
                    <li key={row.id} className="flex justify-between">
                      <span>
                        {formatBerlinDate(row.periodStart)} – {formatBerlinDate(row.periodEnd)} ·{" "}
                        {row.source}
                      </span>
                      <span className="font-semibold tabular-nums">{formatNumber(row.units)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {/* Snapshot-Tabelle + Export */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Letzte kanonische Snapshots</CardTitle>
          <div className="flex gap-2 text-xs">
            {[
              { href: "/api/export/amazon?type=ranks&format=csv", label: "CSV-Export" },
              { href: "/api/export/amazon?type=ranks&format=json", label: "JSON-Export" },
              {
                href: "/api/export/amazon?type=observations&format=csv",
                label: "Provider-Rohdaten (CSV)",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className="rounded-lg border border-zinc-200 px-2.5 py-1.5 font-medium text-zinc-600 hover:bg-zinc-50"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </CardHeader>
        <TableWrapper>
          <Table>
            <Thead>
              <tr>
                <Th>Zeitpunkt</Th>
                <Th>Kategorie</Th>
                <Th className="text-right">Rang</Th>
                <Th>Provider</Th>
                <Th>Auswahlgrund</Th>
                <Th>Status</Th>
              </tr>
            </Thead>
            <tbody>
              {canonicalSnapshots.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="py-8 text-center text-zinc-400">
                    Noch keine Snapshots.
                  </Td>
                </tr>
              ) : (
                canonicalSnapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="hover:bg-zinc-50/60">
                    <Td className="whitespace-nowrap text-zinc-500">
                      {formatBerlinDateTime(snapshot.observedAt)}
                    </Td>
                    <Td>{snapshot.category.canonicalName}</Td>
                    <Td className="text-right font-medium tabular-nums">
                      <RankValue rank={snapshot.canonicalRank} />
                    </Td>
                    <Td className="text-xs">
                      {snapshot.selectedProvider
                        ? PROVIDER_LABELS[snapshot.selectedProvider]
                        : "–"}
                    </Td>
                    <Td className="font-mono text-xs text-zinc-500">{snapshot.selectionReason}</Td>
                    <Td>
                      {snapshot.dataGap ? (
                        <Badge variant="warning">Datenlücke</Badge>
                      ) : snapshot.stale ? (
                        <Badge variant="warning">stale</Badge>
                      ) : (
                        <Badge variant="success">live</Badge>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrapper>
      </Card>
    </div>
  );
}
