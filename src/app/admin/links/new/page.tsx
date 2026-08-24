import type { Metadata } from "next";
import Link from "next/link";
import { LinkForm, type LinkFormValues } from "@/components/admin/link-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Neuer Kurzlink" };
export const dynamic = "force-dynamic";

export default async function NewLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const fromId = typeof params.from === "string" ? params.from : null;

  const destinations = await prisma.destination.findMany({
    where: { active: true },
    select: { id: true, name: true, host: true, active: true },
    orderBy: { name: "asc" },
  });

  let initialValues: LinkFormValues | undefined;
  let duplicatedFrom: string | null = null;
  if (fromId) {
    const original = await prisma.shortLink.findUnique({ where: { id: fromId } });
    if (original) {
      duplicatedFrom = original.code;
      initialValues = {
        destinationId: original.destinationId,
        name: `${original.name} (Kopie)`,
        source: original.source,
        medium: original.medium ?? undefined,
        campaign: original.campaign ?? undefined,
        content: original.content ?? undefined,
        note: original.note ?? undefined,
      };
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          {duplicatedFrom ? `Kurzlink duplizieren (/${duplicatedFrom})` : "Neuer Kurzlink"}
        </h1>
        <p className="text-sm text-zinc-500">
          Der 4-Buchstaben-Code wird automatisch und kryptografisch sicher erzeugt.
        </p>
      </div>

      {destinations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            Es gibt noch kein aktives Ziel.{" "}
            <Link href="/admin/destinations" className="font-medium text-zinc-900 underline">
              Lege zuerst ein Ziel an.
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Linkdaten</CardTitle>
          </CardHeader>
          <CardContent>
            <LinkForm destinations={destinations} initialValues={initialValues} mode="create" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
