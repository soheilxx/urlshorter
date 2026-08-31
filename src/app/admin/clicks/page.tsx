import { ArrowDown, ArrowUp, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterPanel } from "@/components/admin/filter-panel";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import {
  buildClickOrderBy,
  buildClickWhere,
  CLICK_PAGE_SIZE,
  parseClickFilters,
  type ClickFilters,
} from "@/lib/click-filters";
import { prisma } from "@/lib/db";
import { cn, formatBerlinDate, formatBerlinTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Klicks" };
export const dynamic = "force-dynamic";

function filtersToQuery(filters: ClickFilters, overrides: Partial<ClickFilters> = {}): string {
  const merged = { ...filters, ...overrides };
  const sp = new URLSearchParams();
  if (merged.page > 1) sp.set("page", String(merged.page));
  if (merged.sort !== "ts") sp.set("sort", merged.sort);
  if (merged.dir !== "desc") sp.set("dir", merged.dir);
  if (merged.from) sp.set("from", merged.from);
  if (merged.to) sp.set("to", merged.to);
  if (merged.source) sp.set("source", merged.source);
  if (merged.campaign) sp.set("campaign", merged.campaign);
  if (merged.linkId) sp.set("linkId", merged.linkId);
  if (merged.bot !== "human") sp.set("bot", merged.bot);
  if (merged.device) sp.set("device", merged.device);
  if (merged.q) sp.set("q", merged.q);
  return sp.toString();
}

function SortHeader({
  filters,
  column,
  children,
}: {
  filters: ClickFilters;
  column: ClickFilters["sort"];
  children: React.ReactNode;
}) {
  const active = filters.sort === column;
  const nextDir = active && filters.dir === "desc" ? "asc" : "desc";
  const qs = filtersToQuery(filters, { sort: column, dir: nextDir, page: 1 });
  return (
    <Link
      href={`/admin/clicks?${qs}`}
      className={cn(
        "inline-flex items-center gap-1 hover:text-zinc-900",
        active && "text-zinc-900",
      )}
    >
      {children}
      {active ? (
        filters.dir === "desc" ? (
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
        )
      ) : null}
    </Link>
  );
}

function BoolCell({ value }: { value: boolean }) {
  return value ? (
    <span className="text-emerald-600" title="ja">
      ✓
    </span>
  ) : (
    <span className="text-zinc-300" title="nein">
      –
    </span>
  );
}

function Pagination({ filters, pageCount }: { filters: ClickFilters; pageCount: number }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3">
      <p className="text-xs text-zinc-500">
        Seite {filters.page} von {pageCount}
      </p>
      <div className="flex gap-2">
        {filters.page > 1 ? (
          <Link href={`/admin/clicks?${filtersToQuery(filters, { page: filters.page - 1 })}`}>
            <Button variant="secondary" size="sm">
              Zurück
            </Button>
          </Link>
        ) : null}
        {filters.page < pageCount ? (
          <Link href={`/admin/clicks?${filtersToQuery(filters, { page: filters.page + 1 })}`}>
            <Button variant="secondary" size="sm">
              Weiter
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default async function ClicksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const filters = parseClickFilters(await searchParams);
  const where = buildClickWhere(filters);

  const [rows, total, sources, campaigns, devices, links] = await Promise.all([
    prisma.clickEvent.findMany({
      where,
      orderBy: buildClickOrderBy(filters),
      skip: (filters.page - 1) * CLICK_PAGE_SIZE,
      take: CLICK_PAGE_SIZE,
    }),
    prisma.clickEvent.count({ where }),
    prisma.clickEvent.findMany({
      distinct: ["source"],
      select: { source: true },
      orderBy: { source: "asc" },
      take: 100,
    }),
    prisma.clickEvent.findMany({
      distinct: ["campaign"],
      select: { campaign: true },
      where: { campaign: { not: null } },
      orderBy: { campaign: "asc" },
      take: 100,
    }),
    prisma.clickEvent.findMany({
      distinct: ["deviceType"],
      select: { deviceType: true },
      where: { deviceType: { not: null } },
      take: 20,
    }),
    prisma.shortLink.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / CLICK_PAGE_SIZE));
  const exportQuery = filtersToQuery(filters, { page: 1 });
  const activeFilterCount =
    [
      filters.from,
      filters.to,
      filters.source,
      filters.campaign,
      filters.linkId,
      filters.device,
      filters.q,
    ].filter(Boolean).length + (filters.bot !== "human" ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Klicks"
        description={`${formatNumber(total)} ${total === 1 ? "Eintrag" : "Einträge"} · Zeitzone Europe/Berlin (Speicherung in UTC)`}
      >
        <a
          href={`/api/export/clicks${exportQuery ? `?${exportQuery}` : ""}`}
          className="w-full md:w-auto"
        >
          <Button variant="secondary" size="sm" className="w-full md:w-auto">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            CSV-Export (gefiltert)
          </Button>
        </a>
      </PageHeader>

      <Card>
        <FilterPanel activeCount={activeFilterCount} defaultOpen={activeFilterCount > 0}>
            <form
              method="GET"
              action="/admin/clicks"
              className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            >
              <div>
                <Label htmlFor="f-from">Von (Datum)</Label>
                <Input id="f-from" name="from" type="date" defaultValue={filters.from ?? ""} />
              </div>
              <div>
                <Label htmlFor="f-to">Bis (Datum)</Label>
                <Input id="f-to" name="to" type="date" defaultValue={filters.to ?? ""} />
              </div>
              <div>
                <Label htmlFor="f-source">Source</Label>
                <Select id="f-source" name="source" defaultValue={filters.source ?? ""}>
                  <option value="">Alle Sources</option>
                  {sources.map((s) => (
                    <option key={s.source} value={s.source}>
                      {s.source}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="f-campaign">Kampagne</Label>
                <Select id="f-campaign" name="campaign" defaultValue={filters.campaign ?? ""}>
                  <option value="">Alle Kampagnen</option>
                  {campaigns.map((c) =>
                    c.campaign ? (
                      <option key={c.campaign} value={c.campaign}>
                        {c.campaign}
                      </option>
                    ) : null,
                  )}
                </Select>
              </div>
              <div>
                <Label htmlFor="f-link">Kurzlink</Label>
                <Select id="f-link" name="linkId" defaultValue={filters.linkId ?? ""}>
                  <option value="">Alle Kurzlinks</option>
                  {links.map((l) => (
                    <option key={l.id} value={l.id}>
                      /{l.code} – {l.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="f-bot">Bot-Filter</Label>
                <Select id="f-bot" name="bot" defaultValue={filters.bot}>
                  <option value="human">Nur Menschen (Standard)</option>
                  <option value="bot">Nur Bots</option>
                  <option value="all">Alle</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="f-device">Gerätetyp</Label>
                <Select id="f-device" name="device" defaultValue={filters.device ?? ""}>
                  <option value="">Alle Geräte</option>
                  {devices.map((d) =>
                    d.deviceType ? (
                      <option key={d.deviceType} value={d.deviceType}>
                        {d.deviceType}
                      </option>
                    ) : null,
                  )}
                </Select>
              </div>
              <div>
                <Label htmlFor="f-q">Suche</Label>
                <Input
                  id="f-q"
                  name="q"
                  defaultValue={filters.q ?? ""}
                  placeholder="Code, Name, Referrer …"
                />
              </div>
              <div className="flex items-end gap-2 sm:col-span-3 lg:col-span-4">
                <Button type="submit" size="sm">
                  Filtern
                </Button>
                <Link href="/admin/clicks">
                  <Button type="button" variant="ghost" size="sm">
                    Zurücksetzen
                  </Button>
                </Link>
              </div>
            </form>
        </FilterPanel>
      </Card>

      <Card>
        {/* Desktop: vollständige Tabelle (Zweitrangiges erst ab xl).
            Steht im DOM VOR der Mobil-Liste, damit getByText(...).first()
            in den E2E-Tests das sichtbare Desktop-Element trifft. */}
        <div className="hidden md:block">
          <TableWrapper stickyFirstColumn>
            <Table minWidth={900}>
              <Thead>
                <tr>
                  <Th>
                    <SortHeader filters={filters} column="ts">
                      Datum / Uhrzeit
                    </SortHeader>
                  </Th>
                  <Th>
                    <SortHeader filters={filters} column="code">
                      Code
                    </SortHeader>
                  </Th>
                  <Th>Linkname</Th>
                  <Th>
                    <SortHeader filters={filters} column="source">
                      Source
                    </SortHeader>
                  </Th>
                  <Th className="hidden xl:table-cell">Medium</Th>
                  <Th>
                    <SortHeader filters={filters} column="campaign">
                      Kampagne
                    </SortHeader>
                  </Th>
                  <Th className="hidden xl:table-cell">Content</Th>
                  <Th className="hidden xl:table-cell">Referrer</Th>
                  <Th>Gerät</Th>
                  <Th className="hidden xl:table-cell">Browser</Th>
                  <Th className="hidden xl:table-cell">OS</Th>
                  <Th>
                    <SortHeader filters={filters} column="country">
                      Land
                    </SortHeader>
                  </Th>
                  <Th>Bot</Th>
                  <Th title="Bridge-Page geladen">Bridge</Th>
                  <Th title="Tracking angestoßen">Tracking</Th>
                  <Th title="Redirect gestartet">Redirect</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <Td colSpan={16} className="py-10 text-center text-zinc-400">
                      Keine Klicks für die aktuellen Filter gefunden.
                    </Td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-zinc-50/60">
                      <Td className="whitespace-nowrap tabular-nums">
                        {formatBerlinDate(row.ts)}{" "}
                        <span className="text-zinc-400">{formatBerlinTime(row.ts)}</span>
                      </Td>
                      <Td>
                        <code className="font-mono text-xs font-semibold">/{row.code}</code>
                      </Td>
                      <Td className="max-w-[140px] truncate" title={row.linkName}>
                        {row.linkName}
                      </Td>
                      <Td className="max-w-[120px] truncate" title={row.source}>
                        {row.source}
                      </Td>
                      <Td className="hidden max-w-[90px] truncate xl:table-cell">
                        {row.medium ?? "–"}
                      </Td>
                      <Td className="max-w-[120px] truncate" title={row.campaign ?? ""}>
                        {row.campaign ?? "–"}
                      </Td>
                      <Td className="hidden max-w-[90px] truncate xl:table-cell">
                        {row.content ?? "–"}
                      </Td>
                      <Td
                        className="hidden max-w-[140px] truncate xl:table-cell"
                        title={row.referrer ?? ""}
                      >
                        {row.referrer ?? "–"}
                      </Td>
                      <Td>{row.deviceType ?? "–"}</Td>
                      <Td className="hidden xl:table-cell">{row.browser ?? "–"}</Td>
                      <Td className="hidden xl:table-cell">{row.os ?? "–"}</Td>
                      <Td>{row.country ?? "–"}</Td>
                      <Td>
                        {row.isBot ? (
                          <Badge variant="warning" title={row.botReason ?? ""}>
                            Bot
                          </Badge>
                        ) : (
                          <span className="text-zinc-300">–</span>
                        )}
                      </Td>
                      <Td className="text-center">
                        <BoolCell value={row.bridgeLoaded} />
                      </Td>
                      <Td className="text-center">
                        <BoolCell value={row.trackingFired} />
                      </Td>
                      <Td className="text-center">
                        <BoolCell value={row.redirectStarted || row.manualClick} />
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrapper>
        </div>

        {/* Mobil: Ereignis-Liste */}
        <ul className="divide-y divide-zinc-100 md:hidden">
          {rows.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-400">
              Keine Klicks für die aktuellen Filter gefunden.
            </li>
          ) : (
            rows.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs font-semibold">
                      /{row.code}
                    </code>
                    <span className="min-w-0 truncate text-sm font-medium text-zinc-900">
                      {row.linkName}
                    </span>
                  </span>
                  {row.isBot ? (
                    <Badge variant="warning" title={row.botReason ?? ""}>
                      Bot
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs tabular-nums text-zinc-500">
                  {formatBerlinDate(row.ts)} {formatBerlinTime(row.ts)}
                  {row.country ? ` · ${row.country}` : ""}
                  {row.deviceType ? ` · ${row.deviceType}` : ""}
                  {row.browser ? ` · ${row.browser}` : ""}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-400">
                  {row.source}
                  {row.campaign ? ` · ${row.campaign}` : ""}
                  {row.referrer ? ` · ${row.referrer}` : ""}
                </p>
                <p className="mt-1 flex gap-3 text-[11px] text-zinc-400">
                  <span>
                    Bridge <BoolCell value={row.bridgeLoaded} />
                  </span>
                  <span>
                    Tracking <BoolCell value={row.trackingFired} />
                  </span>
                  <span>
                    Redirect <BoolCell value={row.redirectStarted || row.manualClick} />
                  </span>
                </p>
              </li>
            ))
          )}
        </ul>

        <Pagination filters={filters} pageCount={pageCount} />
      </Card>
    </div>
  );
}
