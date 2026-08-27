import type { Metadata } from "next";
import { ChangeOwnPasswordForm } from "@/components/admin/user-forms";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Mein Konto" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireSession();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Mein Konto</h1>
        <p className="text-sm text-zinc-500">
          {session.email} · Rolle: {ROLE_LABELS[session.role]}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Passwort ändern</CardTitle>
        </CardHeader>
        <CardContent>
          {session.userId ? (
            <ChangeOwnPasswordForm />
          ) : (
            <Alert variant="error">
              Du bist als Bootstrap-Admin über die Environment Variables angemeldet. Dieses
              Passwort wird über <code className="font-mono">ADMIN_PASSWORD_HASH_BASE64</code>{" "}
              verwaltet. Empfehlung: Unter „Benutzer“ ein persönliches Admin-Konto anlegen und
              künftig damit arbeiten.
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
