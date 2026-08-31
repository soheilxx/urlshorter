import { ExternalLink, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { toggleDestinationActiveAction } from "@/actions/destination-actions";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { DestinationCreateForm } from "@/components/admin/destination-forms";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDestinationHostsHint } from "@/lib/env";
import { canManageLinks } from "@/lib/permissions";
import { formatBerlinDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Ziele" };
export const dynamic = "force-dynamic";

export default async function DestinationsPage() {
  const session = await requireSession();
  const canManage = canManageLinks(session.role);

  const destinations = await prisma.destination.findMany({
    include: { _count: { select: { shortLinks: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ziele (Destinations)"
        description="Wiederverwendbare Ziel-URLs – beliebig viele Kurzlinks können auf dasselbe Ziel verweisen."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mobil steht die Liste zuerst, das Formular dahinter (order-*) */}
        {canManage ? (
          <Card className="order-2 lg:order-none lg:col-span-1">
            <CardHeader>
              <CardTitle>Neues Ziel anlegen</CardTitle>
            </CardHeader>
            <CardContent>
              <DestinationCreateForm hostsHint={getDestinationHostsHint()} />
            </CardContent>
          </Card>
        ) : null}

        <Card className={canManage ? "order-1 lg:order-none lg:col-span-2" : "lg:col-span-3"}>
          <TableWrapper className="hidden md:block">
            <Table>
              <Thead>
                <tr>
                  <Th>Bezeichnung</Th>
                  <Th>Ziel-URL</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Links</Th>
                  <Th>Geändert</Th>
                  <Th>Aktionen</Th>
                </tr>
              </Thead>
              <tbody>
                {destinations.length === 0 ? (
                  <tr>
                    <Td colSpan={6} className="py-10 text-center text-zinc-400">
                      Noch keine Ziele angelegt.
                    </Td>
                  </tr>
                ) : (
                  destinations.map((dest) => (
                    <tr key={dest.id} className="hover:bg-zinc-50/60">
                      <Td className="max-w-[160px] truncate font-medium" title={dest.name}>
                        {dest.name}
                      </Td>
                      <Td className="max-w-[240px]">
                        <a
                          href={dest.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={dest.url}
                          className="inline-flex max-w-full items-center gap-1 font-mono text-xs text-zinc-600 hover:text-zinc-900 hover:underline"
                        >
                          <span className="truncate">{dest.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </a>
                      </Td>
                      <Td>
                        {dest.active ? (
                          <Badge variant="success">Aktiv</Badge>
                        ) : (
                          <Badge variant="muted">Inaktiv</Badge>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{dest._count.shortLinks}</Td>
                      <Td className="text-zinc-500">{formatBerlinDate(dest.updatedAt)}</Td>
                      <Td>
                        {canManage ? (
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/admin/destinations/${dest.id}`}
                              title="Bearbeiten"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">Bearbeiten</span>
                            </Link>
                            <form action={toggleDestinationActiveAction}>
                              <input type="hidden" name="id" value={dest.id} />
                              <input
                                type="hidden"
                                name="active"
                                value={dest.active ? "false" : "true"}
                              />
                              {dest.active ? (
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

          {/* Mobil: Karten-Liste */}
          <ul className="divide-y divide-zinc-100 md:hidden">
            {destinations.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-zinc-400">
                Noch keine Ziele angelegt.
              </li>
            ) : (
              destinations.map((dest) => (
                <li key={dest.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-zinc-900">
                      {dest.name}
                    </p>
                    {dest.active ? (
                      <Badge variant="success">Aktiv</Badge>
                    ) : (
                      <Badge variant="muted">Inaktiv</Badge>
                    )}
                  </div>
                  <a
                    href={dest.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all font-mono text-xs text-zinc-500"
                  >
                    {dest.url}
                  </a>
                  <p className="mt-1 text-xs text-zinc-400">
                    {dest._count.shortLinks} Links · geändert {formatBerlinDate(dest.updatedAt)}
                  </p>
                  {canManage ? (
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <Link href={`/admin/destinations/${dest.id}`} className="min-w-0">
                        <Button variant="secondary" size="sm" className="w-full">
                          <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">Bearbeiten</span>
                        </Button>
                      </Link>
                      <form action={toggleDestinationActiveAction} className="min-w-0">
                        <input type="hidden" name="id" value={dest.id} />
                        <input type="hidden" name="active" value={dest.active ? "false" : "true"} />
                        {dest.active ? (
                          <ConfirmSubmitButton confirmText="Sicher?" className="w-full">
                            <span className="truncate">Deaktivieren</span>
                          </ConfirmSubmitButton>
                        ) : (
                          <Button type="submit" variant="secondary" size="sm" className="w-full">
                            Aktivieren
                          </Button>
                        )}
                      </form>
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
