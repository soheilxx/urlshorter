import type { Metadata } from "next";
import Link from "next/link";
import { getAmazonSettings } from "@/lib/amazon/amazon-settings";
import {
  diffLeaderboard,
  leaderboardAggregates,
  type LeaderboardEntryInput,
} from "@/lib/amazon/leaderboard-math";
import {
  LeaderboardView,
  type LeaderboardViewEntry,
} from "@/components/admin/amazon/leaderboard-view";
import { StaleBadge } from "@/components/admin/amazon/movement-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBerlinDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Amazon Top 25" };
export const dynamic = "force-dynamic";

function entryToInput(entry: {
  position: number;
  bestsellerRank: number;
  asin: string;
  titleSnapshot: string;
  ratingSnapshot: number | null;
  reviewCountSnapshot: number | null;
  priceSnapshot: unknown;
  preorderSnapshot: boolean | null;
  imageUrlSnapshot: string | null;
}): LeaderboardEntryInput {
  return {
    position: entry.position,
    bestsellerRank: entry.bestsellerRank,
    asin: entry.asin,
    title: entry.titleSnapshot,
    rating: entry.ratingSnapshot,
    reviewCount: entry.reviewCountSnapshot,
    price: entry.priceSnapshot !== null ? Number(entry.priceSnapshot) : null,
    preorder: entry.preorderSnapshot,
    imageUrl: entry.imageUrlSnapshot,
  };
}

/** Top-25-Bestsellerlisten mit Cover-Grid, Snapshot-Auswahl und Vergleich. */
export default async function AmazonTop25Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; snapshot?: string; compare?: string }>;
}) {
  await requireRole("ADMIN", "MARKETER", "VIEWER");
  const params = await searchParams;
  const settings = await getAmazonSettings();

  const categories = await prisma.amazonCategory.findMany({
    where: { leaderboardEnabled: true, active: true },
    orderBy: [{ categoryType: "asc" }, { canonicalName: "asc" }],
    include: {
      providerMappings: { where: { provider: "RAINFOREST" } },
      _count: { select: { leaderboardSnapshots: true } },
    },
  });

  const selectedCategory =
    categories.find((c) => c.id === params.category) ??
    categories.find((c) => c._count.leaderboardSnapshots > 0) ??
    categories[0] ??
    null;

  if (!selectedCategory) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold tracking-tight">Top 25</h1>
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-400">
            Keine Top-25-Kategorie aktiviert –{" "}
            <Link href="/admin/amazon/kategorien" className="underline">
              Kategorien verwalten
            </Link>
            .
          </CardContent>
        </Card>
      </div>
    );
  }

  const snapshots = await prisma.amazonLeaderboardSnapshot.findMany({
    where: { categoryId: selectedCategory.id },
    orderBy: { observedAt: "desc" },
    take: 30,
    select: { id: true, observedAt: true, complete: true, returnedCount: true },
  });

  const selectedSnapshotMeta =
    snapshots.find((s) => s.id === params.snapshot) ?? snapshots[0] ?? null;

  const hasMapping = selectedCategory.providerMappings.length > 0;

  if (!selectedSnapshotMeta) {
    return (
      <div className="space-y-4">
        <PageHeader categories={categories} selectedId={selectedCategory.id} snapshots={[]} />
        <Card>
          <CardContent className="space-y-2 py-10 text-center text-sm text-zinc-400">
            {hasMapping ? (
              <p>
                Für „{selectedCategory.canonicalName}“ liegt noch kein Bestseller-Snapshot vor –
                der nächste Top-25-Job holt die Liste.
              </p>
            ) : (
              <>
                <p>
                  „{selectedCategory.canonicalName}“ besitzt (noch) keine aufgelöste
                  Amazon-Bestsellerliste. Es wird bewusst KEINE Ersatzliste aus einer normalen
                  Suche angezeigt.
                </p>
                <p>
                  <Link href="/admin/amazon/kategorien" className="underline">
                    Kategorie auflösen bzw. verwandte Kategorie als Vorschlag suchen →
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [selectedSnapshot, compareSnapshot] = await Promise.all([
    prisma.amazonLeaderboardSnapshot.findUnique({
      where: { id: selectedSnapshotMeta.id },
      include: { entries: { orderBy: { position: "asc" } } },
    }),
    params.compare
      ? prisma.amazonLeaderboardSnapshot.findFirst({
          where: { id: params.compare, categoryId: selectedCategory.id },
          include: { entries: { orderBy: { position: "asc" } } },
        })
      : null,
  ]);
  if (!selectedSnapshot) return null;

  // Vergleichsbasis: explizit gewählter Snapshot oder der direkte Vorgänger
  const previousSnapshot =
    compareSnapshot ??
    (await prisma.amazonLeaderboardSnapshot.findFirst({
      where: { categoryId: selectedCategory.id, observedAt: { lt: selectedSnapshot.observedAt } },
      orderBy: { observedAt: "desc" },
      include: { entries: { orderBy: { position: "asc" } } },
    }));

  // Historische ASINs (für Wiedereinsteiger) + Verweildauer-Statistiken
  const historicalEntries = await prisma.amazonLeaderboardEntry.findMany({
    where: {
      snapshot: {
        categoryId: selectedCategory.id,
        observedAt: { lt: previousSnapshot?.observedAt ?? selectedSnapshot.observedAt },
      },
    },
    select: { asin: true, position: true },
  });
  const historicalAsins = new Set(historicalEntries.map((e) => e.asin));
  const statsByAsin = new Map<string, { best: number; appearances: number }>();
  for (const entry of [...historicalEntries, ...(previousSnapshot?.entries ?? []), ...selectedSnapshot.entries]) {
    const existing = statsByAsin.get(entry.asin);
    if (!existing) {
      statsByAsin.set(entry.asin, { best: entry.position, appearances: 1 });
    } else {
      existing.best = Math.min(existing.best, entry.position);
      existing.appearances += 1;
    }
  }

  const ownEditions = await prisma.amazonEdition.findMany({ select: { asin: true } });
  const ownAsins = new Set(ownEditions.map((e) => e.asin));

  const diff = diffLeaderboard(
    selectedSnapshot.entries.map(entryToInput),
    previousSnapshot ? previousSnapshot.entries.map(entryToInput) : null,
    historicalAsins,
  );
  const aggregates = leaderboardAggregates(
    selectedSnapshot.entries.map(entryToInput),
    selectedSnapshot.requestedLimit,
  );

  const entryByAsin = new Map(selectedSnapshot.entries.map((e) => [e.asin, e]));
  const viewEntries: LeaderboardViewEntry[] = diff.entries.map((entry) => {
    const dbEntry = entryByAsin.get(entry.asin)!;
    const stats = statsByAsin.get(entry.asin);
    return {
      position: entry.position,
      bestsellerRank: entry.bestsellerRank,
      asin: entry.asin,
      title: dbEntry.titleSnapshot,
      author: dbEntry.authorSnapshot,
      format: dbEntry.formatSnapshot,
      imageUrl: dbEntry.imageUrlSnapshot,
      amazonUrl: dbEntry.affiliateUrlSnapshot ?? dbEntry.productUrlSnapshot,
      price: dbEntry.priceRawSnapshot ?? (dbEntry.priceSnapshot !== null ? `${Number(dbEntry.priceSnapshot).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €` : null),
      rating: dbEntry.ratingSnapshot,
      reviewCount: dbEntry.reviewCountSnapshot,
      preorder: dbEntry.preorderSnapshot,
      isOwn: ownAsins.has(entry.asin),
      change: previousSnapshot ? entry.change : { kind: "unknown" },
      bestPosition: stats?.best ?? null,
      appearances: stats?.appearances ?? null,
    };
  });

  const intervalMinutes =
    selectedCategory.refreshIntervalOverride ?? settings.leaderboardIntervalMinutes;
  const ageMs = Date.now() - selectedSnapshot.fetchedAt.getTime();
  const isStale = ageMs > intervalMinutes * 60 * 1000 * 2.5;

  return (
    <div className="space-y-6">
      <PageHeader
        categories={categories}
        selectedId={selectedCategory.id}
        snapshots={snapshots.map((s) => ({
          id: s.id,
          label: `${formatBerlinDateTime(s.observedAt)} (${s.returnedCount})`,
        }))}
        selectedSnapshotId={selectedSnapshot.id}
        compareSnapshotId={compareSnapshot?.id}
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
        <span>
          Snapshot: {formatBerlinDateTime(selectedSnapshot.observedAt)} ·{" "}
          {formatNumber(selectedSnapshot.returnedCount)} von{" "}
          {formatNumber(selectedSnapshot.requestedLimit)} Einträgen
        </span>
        {!selectedSnapshot.complete ? (
          <Badge variant="warning">partial{selectedSnapshot.partialReason ? ` – ${selectedSnapshot.partialReason}` : ""}</Badge>
        ) : null}
        {isStale ? <StaleBadge ageLabel={`${Math.round(ageMs / 3_600_000)} h alt`} /> : null}
        {previousSnapshot ? (
          <span className="text-xs text-zinc-400">
            Vergleich mit {formatBerlinDateTime(previousSnapshot.observedAt)}
          </span>
        ) : (
          <span className="text-xs text-zinc-400">Kein Vergleichs-Snapshot (erste Messung)</span>
        )}
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: "Platz 1",
            value: viewEntries[0]?.title ?? "–",
          },
          {
            label: "Neueinsteiger",
            value: String(diff.newEntries.length),
          },
          { label: "Wiedereinsteiger", value: String(diff.reEntries.length) },
          { label: "Aussteiger", value: String(diff.exits.length) },
          {
            label: "Turnover",
            value: diff.turnover !== null ? `${Math.round(diff.turnover * 100)} %` : "–",
          },
          {
            label: "Ø Bewertung",
            value:
              aggregates.averageRating !== null
                ? `★ ${aggregates.averageRating.toFixed(1)}`
                : "–",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-zinc-200 bg-surface p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{stat.label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-zinc-900" title={stat.value}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
        <span>
          Ø Preis:{" "}
          {aggregates.averagePrice !== null
            ? `${aggregates.averagePrice.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`
            : "–"}
        </span>
        <span>
          Median: {aggregates.medianPrice !== null ? `${aggregates.medianPrice.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €` : "–"}
        </span>
        <span>
          Spanne:{" "}
          {aggregates.priceRange
            ? `${aggregates.priceRange.min.toLocaleString("de-DE", { minimumFractionDigits: 2 })}–${aggregates.priceRange.max.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`
            : "–"}
        </span>
        <span>
          Vorbestellbar:{" "}
          {aggregates.preorderShare !== null ? `${Math.round(aggregates.preorderShare * 100)} %` : "unbekannt"}
        </span>
        <span>Ohne Cover: {aggregates.missingCovers}</span>
        {diff.biggestClimber ? (
          <span className="text-emerald-700">
            Größter Aufsteiger: {entryByAsin.get(diff.biggestClimber.asin)?.titleSnapshot ?? diff.biggestClimber.asin} (+{diff.biggestClimber.movement})
          </span>
        ) : null}
        {diff.biggestFaller ? (
          <span className="text-red-700">
            Größter Absteiger: {entryByAsin.get(diff.biggestFaller.asin)?.titleSnapshot ?? diff.biggestFaller.asin} ({diff.biggestFaller.movement})
          </span>
        ) : null}
      </div>

      <LeaderboardView
        entries={viewEntries}
        exportBase={`/api/export/amazon?type=leaderboard&snapshotId=${selectedSnapshot.id}`}
      />

      <p className="text-xs text-zinc-400">
        Reihenfolge exakt wie vom Provider geliefert (Rainforest Bestseller). Als Amazon-Partner
        verdienen wir an qualifizierten Verkäufen über die Amazon-Links.
      </p>
    </div>
  );
}

function PageHeader({
  categories,
  selectedId,
  snapshots,
  selectedSnapshotId,
  compareSnapshotId,
}: {
  categories: Array<{
    id: string;
    canonicalName: string;
    _count: { leaderboardSnapshots: number };
  }>;
  selectedId: string;
  snapshots: Array<{ id: string; label: string }>;
  selectedSnapshotId?: string;
  compareSnapshotId?: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Link href="/admin/amazon" className="text-sm text-zinc-500 hover:underline">
          ← Amazon Rankings
        </Link>
        <h1 className="mt-1 text-xl font-bold tracking-tight">Top-25-Bestsellerlisten</h1>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/admin/amazon/top25?category=${category.id}`}
            className={
              category.id === selectedId
                ? "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            }
          >
            {category.canonicalName}
            <span className="ml-1 text-[10px] opacity-60">
              ({category._count.leaderboardSnapshots})
            </span>
          </Link>
        ))}
      </div>
      {snapshots.length > 1 ? (
        <form method="get" className="flex flex-wrap items-end gap-2 text-xs">
          <input type="hidden" name="category" value={selectedId} />
          <div>
            <label htmlFor="t25-snapshot" className="mb-1 block font-medium text-zinc-600">
              Snapshot-Zeitpunkt
            </label>
            <select
              id="t25-snapshot"
              name="snapshot"
              defaultValue={selectedSnapshotId}
              className="h-8 rounded-lg border border-zinc-300 bg-surface px-2 text-xs"
            >
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="t25-compare" className="mb-1 block font-medium text-zinc-600">
              Vergleichen mit
            </label>
            <select
              id="t25-compare"
              name="compare"
              defaultValue={compareSnapshotId ?? ""}
              className="h-8 rounded-lg border border-zinc-300 bg-surface px-2 text-xs"
            >
              <option value="">Direkter Vorgänger</option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="h-8 rounded-lg border border-zinc-300 px-3 font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Anzeigen
          </button>
        </form>
      ) : null}
    </div>
  );
}
