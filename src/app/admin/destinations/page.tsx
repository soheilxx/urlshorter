import { ExternalLink, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { toggleDestinationActiveAction } from "@/actions/destination-actions";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { DestinationCreateForm } from "@/components/admin/destination-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDestinationHostsHint } from "@/lib/env";
import { formatBerlinDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Ziele" };
export const dynamic = "force-dynamic";

export default async function DestinationsPage() {
  await requireAdmin();

  const destinations = await prisma.destination.findMany({
    include: { _count: { select: { shortLinks: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Ziele (Destinations)</h1>
        <p className="text-sm text-zinc-500">
          Wiederverwendbare Ziel-URLs – beliebig viele Kurzlinks können auf dasselbe Ziel verweisen.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Neues Ziel anlegen</CardTitle>
          </CardHeader>
          <CardContent>
            <DestinationCreateForm hostsHint={getDestinationHostsHint()} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <TableWrapper>
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
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrapper>
        </Card>
      </div>
    </div>
  );
}
