import { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { TAG_SITES } from "@/lib/tag-config";
import { formatBerlinDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Websites" };
export const dynamic = "force-dynamic";

/**
 * Übersicht des zentralen Tracking-Snippets (t.js): angebundene Websites,
 * Event-Zahlen, CAPI-Weiterleitungen und das Einbau-Snippet zum Kopieren.
 */
export default async function WebsitesPage() {
  await requireRole("ADMIN", "MARKETER");
  const env = getEnv();

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, today, bySite, byDay, topEvents, recent, capi] = await Promise.all([
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Websites</h1>
        <p className="text-sm text-zinc-500">
          Zentrales Tracking-Snippet (t.js): ein Einbau, alle Pixel + Conversion-APIs laufen über
          dieses System. Sites werden in <code className="font-mono">src/lib/tag-config.ts</code>{" "}
          gepflegt.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Events gesamt" value={formatNumber(total)} />
        <StatCard label="Heute" value={formatNumber(today)} />
        <StatCard label="Letzte 7 Tage" value={formatNumber(bySite.reduce((s, g) => s + g._count._all, 0))} />
        <StatCard
          label="Meta CAPI (7 Tage)"
          value={formatNumber(capi)}
          hint={env.META_CAPI_ACCESS_TOKEN ? "weitergeleitet" : "kein Token konfiguriert"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Angebundene Websites</CardTitle>
        </CardHeader>
        <TableWrapper>
          <Table>
            <Thead>
              <tr>
                <Th>Website</Th>
                <Th>Site-ID</Th>
                <Th>Domains</Th>
                <Th className="text-right">Events (7 Tage)</Th>
                <Th>Einbau-Snippet</Th>
              </tr>
            </Thead>
            <tbody>
              {TAG_SITES.map((site) => (
                <tr key={site.id} className="hover:bg-zinc-50/60">
                  <Td className="font-medium">{site.label}</Td>
                  <Td className="font-mono text-xs">{site.id}</Td>
                  <Td className="text-zinc-500">{site.domains.join(", ")}</Td>
                  <Td className="text-right font-medium tabular-nums">
                    {formatNumber(countBySite.get(site.id) ?? 0)}
                  </Td>
                  <Td>
                    <code className="block max-w-[360px] truncate rounded bg-zinc-100 px-2 py-1 font-mono text-[11px]">
                      {`<script async src="${env.PUBLIC_BASE_URL}/t.js" data-site="${site.id}"></script>`}
                    </code>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
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
        <Card>
          <CardHeader>
            <CardTitle>Pixel-Konfiguration</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[
                ["GA4", env.GA4_MEASUREMENT_ID],
                ["GTM", env.GTM_CONTAINER_ID],
                ["Meta Pixel", env.META_PIXEL_ID],
                ["Meta CAPI", env.META_CAPI_ACCESS_TOKEN ? "Token gesetzt" : null],
                ["TikTok Pixel", env.TIKTOK_PIXEL_ID],
                ["TikTok Events API", env.TIKTOK_EVENTS_API_TOKEN ? "Token gesetzt" : null],
                ["Reddit", env.REDDIT_PIXEL_ID],
                ["LinkedIn", env.LINKEDIN_PARTNER_ID],
              ].map(([label, value]) => (
                <li key={label as string} className="flex items-center justify-between gap-3">
                  <span>{label}</span>
                  {value ? (
                    <Badge variant="success">aktiv</Badge>
                  ) : (
                    <Badge variant="muted">nicht konfiguriert</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Letzte Events</CardTitle>
        </CardHeader>
        <TableWrapper>
          <Table>
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
      </Card>
    </div>
  );
}
