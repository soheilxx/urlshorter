import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark, BrandWordmark } from "@/components/admin/brand";
import { LoginForm } from "@/components/admin/login-form";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginConfigState, getSession } from "@/lib/auth";
import { getPublicHostname } from "@/lib/env";

export const metadata: Metadata = { title: "Anmelden" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/admin");

  const configState = await getLoginConfigState();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2.5">
          <BrandMark className="h-11 w-11 rounded-2xl [&>svg]:h-5 [&>svg]:w-5" />
          <h1 className="text-center text-xl leading-tight">
            <BrandWordmark />
            <span className="mt-0.5 block text-xs font-normal text-zinc-400">
              {getPublicHostname()}
            </span>
          </h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Anmeldung</CardTitle>
          </CardHeader>
          <CardContent>
            {configState.ok ? (
              <LoginForm />
            ) : (
              <Alert variant="error">
                <p className="mb-1 font-semibold">Setup unvollständig</p>
                <p>
                  Es ist noch kein Zugang konfiguriert. Bitte folgende Environment Variables setzen
                  und neu deployen (danach können Benutzer im Dashboard angelegt werden):
                </p>
                <ul className="mt-2 list-inside list-disc font-mono text-xs">
                  {configState.missing.map((name) => (
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
