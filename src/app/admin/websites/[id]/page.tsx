import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteTagSiteButton } from "@/components/admin/tag-site-delete";
import { TagSiteForm } from "@/components/admin/tag-site-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { maskSecret } from "@/lib/secrets";
import { TAG_SITES } from "@/lib/tag-config";

export const metadata: Metadata = { title: "Website bearbeiten" };
export const dynamic = "force-dynamic";

/**
 * TRACK.SITE-Website bearbeiten (nur Admin). Code-Bootstrap-Sites lassen sich
 * ebenfalls öffnen – beim Speichern entsteht eine Dashboard-Konfiguration,
 * die den Code-Eintrag überschreibt.
 */
export default async function EditWebsitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;
  if (!/^[a-z0-9-]{1,50}$/.test(id)) notFound();

  const env = getEnv();
  const db = await prisma.tagSiteConfig.findUnique({ where: { id } });
  const code = TAG_SITES.find((s) => s.id === id);
  if (!db && !code) notFound();

  const values = db
    ? {
        id: db.id,
        label: db.label,
        domains: db.domains,
        active: db.active,
        ga4MeasurementId: db.ga4MeasurementId ?? "",
        gtmContainerId: db.gtmContainerId ?? "",
        metaPixelId: db.metaPixelId ?? "",
        tiktokPixelId: db.tiktokPixelId ?? "",
        redditPixelId: db.redditPixelId ?? "",
        linkedinPartnerId: db.linkedinPartnerId ?? "",
      }
    : {
        id: code!.id,
        label: code!.label,
        domains: code!.domains.join(", "),
        active: true,
        ga4MeasurementId: "",
        gtmContainerId: "",
        metaPixelId: "",
        tiktokPixelId: "",
        redditPixelId: "",
        linkedinPartnerId: "",
      };

  const snippet = `<script async src="${env.PUBLIC_BASE_URL}/t.js?site=${id}" data-site="${id}"></script>`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/websites" className="text-sm text-zinc-500 hover:underline">
          ← Zurück zu Websites
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-bold tracking-tight">{values.label}</h1>
          {db ? (
            <Badge variant="success">Dashboard-Konfiguration</Badge>
          ) : (
            <Badge variant="muted">Code-Standard – Speichern übernimmt ins Dashboard</Badge>
          )}
        </div>
        <p className="text-sm text-zinc-500">
          Leere Pixel-Felder fallen auf den globalen Standard zurück. Token-Felder leer lassen,
          um gespeicherte Tokens zu behalten.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Einbau-Snippet</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="block overflow-x-auto rounded bg-zinc-100 px-3 py-2 font-mono text-xs">
            {snippet}
          </code>
          <p className="mt-2 text-xs text-zinc-400">
            In den <code className="font-mono">&lt;head&gt;</code>-Bereich jeder Seite einbauen –
            Unterseiten und SPA-Navigationen werden automatisch erfasst.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Website-Konfiguration</CardTitle>
        </CardHeader>
        <CardContent>
          <TagSiteForm
            mode="edit"
            values={values}
            tokenHints={{
              meta: maskSecret(db?.metaCapiTokenEncrypted),
              tiktok: maskSecret(db?.tiktokTokenEncrypted),
            }}
          />
        </CardContent>
      </Card>

      {db ? (
        <Card>
          <CardHeader>
            <CardTitle>Gefahrenzone</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">
              Entfernt die Dashboard-Konfiguration dieser Website. Gespeicherte Events bleiben
              erhalten.
            </p>
            <DeleteTagSiteButton id={db.id} label={db.label} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
