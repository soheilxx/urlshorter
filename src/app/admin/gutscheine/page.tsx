import { Download, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { anonymizeVoucherRedemptionAction } from "@/actions/gutschein-actions";
import { BarList } from "@/components/admin/bar-list";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { GutscheinImportForm } from "@/components/admin/gutschein-import-form";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { retailerLabel } from "@/lib/gewinnspiel-config";
import { getVoucherStats } from "@/lib/gutschein";
import {
  GUTSCHEIN_LOW_STOCK,
  GUTSCHEIN_RABATT_LABEL,
  GUTSCHEIN_SHOP_NAME,
  GUTSCHEIN_URL,
} from "@/lib/gutschein-config";
import { maskEmail } from "@/lib/sweepstakes-validation";
import { formatBerlinDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Gutscheine" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const EXPORT_HREF = "/api/export/gutscheine";

/** Gutscheinaktion (nur ADMIN): Bestand, Ausstellungen, Import, Export. */
export default async function GutscheinePage() {
  await requireRole("ADMIN");

  const [stats, redemptions] = await Promise.all([
    getVoucherStats(),
    prisma.voucherRedemption.findMany({
      include: { voucherCode: { select: { code: true, batch: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
  ]);

  const lowStock = stats.totalCodes > 0 && stats.remaining < GUTSCHEIN_LOW_STOCK;
  const issuedShare = stats.totalCodes > 0 ? (stats.issued / stats.totalCodes) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gutscheine"
        description={`Leser-Aktion: ${GUTSCHEIN_RABATT_LABEL} Gutschein für den ${GUTSCHEIN_SHOP_NAME} je registrierter Buchbestellung · nur für Admins`}
      >
        <a href={GUTSCHEIN_URL} target="_blank" rel="noopener noreferrer" className="w-full md:w-auto">
          <Button variant="secondary" size="sm" className="w-full md:w-auto">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Landingpage öffnen
          </Button>
        </a>
        <a href={EXPORT_HREF} className="w-full md:w-auto">
          <Button variant="secondary" size="sm" className="w-full md:w-auto">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            CSV-Export
          </Button>
        </a>
      </PageHeader>

      {stats.totalCodes === 0 ? (
        <Alert variant="info">
          Noch keine Gutscheincodes importiert – das Formular auf der Landingpage zeigt bis dahin
          „Alle Gutscheine sind vergeben“. Codes unten importieren (CSV oder einfügen).
        </Alert>
      ) : lowStock ? (
        <Alert variant="error">
          Nur noch {formatNumber(stats.remaining)} Gutscheine verfügbar – bitte rechtzeitig neue
          Codes importieren.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Ausgestellt"
          value={formatNumber(stats.issued)}
          hint={`${issuedShare.toFixed(1)} % des Bestands · = Eintragungen`}
        />
        <StatCard
          label="Verfügbar"
          value={formatNumber(stats.remaining)}
          hint={lowStock ? "Bestand fast aufgebraucht" : "noch nicht vergebene Codes"}
        />
        <StatCard label="Heute" value={formatNumber(stats.today)} hint="ausgestellt" />
        <StatCard label="Letzte 7 Tage" value={formatNumber(stats.last7Days)} hint="ausgestellt" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Codes importieren</CardTitle>
          </CardHeader>
          <CardContent>
            <GutscheinImportForm />
            <p className="mt-4 text-xs text-zinc-400">
              Importiert gesamt: {formatNumber(stats.totalCodes)} Codes. Vergabe erfolgt in
              Importreihenfolge, jeder Code genau einmal.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Herkunft (UTM Source)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList data={stats.bySource.map((s) => ({ label: s.source, clicks: s.count }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Händler</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              data={stats.byRetailer.map((r) => ({
                label: retailerLabel(r.retailer),
                clicks: r.count,
              }))}
            />
            {stats.byDay.length > 0 ? (
              <div className="mt-5 border-t border-zinc-100 pt-4">
                <p className="mb-2 text-xs font-medium text-zinc-500">Ausstellungen pro Tag</p>
                <ul className="space-y-1 text-sm">
                  {stats.byDay.slice(0, 7).map((row) => (
                    <li key={row.day} className="flex justify-between">
                      <span className="text-zinc-500">{row.day}</span>
                      <span className="font-medium tabular-nums">{formatNumber(row.count)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ausgestellte Gutscheine (neueste {PAGE_SIZE})</CardTitle>
        </CardHeader>
        <TableWrapper className="hidden md:block">
          <Table minWidth={900}>
            <Thead>
              <tr>
                <Th>Ausgestellt</Th>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>E-Mail</Th>
                <Th>Händler</Th>
                <Th>Quelle</Th>
                <Th>Aktionen</Th>
              </tr>
            </Thead>
            <tbody>
              {redemptions.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="py-10 text-center text-zinc-400">
                    Noch keine Gutscheine ausgestellt.
                  </Td>
                </tr>
              ) : (
                redemptions.map((r) => {
                  const anonymized = r.email === "";
                  return (
                    <tr key={r.id} className="hover:bg-zinc-50/60">
                      <Td className="whitespace-nowrap text-zinc-500">
                        {formatBerlinDateTime(r.createdAt)}
                      </Td>
                      <Td className="font-mono text-xs font-semibold">{r.voucherCode.code}</Td>
                      <Td className="max-w-[180px] truncate">
                        {anonymized ? "(anonymisiert)" : `${r.firstName} ${r.lastName}`}
                      </Td>
                      <Td className="max-w-[180px] truncate text-zinc-500">
                        {anonymized ? "–" : maskEmail(r.email)}
                      </Td>
                      <Td>{retailerLabel(r.retailer, r.retailerOther)}</Td>
                      <Td className="max-w-[140px] truncate text-zinc-500">
                        {r.utmSource ?? r.utmCampaign ?? "–"}
                      </Td>
                      <Td>
                        {anonymized ? (
                          <Badge variant="muted">anonymisiert</Badge>
                        ) : (
                          <form action={anonymizeVoucherRedemptionAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <ConfirmSubmitButton confirmText="Wirklich anonymisieren?">
                              Anonymisieren
                            </ConfirmSubmitButton>
                          </form>
                        )}
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </TableWrapper>

        {/* Mobil: Liste */}
        <ul className="divide-y divide-zinc-100 md:hidden">
          {redemptions.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-400">
              Noch keine Gutscheine ausgestellt.
            </li>
          ) : (
            redemptions.map((r) => {
              const anonymized = r.email === "";
              return (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-zinc-900">
                      {anonymized ? "(anonymisiert)" : `${r.firstName} ${r.lastName}`}
                    </span>
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs font-semibold">
                      {r.voucherCode.code}
                    </code>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {anonymized ? "–" : maskEmail(r.email)} ·{" "}
                    {retailerLabel(r.retailer, r.retailerOther)}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {formatBerlinDateTime(r.createdAt)}
                    {r.utmSource ? ` · ${r.utmSource}` : ""}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </Card>
    </div>
  );
}
