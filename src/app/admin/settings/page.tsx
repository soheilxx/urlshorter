import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getRedirectDelayMs } from "@/lib/settings";
import { formatBerlinDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Einstellungen" };
export const dynamic = "force-dynamic";

function ConfigBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <Badge variant="success">konfiguriert</Badge>
  ) : (
    <Badge variant="muted">nicht konfiguriert</Badge>
  );
}

export default async function SettingsPage() {
  await requireAdmin();
  const env = getEnv();

  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const [delayMs, auditEntries] = await Promise.all([
    getRedirectDelayMs(),
    prisma.auditLog.findMany({ orderBy: { ts: "desc" }, take: 30 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-zinc-500">Anwendungskonfiguration und Systemstatus</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weiterleitung</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm currentDelayMs={delayMs} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Systemstatus</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Datenbank</dt>
                <dd>
                  {dbOk ? (
                    <Badge variant="success">verbunden</Badge>
                  ) : (
                    <Badge variant="danger">Fehler</Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Google Tag Manager</dt>
                <dd>
                  <ConfigBadge configured={Boolean(env.GTM_CONTAINER_ID)} />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Google Analytics 4 (nativ)</dt>
                <dd>
                  <ConfigBadge configured={Boolean(env.GA4_MEASUREMENT_ID)} />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Meta Pixel</dt>
                <dd>
                  <ConfigBadge configured={Boolean(env.META_PIXEL_ID)} />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Consent-Modus</dt>
                <dd>
                  <Badge variant={env.TRACKING_CONSENT_MODE === "required" ? "success" : "warning"}>
                    {env.TRACKING_CONSENT_MODE === "required"
                      ? "Einwilligung erforderlich"
                      : "ohne Einwilligung"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Consent-Cookie</dt>
                <dd>
                  <ConfigBadge
                    configured={Boolean(
                      env.CONSENT_COOKIE_NAME && env.CONSENT_COOKIE_ACCEPTED_VALUE,
                    )}
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Cron-Bereinigung (CRON_SECRET)</dt>
                <dd>
                  <ConfigBadge configured={Boolean(env.CRON_SECRET)} />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Datenaufbewahrung (Detail-Events)</dt>
                <dd className="font-medium">{env.EVENT_RETENTION_DAYS} Tage</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Erlaubte Ziel-Hosts</dt>
                <dd className="max-w-[220px] truncate text-right font-mono text-xs">
                  {env.allowedDestinationHosts.join(", ")}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit-Log (letzte 30 Einträge)</CardTitle>
        </CardHeader>
        <TableWrapper>
          <Table>
            <Thead>
              <tr>
                <Th>Zeitpunkt</Th>
                <Th>Akteur</Th>
                <Th>Aktion</Th>
                <Th>Objekt</Th>
              </tr>
            </Thead>
            <tbody>
              {auditEntries.length === 0 ? (
                <tr>
                  <Td colSpan={4} className="py-8 text-center text-zinc-400">
                    Noch keine Einträge.
                  </Td>
                </tr>
              ) : (
                auditEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-50/60">
                    <Td className="whitespace-nowrap tabular-nums">
                      {formatBerlinDateTime(entry.ts)}
                    </Td>
                    <Td className="max-w-[160px] truncate">{entry.actor}</Td>
                    <Td>
                      <code className="font-mono text-xs">{entry.action}</code>
                    </Td>
                    <Td className="text-zinc-500">
                      {entry.entityType}
                      {entry.entityId ? (
                        <span className="text-zinc-400"> · {entry.entityId.slice(0, 12)}</span>
                      ) : null}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrapper>
      </Card>
    </div>
  );
}
