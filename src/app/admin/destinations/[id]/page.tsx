import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DestinationEditForm } from "@/components/admin/destination-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDestinationHostsHint } from "@/lib/env";
import { formatBerlinDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Ziel bearbeiten" };
export const dynamic = "force-dynamic";

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN", "MARKETER");
  const { id } = await params;

  const destination = await prisma.destination.findUnique({
    where: { id },
    include: {
      shortLinks: {
        select: { id: true, code: true, name: true, source: true, active: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!destination) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">Ziel bearbeiten</h1>
        <p className="text-sm text-zinc-500">
          Erstellt am {formatBerlinDate(destination.createdAt)}, zuletzt geändert am{" "}
          {formatBerlinDate(destination.updatedAt)}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zieldaten</CardTitle>
        </CardHeader>
        <CardContent>
          <DestinationEditForm
            destination={{ id: destination.id, name: destination.name, url: destination.url }}
            linkCount={destination.shortLinks.length}
            hostsHint={getDestinationHostsHint()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Kurzlinks, die dieses Ziel verwenden ({destination.shortLinks.length})
          </CardTitle>
        </CardHeader>
        {destination.shortLinks.length === 0 ? (
          <CardContent className="text-sm text-zinc-400">
            Dieses Ziel wird noch von keinem Kurzlink verwendet.
          </CardContent>
        ) : (
          <TableWrapper>
            <Table>
              <Thead>
                <tr>
                  <Th>Kurzlink</Th>
                  <Th>Name</Th>
                  <Th>Source</Th>
                  <Th>Status</Th>
                </tr>
              </Thead>
              <tbody>
                {destination.shortLinks.map((link) => (
                  <tr key={link.id} className="hover:bg-zinc-50/60">
                    <Td>
                      <Link
                        href={`/admin/links/${link.id}`}
                        className="font-mono text-xs font-semibold text-zinc-800 hover:underline"
                      >
                        /{link.code}
                      </Link>
                    </Td>
                    <Td className="max-w-[220px] truncate" title={link.name}>
                      {link.name}
                    </Td>
                    <Td className="max-w-[160px] truncate" title={link.source}>
                      {link.source}
                    </Td>
                    <Td>
                      {link.active ? (
                        <Badge variant="success">Aktiv</Badge>
                      ) : (
                        <Badge variant="muted">Inaktiv</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </Card>
    </div>
  );
}
