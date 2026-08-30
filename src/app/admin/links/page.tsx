import { BarChart3, Copy as CopyIcon, ExternalLink, Link2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { toggleShortLinkActiveAction } from "@/actions/link-actions";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { CopyButton } from "@/components/admin/copy-button";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { canManageLinks } from "@/lib/permissions";
import { formatBerlinDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Kurzlinks" };
export const dynamic = "force-dynamic";

export default async function LinksPage() {
  const session = await requireSession();
  const canManage = canManageLinks(session.role);
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

  const statusBadge = (link: (typeof links)[number]) => {
    const expired = link.expiresAt !== null && link.expiresAt.getTime() <= now;
    if (expired) return <Badge variant="warning">Abgelaufen</Badge>;
    if (link.active && link.destination.active) return <Badge variant="success">Aktiv</Badge>;
    return <Badge variant="muted">Inaktiv</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kurzlinks"
        description={`${links.length} Links · Codes sind nach Erstellung unveränderlich`}
      >
        {canManage ? (
          <>
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
          </>
        ) : null}
      </PageHeader>

      {/* Desktop: vollständige Tabelle – steht im DOM VOR der Mobil-Liste,
          damit unscoped getByText/getByRole(...).first() in den E2E-Tests
          das sichtbare Desktop-Element trifft. */}
      <Card className="hidden md:block">
        <TableWrapper stickyFirstColumn>
          <Table minWidth={960}>
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
                    Noch keine Kurzlinks. Lege zuerst unter „Ziele“ eine Ziel-URL an und erstelle
                    dann deinen ersten Link.
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
                        {statusBadge(link)}
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
                          {canManage ? (
                            <>
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
                            </>
                          ) : null}
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

      {/* Mobil: Karten-Liste */}
      <div className="space-y-3 md:hidden">
        {links.length === 0 ? (
          <Card>
            <EmptyState
              icon={Link2}
              title="Noch keine Kurzlinks"
              description="Lege zuerst unter „Ziele“ eine Ziel-URL an und erstelle dann deinen ersten Link."
            >
              {canManage ? (
                <Link href="/admin/links/new">
                  <Button size="sm">
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Neuer Kurzlink
                  </Button>
                </Link>
              ) : null}
            </EmptyState>
          </Card>
        ) : (
          links.map((link) => {
            const fullUrl = `${baseUrl}/${link.code}`;
            return (
              <Card key={link.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm font-semibold">
                        /{link.code}
                      </code>
                      <CopyButton value={fullUrl} label="Link-URL kopieren" />
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-zinc-900">{link.name}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {link.source}
                      {link.campaign ? ` · ${link.campaign}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {statusBadge(link)}
                    <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
                      {formatNumber(countByLink.get(link.id) ?? 0)}
                      <span className="ml-1 text-xs font-normal text-zinc-400">Klicks</span>
                    </p>
                  </div>
                </div>
                <a
                  href={link.destination.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1 text-xs text-zinc-500"
                >
                  <span className="truncate">→ {link.destination.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
                <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
                  <Link href={`/admin/links/${link.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Statistik
                    </Button>
                  </Link>
                  {canManage ? (
                    <>
                      <Link href={`/admin/links/new?from=${link.id}`} className="flex-1">
                        <Button variant="secondary" size="sm" className="w-full">
                          <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          Duplizieren
                        </Button>
                      </Link>
                      <form action={toggleShortLinkActiveAction} className="flex-1">
                        <input type="hidden" name="id" value={link.id} />
                        <input type="hidden" name="active" value={link.active ? "false" : "true"} />
                        {link.active ? (
                          <ConfirmSubmitButton
                            confirmText="Wirklich deaktivieren?"
                            className="w-full"
                          >
                            Deaktivieren
                          </ConfirmSubmitButton>
                        ) : (
                          <Button type="submit" variant="secondary" size="sm" className="w-full">
                            Aktivieren
                          </Button>
                        )}
                      </form>
                    </>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
