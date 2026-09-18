import { Download, Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterPanel } from "@/components/admin/filter-panel";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ENTRY_PATHS,
  RETAILERS,
  retailerLabel,
  SWEEPSTAKES_STATUS_LABELS,
} from "@/lib/gewinnspiel-config";
import {
  buildSweepstakesWhere,
  getCampaignCounts,
  getSweepstakesStats,
  parseSweepstakesFilters,
  SWEEPSTAKES_PAGE_SIZE,
} from "@/lib/sweepstakes-admin";
import { CAMPAIGN_LIST, campaignLabel, getCampaign } from "@/lib/sweepstakes-campaign";
import { maskEmail } from "@/lib/sweepstakes-validation";
import { formatBerlinDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Gewinnspiel" };
export const dynamic = "force-dynamic";

const STATUS_BADGES: Record<string, "success" | "muted" | "warning" | "danger"> = {
  RECEIVED: "muted",
  IN_REVIEW: "warning",
  REVIEWED: "success",
  INVALID: "danger",
  WINNER: "warning",
  NOT_WON: "muted",
  DELETED: "danger",
};

const CAMPAIGN_BADGES: Record<string, "success" | "muted" | "warning" | "danger"> = {
  dubai_2026: "muted",
  cards_2026: "success",
};

/**
 * Admin-Übersicht der Gewinnspiel-Teilnahmen. Die Kampagne (Dubai / Cards)
 * ist Bestandteil jeder Abfrage: entweder ausdrücklich gefiltert oder
 * „alle Kampagnen“ mit sichtbarer Kampagnenspalte. Zähler werden immer je
 * Kampagne getrennt ausgewiesen; ein Export ist nur je Kampagne möglich.
 */
export default async function SweepstakesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const filters = parseSweepstakesFilters(params);
  const where = buildSweepstakesWhere(filters);

  const [campaignCounts, stats, totalFiltered, entries] = await Promise.all([
    getCampaignCounts(),
    getSweepstakesStats(filters.campaign),
    prisma.sweepstakesEntry.count({ where }),
    prisma.sweepstakesEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * SWEEPSTAKES_PAGE_SIZE,
      take: SWEEPSTAKES_PAGE_SIZE,
      select: {
        id: true,
        campaignId: true,
        createdAt: true,
        referenceNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        retailer: true,
        retailerOther: true,
        status: true,
        utmSource: true,
        utmCampaign: true,
        landingPath: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / SWEEPSTAKES_PAGE_SIZE));
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value && key !== "page") query.set(key, value);
  }
  const pageHref = (page: number) => {
    const qp = new URLSearchParams(query);
    if (page > 1) qp.set("page", String(page));
    const qs = qp.toString();
    return qs ? `/admin/gewinnspiel?${qs}` : "/admin/gewinnspiel";
  };
  const exportHref = (campaignId: string) => {
    const qp = new URLSearchParams(query);
    qp.set("campaign", campaignId);
    return `/api/export/sweepstakes?${qp.toString()}`;
  };
  const exportTargets = filters.campaign ? [getCampaign(filters.campaign)] : CAMPAIGN_LIST;
  const activeFilterCount = [
    filters.q,
    filters.ref,
    filters.order,
    filters.utm,
    filters.path,
    filters.retailer,
    filters.status,
    filters.from,
    filters.to,
    filters.campaign,
  ].filter(Boolean).length;
  const scopeLabel = filters.campaign
    ? `Kampagne ${getCampaign(filters.campaign).shortLabel} (${filters.campaign})`
    : "alle Kampagnen";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gewinnspiel"
        description="Teilnahmen der Buch-Gewinnspiele – zwei getrennte Kampagnen: Dubai (lizenzzumerfolg.com/gewinn, /verlosung) und Cards (lizenzzumerfolg.com/cards) · nur für Admins"
      >
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          {exportTargets.map((c) => (
            <a key={c.id} href={exportHref(c.id)} className="w-full md:w-auto">
              <Button variant="secondary" size="sm" className="w-full md:w-auto">
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                CSV-Export {c.shortLabel} (gefiltert)
              </Button>
            </a>
          ))}
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="campaign-counts">
        {campaignCounts.map((row) => (
          <StatCard
            key={row.campaignId}
            label={`${campaignLabel(row.campaignId)} · Teilnahmen (heute ${formatNumber(row.today)})`}
            value={formatNumber(row.total)}
          />
        ))}
        {campaignCounts.map((row) => (
          <StatCard
            key={`${row.campaignId}-winners`}
            label={`${campaignLabel(row.campaignId)} · Gewinner markiert`}
            value={formatNumber(row.winners)}
          />
        ))}
      </div>

      <Card>
        <FilterPanel activeCount={activeFilterCount} defaultOpen={activeFilterCount > 0}>
          <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="f-campaign">Kampagne</Label>
              <Select id="f-campaign" name="campaign" defaultValue={filters.campaign ?? ""}>
                <option value="">Alle Kampagnen (Spalte sichtbar)</option>
                {CAMPAIGN_LIST.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortLabel} – {c.id}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="f-q">Name oder E-Mail</Label>
              <Input id="f-q" name="q" defaultValue={filters.q ?? ""} placeholder="Suche …" />
            </div>
            <div>
              <Label htmlFor="f-ref">Teilnahme-Referenz</Label>
              <Input
                id="f-ref"
                name="ref"
                defaultValue={filters.ref ?? ""}
                placeholder="z. B. K7M2X9AB"
              />
            </div>
            <div>
              <Label htmlFor="f-order">Bestellnummer (exakt)</Label>
              <Input id="f-order" name="order" defaultValue={filters.order ?? ""} />
            </div>
            <div>
              <Label htmlFor="f-utm">Quelle / Kampagnenparameter (UTM)</Label>
              <Input id="f-utm" name="utm" defaultValue={filters.utm ?? ""} placeholder="utm…" />
            </div>
            <div>
              <Label htmlFor="f-retailer">Händler</Label>
              <Select id="f-retailer" name="retailer" defaultValue={filters.retailer ?? ""}>
                <option value="">Alle Händler</option>
                {RETAILERS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="f-status">Status</Label>
              <Select id="f-status" name="status" defaultValue={filters.status ?? ""}>
                <option value="">Alle Status</option>
                {Object.entries(SWEEPSTAKES_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="f-path">Teilnahmeweg</Label>
              <Select id="f-path" name="path" defaultValue={filters.path ?? ""}>
                <option value="">Alle Wege</option>
                {ENTRY_PATHS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="none">ohne Angabe (Alt-Teilnahmen)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="f-from">Von (Datum)</Label>
              <Input id="f-from" name="from" type="date" defaultValue={filters.from ?? ""} />
            </div>
            <div>
              <Label htmlFor="f-to">Bis (Datum)</Label>
              <Input id="f-to" name="to" type="date" defaultValue={filters.to ?? ""} />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm">
                Filtern
              </Button>
              <Link href="/admin/gewinnspiel">
                <Button type="button" variant="secondary" size="sm">
                  Zurücksetzen
                </Button>
              </Link>
              <p className="ml-auto text-xs text-zinc-500">
                {formatNumber(totalFiltered)} Treffer · {scopeLabel}
              </p>
            </div>
          </form>
        </FilterPanel>
      </Card>

      <Card>
        <TableWrapper className="hidden md:block">
          <Table minWidth={980}>
            <Thead>
              <tr>
                <Th>Kampagne</Th>
                <Th>Eingegangen</Th>
                <Th>Referenz</Th>
                <Th>Name</Th>
                <Th>E-Mail</Th>
                <Th>Händler</Th>
                <Th>Quelle</Th>
                <Th>Weg</Th>
                <Th>Status</Th>
                <Th>Aktionen</Th>
              </tr>
            </Thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <Td colSpan={10} className="py-10 text-center text-zinc-400">
                    Keine Teilnahmen für die aktuelle Filterung.
                  </Td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-50/60">
                    <Td>
                      <Badge variant={CAMPAIGN_BADGES[entry.campaignId] ?? "muted"}>
                        {campaignLabel(entry.campaignId)}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-zinc-500">
                      {formatBerlinDateTime(entry.createdAt)}
                    </Td>
                    <Td className="font-mono text-xs font-semibold">{entry.referenceNumber}</Td>
                    <Td className="max-w-[160px] truncate">
                      {entry.status === "DELETED"
                        ? "(anonymisiert)"
                        : `${entry.firstName} ${entry.lastName}`}
                    </Td>
                    <Td className="max-w-[160px] truncate text-zinc-500">
                      {entry.email ? maskEmail(entry.email) : "–"}
                    </Td>
                    <Td>{retailerLabel(entry.retailer, entry.retailerOther)}</Td>
                    <Td className="max-w-[120px] truncate text-zinc-500">
                      {entry.utmSource ?? entry.utmCampaign ?? "–"}
                    </Td>
                    <Td className="font-mono text-xs text-zinc-500">{entry.landingPath ?? "–"}</Td>
                    <Td>
                      <Badge variant={STATUS_BADGES[entry.status] ?? "muted"}>
                        {SWEEPSTAKES_STATUS_LABELS[entry.status] ?? entry.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/gewinnspiel/${entry.id}`}
                        title="Details"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">Details</span>
                      </Link>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrapper>

        {/* Mobil: Karten-Liste */}
        <ul className="divide-y divide-zinc-100 md:hidden">
          {entries.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-400">
              Keine Teilnahmen für die aktuelle Filterung.
            </li>
          ) : (
            entries.map((entry) => (
              <li key={entry.id}>
                <Link href={`/admin/gewinnspiel/${entry.id}`} className="block px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {entry.status === "DELETED"
                          ? "(anonymisiert)"
                          : `${entry.firstName} ${entry.lastName}`}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {entry.email ? maskEmail(entry.email) : "–"} ·{" "}
                        {retailerLabel(entry.retailer, entry.retailerOther)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={CAMPAIGN_BADGES[entry.campaignId] ?? "muted"}>
                        {campaignLabel(entry.campaignId)}
                      </Badge>
                      <Badge variant={STATUS_BADGES[entry.status] ?? "muted"}>
                        {SWEEPSTAKES_STATUS_LABELS[entry.status] ?? entry.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    <span className="font-mono font-semibold text-zinc-500">
                      {entry.referenceNumber}
                    </span>{" "}
                    · {formatBerlinDateTime(entry.createdAt)}
                    {(entry.utmSource ?? entry.utmCampaign)
                      ? ` · ${entry.utmSource ?? entry.utmCampaign}`
                      : ""}
                    {entry.landingPath ? ` · ${entry.landingPath}` : ""}
                  </p>
                </Link>
              </li>
            ))
          )}
        </ul>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-zinc-500">
            Seite {filters.page} von {totalPages}
          </p>
          <div className="flex gap-2">
            {filters.page > 1 ? (
              <Link href={pageHref(filters.page - 1)}>
                <Button variant="secondary" size="sm">
                  Zurück
                </Button>
              </Link>
            ) : null}
            {filters.page < totalPages ? (
              <Link href={pageHref(filters.page + 1)}>
                <Button variant="secondary" size="sm">
                  Weiter
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-zinc-500">
        Statistiken unten: {scopeLabel} · {formatNumber(stats.total)} Teilnahmen, heute{" "}
        {formatNumber(stats.today)}
        {stats.bySource[0]
          ? ` · Top-Quelle ${stats.bySource[0].source} (${formatNumber(stats.bySource[0].count)})`
          : ""}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Teilnahmen nach Händler</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byRetailer.length === 0 ? (
              <p className="text-sm text-zinc-400">Noch keine Daten.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {stats.byRetailer.map((row) => (
                  <li key={row.retailer} className="flex justify-between">
                    <span>{retailerLabel(row.retailer)}</span>
                    <span className="font-medium tabular-nums">{formatNumber(row.count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Letzte 14 Tage</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byDay.length === 0 ? (
              <p className="text-sm text-zinc-400">Noch keine Daten.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {stats.byDay.map((row) => (
                  <li key={row.day} className="flex justify-between">
                    <span className="text-zinc-500">{row.day}</span>
                    <span className="font-medium tabular-nums">{formatNumber(row.count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Auffälligkeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-zinc-700">Mehrfache E-Mail-Adressen</p>
              {stats.duplicateEmails.length === 0 ? (
                <p className="mt-1 text-zinc-400">Keine Duplikate.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {stats.duplicateEmails.map((row) => (
                    <li key={row.email} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">{maskEmail(row.email)}</span>
                      <span className="font-medium tabular-nums">{row.count}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="font-medium text-zinc-700">Viele Einsendungen je Client</p>
              {stats.suspiciousIdentifiers.length === 0 ? (
                <p className="mt-1 text-zinc-400">Keine Auffälligkeiten.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {stats.suspiciousIdentifiers.map((row) => (
                    <li key={row.identifier} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate font-mono text-xs">{row.identifier}</span>
                      <span className="font-medium tabular-nums">{row.count}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
