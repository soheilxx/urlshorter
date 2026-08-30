import type { Metadata } from "next";
import Link from "next/link";
import { BulkLinkForm } from "@/components/admin/bulk-link-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Mehrere Kurzlinks erstellen" };
export const dynamic = "force-dynamic";

export default async function BulkLinksPage() {
  await requireRole("ADMIN", "MARKETER");

  const destinations = await prisma.destination.findMany({
    where: { active: true },
    select: { id: true, name: true, host: true, active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">Mehrere Kurzlinks erstellen</h1>
        <p className="text-sm text-zinc-500">
          Erstellt in einem Vorgang je einen Kurzlink pro Source – alle mit demselben Ziel.
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
            <CardTitle>Sammel-Erstellung</CardTitle>
          </CardHeader>
          <CardContent>
            <BulkLinkForm destinations={destinations} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
