import { ArrowDown, ArrowUp, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Klicks</h1>
          <p className="text-sm text-zinc-500">
            {formatNumber(total)} Einträge · Zeitzone Europe/Berlin (Speicherung in UTC)
          </p>
        </div>
        <a href={`/api/export/clicks${exportQuery ? `?${exportQuery}` : ""}`}>
          <Button variant="secondary" size="sm">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            CSV-Export (gefiltert)
          </Button>
        </a>
      </div>

      <Card>
        <CardContent>
          <form
            method="GET"
            action="/admin/clicks"
            className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4"
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
        </CardContent>
      </Card>

      <Card>
        <TableWrapper>
          <Table>
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
                <Th>Medium</Th>
                <Th>
                  <SortHeader filters={filters} column="campaign">
                    Kampagne
                  </SortHeader>
                </Th>
                <Th>Content</Th>
                <Th>Referrer</Th>
                <Th>Gerät</Th>
                <Th>Browser</Th>
                <Th>OS</Th>
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
                    <Td className="max-w-[90px] truncate">{row.medium ?? "–"}</Td>
                    <Td className="max-w-[120px] truncate" title={row.campaign ?? ""}>
                      {row.campaign ?? "–"}
                    </Td>
                    <Td className="max-w-[90px] truncate">{row.content ?? "–"}</Td>
                    <Td className="max-w-[140px] truncate" title={row.referrer ?? ""}>
                      {row.referrer ?? "–"}
                    </Td>
                    <Td>{row.deviceType ?? "–"}</Td>
                    <Td>{row.browser ?? "–"}</Td>
                    <Td>{row.os ?? "–"}</Td>
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

        {pageCount > 1 ? (
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
        ) : null}
      </Card>
    </div>
  );
}
