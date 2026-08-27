import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteUserAction } from "@/actions/user-actions";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { UserEditForm, UserResetPasswordForm } from "@/components/admin/user-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { type Role } from "@/lib/permissions";
import { formatBerlinDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Benutzer bearbeiten" };
export const dynamic = "force-dynamic";

export default async function UserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("ADMIN");
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  const isSelf = session.userId === user.id;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Zurück zur Benutzerliste
        </Link>
        <h1 className="text-xl font-bold tracking-tight">{user.email}</h1>
        <p className="text-sm text-zinc-500">
          Angelegt am {formatBerlinDate(user.createdAt)}
          {user.lastLoginAt ? ` · Letzter Login ${formatBerlinDate(user.lastLoginAt)}` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stammdaten & Rolle</CardTitle>
          </CardHeader>
          <CardContent>
            <UserEditForm
              user={{
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role as Role,
                active: user.active,
              }}
              isSelf={isSelf}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Passwort zurücksetzen</CardTitle>
            </CardHeader>
            <CardContent>
              <UserResetPasswordForm userId={user.id} />
            </CardContent>
          </Card>

          {!isSelf ? (
            <Card>
              <CardHeader>
                <CardTitle>Benutzer löschen</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-zinc-500">
                  Entfernt den Zugang dauerhaft. Bereits erfasste Klickdaten und Audit-Einträge
                  bleiben erhalten.
                </p>
                <form action={deleteUserAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <ConfirmSubmitButton confirmText={`Benutzer ${user.email} wirklich löschen?`}>
                    Benutzer löschen
                  </ConfirmSubmitButton>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
