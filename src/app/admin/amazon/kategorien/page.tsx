import type { Metadata } from "next";
import Link from "next/link";
import { verifyCategoryMappingAction } from "@/actions/amazon-actions";
import { CategoryEditForm, ManualJobForm } from "@/components/admin/amazon/amazon-forms";
import { CategorySearchForm } from "@/components/admin/amazon/category-search-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBerlinDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Amazon Kategorien" };
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  WEBSITE: "Gesamtrang",
  BROWSE_NODE: "Browse Node",
  BESTSELLERS: "Bestsellerliste",
};

/** Kategorienverwaltung: Auflösung, Mappings, Aktivierung, Intervalle. */
export default async function AmazonCategoriesPage() {
  const session = await requireRole("ADMIN", "MARKETER", "VIEWER");
  const isAdmin = session.role === "ADMIN";

  const categories = await prisma.amazonCategory.findMany({
    orderBy: [{ required: "desc" }, { categoryType: "asc" }, { canonicalName: "asc" }],
    include: { providerMappings: { orderBy: [{ provider: "asc" }, { verified: "desc" }] } },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/amazon" className="text-sm text-zinc-500 hover:underline">
          ← Amazon Rankings
        </Link>
        <h1 className="mt-1 text-xl font-bold tracking-tight">Kategorien</h1>
        <p className="text-sm text-zinc-500">
          Browse Nodes (Kategorienränge) und Rainforest-Bestsellerkategorien (Top 25) werden hier
          verbunden. Die Sachbuch-Kategorie-ID wird dynamisch über die Rainforest Categories API
          ermittelt – keine unbestätigten IDs.
        </p>
      </div>

      {isAdmin ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Kategorien automatisch auflösen</CardTitle>
            </CardHeader>
            <CardContent>
              <ManualJobForm
                jobs={[
                  { type: "resolve-amazon-categories", label: "Rainforest-Kategorien auflösen (Sachbücher etc.)" },
                  { type: "refresh-category-leaderboards", label: "Top-25-Listen jetzt abrufen" },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Kategorien-Suche (Rainforest)</CardTitle>
            </CardHeader>
            <CardContent>
              <CategorySearchForm />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="space-y-4">
        {categories.map((category) => {
          const creatorsMappings = category.providerMappings.filter((m) => m.provider === "CREATORS");
          const rainforestMappings = category.providerMappings.filter(
            (m) => m.provider === "RAINFOREST",
          );
          return (
            <Card key={category.id}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-zinc-900">{category.canonicalName}</p>
                  <Badge variant="muted">{TYPE_LABELS[category.categoryType] ?? category.categoryType}</Badge>
                  {category.required ? <Badge variant="warning">Pflicht</Badge> : null}
                  {category.active ? (
                    <Badge variant="success">aktiv</Badge>
                  ) : (
                    <Badge variant="muted">inaktiv</Badge>
                  )}
                  {category.resolutionStatus === "resolved" ? (
                    <Badge variant="success">aufgelöst</Badge>
                  ) : category.resolutionStatus === "ambiguous" ? (
                    <Badge variant="warning">mehrdeutig – Auswahl nötig</Badge>
                  ) : category.resolutionStatus === "no_leaderboard" ? (
                    <Badge variant="warning">keine eigene Amazon-Bestsellerliste</Badge>
                  ) : category.resolutionStatus === "failed" ? (
                    <Badge variant="danger">Auflösung fehlgeschlagen</Badge>
                  ) : (
                    <Badge variant="muted">nicht aufgelöst</Badge>
                  )}
                  <span className="ml-auto font-mono text-[11px] text-zinc-400">{category.id}</span>
                </div>
                {category.path ? (
                  <p className="text-xs text-zinc-500">Pfad: {category.path}</p>
                ) : null}
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <p className="mb-1 font-medium text-zinc-500">
                      Amazon Browse Node{creatorsMappings.length !== 1 ? "s" : ""}
                    </p>
                    {creatorsMappings.length === 0 ? (
                      <p className="text-zinc-400">
                        Noch keiner – wird beim ersten Creators-Abruf automatisch erkannt.
                      </p>
                    ) : (
                      creatorsMappings.map((mapping) => (
                        <p key={mapping.id} className="font-mono text-zinc-600">
                          {mapping.providerCategoryId}
                          {mapping.providerCategoryPath ? (
                            <span className="ml-1 font-sans text-zinc-400">
                              ({mapping.providerCategoryPath})
                            </span>
                          ) : null}
                        </p>
                      ))
                    )}
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-zinc-500">Rainforest-Bestsellerkategorie</p>
                    {rainforestMappings.length === 0 ? (
                      <p className="text-zinc-400">Noch nicht aufgelöst.</p>
                    ) : (
                      <ul className="space-y-1">
                        {rainforestMappings.map((mapping) => (
                          <li key={mapping.id} className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-zinc-600">
                              {mapping.providerCategoryId}
                            </span>
                            {mapping.providerCategoryPath ? (
                              <span className="text-zinc-400">{mapping.providerCategoryPath}</span>
                            ) : null}
                            {mapping.verified ? (
                              <Badge variant="success">verifiziert</Badge>
                            ) : isAdmin ? (
                              <form action={verifyCategoryMappingAction}>
                                <input type="hidden" name="mappingId" value={mapping.id} />
                                <button
                                  type="submit"
                                  className="rounded border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100"
                                >
                                  Als korrekt bestätigen
                                </button>
                              </form>
                            ) : (
                              <Badge variant="muted">unbestätigt</Badge>
                            )}
                            {mapping.providerCategoryUrl ? (
                              <a
                                href={mapping.providerCategoryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-zinc-400 underline-offset-2 hover:underline"
                              >
                                Bestseller-URL ↗
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <p className="text-xs text-zinc-400">
                  Letzte Auflösung:{" "}
                  {category.lastResolvedAt ? formatBerlinDateTime(category.lastResolvedAt) : "nie"}
                  {category.refreshIntervalOverride
                    ? ` · individuelles Intervall: ${category.refreshIntervalOverride} min`
                    : ""}
                </p>
                {isAdmin ? (
                  <div className="border-t border-zinc-100 pt-3">
                    <CategoryEditForm
                      category={{
                        id: category.id,
                        canonicalName: category.canonicalName,
                        active: category.active,
                        required: category.required,
                        leaderboardEnabled: category.leaderboardEnabled,
                        autoFollow: category.autoFollow,
                        refreshIntervalOverride: category.refreshIntervalOverride,
                      }}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {categories.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-zinc-400">
              Noch keine Kategorien – die Ersteinrichtung (Übersicht) legt die Pflichtkategorien
              an.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
