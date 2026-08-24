import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminSession } from "@/lib/auth";
import { getAuthEnv, getPublicHostname } from "@/lib/env";

export const metadata: Metadata = { title: "Anmelden" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin");

  const authEnv = getAuthEnv();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-lg font-bold tracking-tight text-zinc-900">
          {getPublicHostname()}
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Admin-Anmeldung</CardTitle>
          </CardHeader>
          <CardContent>
            {authEnv.ok ? (
              <LoginForm />
            ) : (
              <Alert variant="error">
                <p className="mb-1 font-semibold">Setup unvollständig</p>
                <p>
                  Der Admin-Zugang ist nicht konfiguriert. Bitte folgende Environment Variables
                  setzen und neu deployen:
                </p>
                <ul className="mt-2 list-inside list-disc font-mono text-xs">
                  {authEnv.missing.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  Hinweis: Den Passwort-Hash erzeugst du lokal mit{" "}
                  <code className="font-mono">npm run hash-password</code>.
                </p>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
