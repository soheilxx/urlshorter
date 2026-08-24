import { BarChart3, Copy as CopyIcon, ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { toggleShortLinkActiveAction } from "@/actions/link-actions";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { CopyButton } from "@/components/admin/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { formatBerlinDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Kurzlinks" };
export const dynamic = "force-dynamic";

export default async function LinksPage() {
  await requireAdmin();
  const baseUrl = getEnv().PUBLIC_BASE_URL;

  const [links, humanCounts] = await Promise.all([
    prisma.shortLink.findMany({
      include: { destination: { select: { name: true, url: true, host: true, active: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clickEvent.groupBy({
      by: ["shortLinkId"],
      where: { isBot: false },
      _count: { _all: true },
    }),
  ]);
  const countByLink = new Map(humanCounts.map((c) => [c.shortLinkId, c._count._all]));
  const now = Date.now();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Kurzlinks</h1>
          <p className="text-sm text-zinc-500">
            {links.length} Links · Codes sind nach Erstellung unveränderlich
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/links/bulk">
            <Button variant="secondary" size="sm">
              Mehrere Links erstellen
            </Button>
          </Link>
          <Link href="/admin/links/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Neuer Kurzlink
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <TableWrapper>
          <Table>
            <Thead>
              <tr>
                <Th>Kurzlink</Th>
                <Th>Name</Th>
                <Th>Source</Th>
                <Th>Kampagne</Th>
                <Th>Ziel</Th>
                <Th>Status</Th>
                <Th className="text-right">Klicks</Th>
                <Th>Erstellt</Th>
                <Th>Aktionen</Th>
              </tr>
            </Thead>
            <tbody>
              {links.length === 0 ? (
                <tr>
                  <Td colSpan={9} className="py-10 text-center text-zinc-400">
                    Noch keine Kurzlinks. Lege zuerst unter „Ziele“ eine Amazon-Destination an und
                    erstelle dann deinen ersten Link.
                  </Td>
                </tr>
              ) : (
                links.map((link) => {
                  const expired = link.expiresAt !== null && link.expiresAt.getTime() <= now;
                  const fullUrl = `${baseUrl}/${link.code}`;
                  return (
                    <tr key={link.id} className="hover:bg-zinc-50/60">
                      <Td>
                        <span className="inline-flex items-center gap-1">
                          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs font-semibold">
                            /{link.code}
                          </code>
                          <CopyButton value={fullUrl} label={`Kurzlink ${fullUrl} kopieren`} />
                        </span>
                      </Td>
                      <Td className="max-w-[180px] truncate" title={link.name}>
                        {link.name}
                      </Td>
                      <Td className="max-w-[140px] truncate" title={link.source}>
                        {link.source}
                      </Td>
                      <Td className="max-w-[140px] truncate" title={link.campaign ?? ""}>
                        {link.campaign ?? "–"}
                      </Td>
                      <Td className="max-w-[200px]">
                        <a
                          href={link.destination.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={link.destination.url}
                          className="inline-flex max-w-full items-center gap-1 text-zinc-600 hover:text-zinc-900 hover:underline"
                        >
                          <span className="truncate">{link.destination.name}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </a>
                      </Td>
                      <Td>
                        {expired ? (
                          <Badge variant="warning">Abgelaufen</Badge>
                        ) : link.active && link.destination.active ? (
                          <Badge variant="success">Aktiv</Badge>
                        ) : (
                          <Badge variant="muted">Inaktiv</Badge>
                        )}
                        {link.expiresAt && !expired ? (
                          <span className="mt-0.5 block text-xs text-zinc-400">
                            bis {formatBerlinDate(link.expiresAt)}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="text-right font-medium tabular-nums">
                        {formatNumber(countByLink.get(link.id) ?? 0)}
                      </Td>
                      <Td className="text-zinc-500">{formatBerlinDate(link.createdAt)}</Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/admin/links/${link.id}`}
                            title="Statistik & Bearbeiten"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                          >
                            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only">Statistik und Bearbeiten</span>
                          </Link>
                          <Link
                            href={`/admin/links/new?from=${link.id}`}
                            title="Duplizieren"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                          >
                            <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only">Duplizieren</span>
                          </Link>
                          <form action={toggleShortLinkActiveAction}>
                            <input type="hidden" name="id" value={link.id} />
                            <input
                              type="hidden"
                              name="active"
                              value={link.active ? "false" : "true"}
                            />
                            {link.active ? (
                              <ConfirmSubmitButton confirmText="Wirklich deaktivieren?">
                                Deaktivieren
                              </ConfirmSubmitButton>
                            ) : (
                              <Button type="submit" variant="secondary" size="sm">
                                Aktivieren
                              </Button>
                            )}
                          </form>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </TableWrapper>
      </Card>
    </div>
  );
}
