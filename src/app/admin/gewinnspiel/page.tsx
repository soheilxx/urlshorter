import { Download, Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  RETAILERS,
  retailerLabel,
  SWEEPSTAKES_STATUS_LABELS,
} from "@/lib/gewinnspiel-config";
import {
  buildSweepstakesWhere,
  getSweepstakesStats,
  parseSweepstakesFilters,
  SWEEPSTAKES_PAGE_SIZE,
} from "@/lib/sweepstakes-admin";
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

export default async function SweepstakesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const filters = parseSweepstakesFilters(params);
  const where = buildSweepstakesWhere(filters);

  const [stats, totalFiltered, entries] = await Promise.all([
    getSweepstakesStats(),
    prisma.sweepstakesEntry.count({ where }),
    prisma.sweepstakesEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * SWEEPSTAKES_PAGE_SIZE,
      take: SWEEPSTAKES_PAGE_SIZE,
      select: {
        id: true,
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
  const exportHref = `/api/export/sweepstakes${query.toString() ? `?${query.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Gewinnspiel</h1>
          <p className="text-sm text-zinc-500">
            Teilnahmen der Dubai-Verlosung (lizenzzumerfolg.com/gewinn) · nur für Admins
          </p>
        </div>
        <a href={exportHref}>
          <Button variant="secondary" size="sm">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            CSV-Export (gefiltert)
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Teilnahmen gesamt" value={formatNumber(stats.total)} />
        <StatCard label="Heute" value={formatNumber(stats.today)} />
        <StatCard
          label="Top-Händler"
          value={
            stats.byRetailer[0]
              ? `${retailerLabel(stats.byRetailer[0].retailer)} (${formatNumber(stats.byRetailer[0].count)})`
              : "–"
          }
        />
        <StatCard
          label="Top-Quelle"
          value={
            stats.bySource[0]
              ? `${stats.bySource[0].source} (${formatNumber(stats.bySource[0].count)})`
              : "–"
          }
        />
      </div>

      <Card>
        <CardContent className="pt-5">
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="f-q">Name oder E-Mail</Label>
              <Input id="f-q" name="q" defaultValue={filters.q ?? ""} placeholder="Suche …" />
            </div>
            <div>
              <Label htmlFor="f-ref">Teilnahme-Referenz</Label>
              <Input id="f-ref" name="ref" defaultValue={filters.ref ?? ""} placeholder="GEWINN-…" />
            </div>
            <div>
              <Label htmlFor="f-order">Bestellnummer (exakt)</Label>
              <Input id="f-order" name="order" defaultValue={filters.order ?? ""} />
            </div>
            <div>
              <Label htmlFor="f-utm">Quelle / Kampagne</Label>
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
                {formatNumber(totalFiltered)} Treffer
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <TableWrapper>
          <Table>
            <Thead>
              <tr>
                <Th>Eingegangen</Th>
                <Th>Referenz</Th>
                <Th>Name</Th>
                <Th>E-Mail</Th>
                <Th>Händler</Th>
                <Th>Quelle</Th>
                <Th>Status</Th>
                <Th>Aktionen</Th>
              </tr>
            </Thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="py-10 text-center text-zinc-400">
                    Keine Teilnahmen für die aktuelle Filterung.
                  </Td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-50/60">
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

      <div className="grid gap-6 lg:grid-cols-3">
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
                      <span className="truncate">{maskEmail(row.email)}</span>
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
                      <span className="truncate font-mono text-xs">{row.identifier}</span>
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
