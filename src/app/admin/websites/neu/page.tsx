import type { Metadata } from "next";
import Link from "next/link";
import { TagSiteForm } from "@/components/admin/tag-site-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Neue Website" };
export const dynamic = "force-dynamic";

/** Neue TRACK.SITE-Website anlegen (nur Admin). */
export default async function NewWebsitePage() {
  await requireRole("ADMIN");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/websites" className="text-sm text-zinc-500 hover:underline">
          ← Zurück zu Websites
        </Link>
        <h1 className="mt-1 text-xl font-bold tracking-tight">Neue Website</h1>
        <p className="text-sm text-zinc-500">
          Nach dem Anlegen erscheint das Einbau-Snippet in der Übersicht. Pixel-IDs und Tokens
          können jederzeit ergänzt werden – das Snippet beim Kunden bleibt unverändert.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Website-Konfiguration</CardTitle>
        </CardHeader>
        <CardContent>
          <TagSiteForm
            mode="create"
            values={{
              id: "",
              label: "",
              domains: "",
              active: true,
              ga4MeasurementId: "",
              gtmContainerId: "",
              metaPixelId: "",
              tiktokPixelId: "",
              redditPixelId: "",
              linkedinPartnerId: "",
            }}
            tokenHints={{ meta: null, tiktok: null }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
