import { Pencil, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { UserCreateForm } from "@/components/admin/user-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { formatBerlinDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Benutzer" };
export const dynamic = "force-dynamic";

const ROLE_BADGE_VARIANTS: Record<Role, "success" | "warning" | "muted"> = {
  ADMIN: "warning",
  MARKETER: "success",
  VIEWER: "muted",
};

export default async function UsersPage() {
  const session = await requireRole("ADMIN");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Benutzer</h1>
        <p className="text-sm text-zinc-500">
          Zugänge zum Dashboard mit Rollen: Admin (alles), Marketer (Links & Ziele verwalten),
          Viewer (nur lesen).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Neuen Benutzer anlegen</CardTitle>
          </CardHeader>
          <CardContent>
            <UserCreateForm />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <TableWrapper>
            <Table>
              <Thead>
                <tr>
                  <Th>E-Mail / Name</Th>
                  <Th>Rolle</Th>
                  <Th>Status</Th>
                  <Th>Letzter Login</Th>
                  <Th>Angelegt</Th>
                  <Th>Aktionen</Th>
                </tr>
              </Thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <Td colSpan={6} className="py-10 text-center text-zinc-400">
                      Noch keine Benutzer angelegt. Aktuell ist nur der Bootstrap-Admin aus den
                      Environment Variables aktiv.
                    </Td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50/60">
                      <Td className="max-w-[220px]">
                        <span className="flex items-center gap-1.5 truncate font-medium">
                          {user.email}
                          {session.userId === user.id ? (
                            <span title="Das bist du">
                              <ShieldCheck
                                className="h-3.5 w-3.5 shrink-0 text-zinc-400"
                                aria-hidden="true"
                              />
                            </span>
                          ) : null}
                        </span>
                        {user.name ? (
                          <span className="block truncate text-xs text-zinc-400">{user.name}</span>
                        ) : null}
                      </Td>
                      <Td>
                        <Badge variant={ROLE_BADGE_VARIANTS[user.role as Role]}>
                          {ROLE_LABELS[user.role as Role]}
                        </Badge>
                      </Td>
                      <Td>
                        {user.active ? (
                          <Badge variant="success">Aktiv</Badge>
                        ) : (
                          <Badge variant="danger">Deaktiviert</Badge>
                        )}
                      </Td>
                      <Td className="text-zinc-500">
                        {user.lastLoginAt ? formatBerlinDate(user.lastLoginAt) : "–"}
                      </Td>
                      <Td className="text-zinc-500">{formatBerlinDate(user.createdAt)}</Td>
                      <Td>
                        <Link
                          href={`/admin/users/${user.id}`}
                          title="Bearbeiten"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="sr-only">Bearbeiten</span>
                        </Link>
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
