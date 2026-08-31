import { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/admin/copy-button";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { listTagSites } from "@/lib/tag-sites";
import { formatBerlinDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Websites" };
export const dynamic = "force-dynamic";

/**
 * TRACK.SITE-Verwaltung: angebundene Websites mit Pixel-IDs + CAPI-Tokens
 * (im Dashboard gepflegt, Tokens verschlüsselt), Event-Zahlen und
 * Einbau-Snippets. Bearbeiten nur als Admin, Ansicht auch als Marketer.
 */
export default async function WebsitesPage() {
  const session = await requireRole("ADMIN", "MARKETER");
  const isAdmin = session.role === "ADMIN";
  const env = getEnv();

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [sites, total, today, bySite, byDay, topEvents, recent, capi] = await Promise.all([
    listTagSites(),
    prisma.tagEvent.count(),
    prisma.tagEvent.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.tagEvent.groupBy({
      by: ["siteId"],
      _count: { _all: true },
      where: { createdAt: { gte: since7d } },
    }),
    prisma.$queryRaw<Array<{ day: string; count: number }>>(Prisma.sql`
      SELECT to_char((te."createdAt" AT TIME ZONE 'Europe/Berlin')::date, 'YYYY-MM-DD') AS day,
             count(*)::int AS count
      FROM "TagEvent" te
      WHERE te."createdAt" >= now() - interval '14 days'
      GROUP BY 1 ORDER BY 1 DESC
    `),
    prisma.tagEvent.groupBy({
      by: ["eventName"],
      _count: { _all: true },
      where: { createdAt: { gte: since7d } },
      orderBy: { _count: { eventName: "desc" } },
      take: 8,
    }),
    prisma.tagEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        createdAt: true,
        siteId: true,
        eventName: true,
        path: true,
        country: true,
        utmSource: true,
        metaForwardedAt: true,
        tiktokForwardedAt: true,
      },
    }),
    prisma.tagEvent.count({ where: { metaForwardedAt: { not: null }, createdAt: { gte: since7d } } }),
  ]);

  const countBySite = new Map(bySite.map((g) => [g.siteId, g._count._all]));

  const pixelSummary = (site: (typeof sites)[number]) =>
    [
      site.pixels.ga4 ? "GA4" : null,
      site.pixels.gtm ? "GTM" : null,
      site.pixels.meta ? (site.capi.metaToken ? "Meta+CAPI" : "Meta") : null,
      site.pixels.tiktok ? (site.capi.tiktokToken ? "TikTok+API" : "TikTok") : null,
      site.pixels.reddit ? "Reddit" : null,
      site.pixels.linkedin ? "LinkedIn" : null,
    ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Websites"
        description="TRACK.SITE: ein Snippet pro Website, alle Pixel + Conversion-APIs laufen über dieses System. Pixel-IDs und API-Tokens werden hier im Dashboard gepflegt."
      >
        {isAdmin ? (
          <Link href="/admin/websites/neu" className="w-full md:w-auto">
            <Button size="sm" className="w-full md:w-auto">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Neue Website
            </Button>
          </Link>
        ) : null}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Events gesamt" value={formatNumber(total)} />
        <StatCard label="Heute" value={formatNumber(today)} />
        <StatCard
          label="Letzte 7 Tage"
          value={formatNumber(bySite.reduce((s, g) => s + g._count._all, 0))}
        />
        <StatCard label="Meta CAPI (7 Tage)" value={formatNumber(capi)} hint="weitergeleitet" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Angebundene Websites</CardTitle>
        </CardHeader>
        <TableWrapper className="hidden md:block">
          <Table minWidth={900}>
            <Thead>
              <tr>
                <Th>Website</Th>
                <Th>Site-ID</Th>
                <Th>Domains</Th>
                <Th>Pixel</Th>
                <Th>Status</Th>
                <Th className="text-right">Events (7 Tage)</Th>
                <Th>Einbau-Snippet</Th>
                {isAdmin ? <Th /> : null}
              </tr>
            </Thead>
            <tbody>
              {sites.map((site) => {
                const snippet = `<script async src="${env.PUBLIC_BASE_URL}/t.js?site=${site.id}" data-site="${site.id}"></script>`;
                return (
                  <tr key={site.id} className="hover:bg-zinc-50/60">
                    <Td className="font-medium">{site.label}</Td>
                    <Td className="font-mono text-xs">{site.id}</Td>
                    <Td className="max-w-[220px] truncate text-zinc-500">
                      {site.domains.join(", ")}
                    </Td>
                    <Td>
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {pixelSummary(site).map((p) => (
                          <span
                            key={p}
                            className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      {site.active ? (
                        <Badge variant="success">aktiv</Badge>
                      ) : (
                        <Badge variant="muted">deaktiviert</Badge>
                      )}
                    </Td>
                    <Td className="text-right font-medium tabular-nums">
                      {formatNumber(countBySite.get(site.id) ?? 0)}
                    </Td>
                    <Td>
                      <span className="inline-flex max-w-full items-center gap-1">
                        <code className="block max-w-[280px] truncate rounded bg-zinc-100 px-2 py-1 font-mono text-[11px]">
                          {snippet}
                        </code>
                        <CopyButton value={snippet} label={`Snippet für ${site.id} kopieren`} />
                      </span>
                    </Td>
                    {isAdmin ? (
                      <Td>
                        <Link
                          href={`/admin/websites/${site.id}`}
                          className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline"
                        >
                          Bearbeiten
                        </Link>
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrapper>

        {/* Mobil: Karten-Liste */}
        <ul className="divide-y divide-zinc-100 md:hidden">
          {sites.map((site) => {
            const snippet = `<script async src="${env.PUBLIC_BASE_URL}/t.js?site=${site.id}" data-site="${site.id}"></script>`;
            return (
              <li key={site.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">{site.label}</p>
                    <p className="truncate font-mono text-xs text-zinc-400">
                      {site.id} · {site.domains.join(", ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {site.active ? (
                      <Badge variant="success">aktiv</Badge>
                    ) : (
                      <Badge variant="muted">deaktiviert</Badge>
                    )}
                    <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
                      {formatNumber(countBySite.get(site.id) ?? 0)}
                      <span className="ml-1 text-xs font-normal text-zinc-400">/ 7 Tage</span>
                    </p>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {pixelSummary(site).map((p) => (
                    <span
                      key={p}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                    >
                      {p}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <code className="min-w-0 flex-1 truncate rounded bg-zinc-100 px-2 py-1.5 font-mono text-[11px]">
                    {snippet}
                  </code>
                  <CopyButton value={snippet} label="Snippet kopieren" />
                </div>
                {isAdmin ? (
                  <div className="mt-2.5">
                    <Link href={`/admin/websites/${site.id}`}>
                      <Button variant="secondary" size="sm" className="w-full">
                        Bearbeiten
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Events pro Tag (14 Tage)</CardTitle>
          </CardHeader>
          <CardContent>
            {byDay.length === 0 ? (
              <p className="text-sm text-zinc-400">Noch keine Events.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {byDay.map((row) => (
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
            <CardTitle>Top-Events (7 Tage)</CardTitle>
          </CardHeader>
          <CardContent>
            {topEvents.length === 0 ? (
              <p className="text-sm text-zinc-400">Noch keine Events.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {topEvents.map((row) => (
                  <li key={row.eventName} className="flex justify-between gap-3">
                    <span className="truncate font-mono text-xs">{row.eventName}</span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(row._count._all)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Letzte Events</CardTitle>
        </CardHeader>
        <TableWrapper className="hidden md:block">
          <Table minWidth={760}>
            <Thead>
              <tr>
                <Th>Zeitpunkt</Th>
                <Th>Website</Th>
                <Th>Event</Th>
                <Th>Pfad</Th>
                <Th>Land</Th>
                <Th>Quelle</Th>
                <Th>CAPI</Th>
              </tr>
            </Thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="py-10 text-center text-zinc-400">
                    Noch keine Events – Snippet auf einer Website einbauen und aufrufen.
                  </Td>
                </tr>
              ) : (
                recent.map((event) => (
                  <tr key={event.id} className="hover:bg-zinc-50/60">
                    <Td className="whitespace-nowrap text-zinc-500">
                      {formatBerlinDateTime(event.createdAt)}
                    </Td>
                    <Td>{event.siteId}</Td>
                    <Td className="font-mono text-xs">{event.eventName}</Td>
                    <Td className="max-w-[200px] truncate text-zinc-500">{event.path}</Td>
                    <Td>{event.country ?? "–"}</Td>
                    <Td className="max-w-[120px] truncate text-zinc-500">
                      {event.utmSource ?? "–"}
                    </Td>
                    <Td>
                      {event.metaForwardedAt || event.tiktokForwardedAt ? (
                        <Badge variant="success">
                          {[
                            event.metaForwardedAt ? "Meta" : null,
                            event.tiktokForwardedAt ? "TikTok" : null,
                          ]
                            .filter(Boolean)
                            .join(" + ")}
                        </Badge>
                      ) : (
                        <span className="text-xs text-zinc-400">–</span>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrapper>

        {/* Mobil: Ereignis-Liste */}
        <ul className="divide-y divide-zinc-100 md:hidden">
          {recent.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-400">
              Noch keine Events – Snippet auf einer Website einbauen und aufrufen.
            </li>
          ) : (
            recent.map((event) => (
              <li key={event.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-mono text-sm font-medium text-zinc-800">
                    {event.eventName}
                  </span>
                  {event.metaForwardedAt || event.tiktokForwardedAt ? (
                    <Badge variant="success">
                      {[
                        event.metaForwardedAt ? "Meta" : null,
                        event.tiktokForwardedAt ? "TikTok" : null,
                      ]
                        .filter(Boolean)
                        .join(" + ")}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {event.siteId}
                  {event.path ? ` · ${event.path}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {formatBerlinDateTime(event.createdAt)}
                  {event.country ? ` · ${event.country}` : ""}
                  {event.utmSource ? ` · ${event.utmSource}` : ""}
                </p>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
