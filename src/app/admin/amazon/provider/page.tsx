import type { Metadata } from "next";
import Link from "next/link";
import { getAmazonSettings } from "@/lib/amazon/amazon-settings";
import {
  CREATORS_CAPABILITIES,
  PROVIDER_LABELS,
  RAINFOREST_CAPABILITIES,
} from "@/lib/amazon/constants";
import { creatorsAwaitingEligibility } from "@/lib/amazon/provider-display";
import { forecastQuota } from "@/lib/amazon/quota";
import { isCreatorsConfigured } from "@/lib/amazon/providers/creators";
import { isRainforestConfigured } from "@/lib/amazon/providers/rainforest";
import { TestProvidersForm } from "@/components/admin/amazon/amazon-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBerlinDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Amazon Provider" };
export const dynamic = "force-dynamic";

/** Providerstatus: Health, Circuit Breaker, Capabilities, Credits, Laufhistorie. */
export default async function AmazonProvidersPage() {
  const session = await requireRole("ADMIN", "MARKETER", "VIEWER");
  const isAdmin = session.role === "ADMIN";
  const settings = await getAmazonSettings();

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [statuses, recentRuns, runStats, fallbackCount, activeCategories, creatorsWaiting] = await Promise.all([
    prisma.amazonProviderStatus.findMany(),
    prisma.amazonProviderRun.findMany({ orderBy: { startedAt: "desc" }, take: 25 }),
    prisma.amazonProviderRun.groupBy({
      by: ["provider", "status"],
      _count: { _all: true },
      where: { startedAt: { gte: since24h } },
    }),
    prisma.amazonProviderRun.count({
      where: { startedAt: { gte: since24h }, fallbackFrom: { not: null } },
    }),
    prisma.amazonCategory.count({ where: { active: true, leaderboardEnabled: true } }),
    creatorsAwaitingEligibility(),
  ]);

  const providers = [
    {
      key: "CREATORS" as const,
      configured: isCreatorsConfigured(),
      capabilities: CREATORS_CAPABILITIES,
      oauth: true,
    },
    {
      key: "RAINFOREST" as const,
      configured: isRainforestConfigured(),
      capabilities: RAINFOREST_CAPABILITIES,
      oauth: false,
    },
  ];

  const errorRate = (provider: string): string => {
    const rows = runStats.filter((r) => r.provider === provider);
    const total = rows.reduce((s, r) => s + r._count._all, 0);
    if (total === 0) return "–";
    const failed = rows
      .filter((r) => r.status === "FAILED")
      .reduce((s, r) => s + r._count._all, 0);
    return `${Math.round((failed / total) * 100)} % (${failed}/${total})`;
  };

  const rainforestStatus = statuses.find((s) => s.provider === "RAINFOREST");
  const quota = rainforestStatus?.quota as {
    plan?: string;
    creditsUsed?: number;
    creditsLimit?: number;
    creditsRemaining?: number;
    creditsResetAt?: string;
    platformStatus?: Array<{ component: string; status: string }>;
  } | null;
  const forecast = forecastQuota({
    rankIntervalMinutes: settings.rankIntervalMinutes,
    leaderboardIntervalMinutes: settings.leaderboardIntervalMinutes,
    activeLeaderboardCategories: activeCategories,
    metadataIntervalMinutes: settings.metadataIntervalMinutes,
    accountStatusIntervalMinutes: settings.accountStatusIntervalMinutes,
    salesEstimationEnabled: settings.salesEstimationEnabled,
    creditsRemaining: quota?.creditsRemaining ?? null,
    creditsLimit: quota?.creditsLimit ?? null,
    creditsResetAt: quota?.creditsResetAt ? new Date(quota.creditsResetAt) : null,
    now: new Date(),
    dailyCreditBudget: settings.dailyCreditBudget,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/amazon" className="text-sm text-zinc-500 hover:underline">
          ← Amazon Rankings
        </Link>
        <h1 className="mt-1 font-display text-xl font-bold tracking-tight">Provider</h1>
        <p className="text-sm text-zinc-500">
          Amazon Creators API und Rainforest API – Status, Capabilities, Credits. Zugangsdaten
          liegen ausschließlich serverseitig in Environment-Variablen und werden nie angezeigt.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {providers.map((provider) => {
          const status = statuses.find((s) => s.provider === provider.key);
          return (
            <Card key={provider.key}>
              <CardHeader>
                <CardTitle>{PROVIDER_LABELS[provider.key]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  {provider.configured ? (
                    <Badge variant="success">konfiguriert</Badge>
                  ) : (
                    <Badge variant="muted">nicht konfiguriert</Badge>
                  )}
                  {status?.healthy ? (
                    <Badge variant="success">Verbindung ok</Badge>
                  ) : status && provider.key === "CREATORS" && creatorsWaiting ? (
                    <Badge variant="warning">wartet auf Amazon-Freischaltung</Badge>
                  ) : status ? (
                    <Badge variant="warning">gestört</Badge>
                  ) : (
                    <Badge variant="muted">noch kein Health-Check</Badge>
                  )}
                  {status?.circuitBreakerState === "open" ? (
                    <Badge variant="danger">Circuit Breaker OFFEN</Badge>
                  ) : status?.circuitBreakerState === "half_open" ? (
                    <Badge variant="warning">Circuit half-open</Badge>
                  ) : null}
                  {provider.oauth ? (
                    <Badge variant={status?.healthy ? "success" : "muted"}>
                      OAuth {status?.healthy ? "ok" : "ungeprüft"}
                    </Badge>
                  ) : null}
                </div>
                {provider.key === "CREATORS" && creatorsWaiting ? (
                  <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                    Zugangsdaten und OAuth funktionieren. Amazon schaltet den Katalogzugriff
                    der Creators API erst frei, wenn das Associates-Konto die
                    Teilnahmevoraussetzungen erfüllt (u. a. ~10 qualifizierte Verkäufe in
                    30 Tagen). Bis dahin liefert Rainforest die kanonischen Werte – die
                    Umstellung erfolgt automatisch.
                  </p>
                ) : null}
                <dl className="space-y-0.5 text-xs sm:grid sm:grid-cols-2 sm:gap-x-4 sm:gap-y-1.5 sm:space-y-0">
                  <dt className="text-zinc-400">Letzte erfolgreiche Abfrage</dt>
                  <dd>{status?.lastSuccessAt ? formatBerlinDateTime(status.lastSuccessAt) : "–"}</dd>
                  <dt className="text-zinc-400">Letzte fehlgeschlagene Abfrage</dt>
                  <dd>{status?.lastFailureAt ? formatBerlinDateTime(status.lastFailureAt) : "–"}</dd>
                  <dt className="text-zinc-400">Fehler in Folge</dt>
                  <dd>{status?.consecutiveFailures ?? 0}</dd>
                  <dt className="text-zinc-400">Latenz (letzter Erfolg)</dt>
                  <dd>{status?.currentLatencyMs ? `${status.currentLatencyMs} ms` : "–"}</dd>
                  <dt className="text-zinc-400">Fehlerrate (24 h)</dt>
                  <dd>{errorRate(provider.key)}</dd>
                </dl>
                <div>
                  <p className="mb-1 text-xs font-medium text-zinc-500">Capabilities</p>
                  <div className="flex flex-wrap gap-1">
                    {provider.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rainforest Credits + Prognose */}
      <Card>
        <CardHeader>
          <CardTitle>Rainforest-Credits & Prognose</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm lg:grid-cols-2">
          <div className="space-y-1.5">
            {quota ? (
              <>
                <p>
                  Plan: <span className="font-medium">{quota.plan ?? "unbekannt"}</span>
                </p>
                <p>
                  Credits: {formatNumber(quota.creditsUsed ?? 0)} verwendet ·{" "}
                  <span className="font-semibold">{formatNumber(quota.creditsRemaining ?? 0)}</span>{" "}
                  von {formatNumber(quota.creditsLimit ?? 0)} verbleibend
                </p>
                <p className="text-xs text-zinc-500">
                  Reset:{" "}
                  {quota.creditsResetAt
                    ? formatBerlinDateTime(new Date(quota.creditsResetAt))
                    : "unbekannt"}
                </p>
                {quota.platformStatus ? (
                  <p className="text-xs text-zinc-500">
                    Plattformstatus:{" "}
                    {quota.platformStatus.map((s) => `${s.component}: ${s.status}`).join(" · ")}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-zinc-400">
                Noch kein Account-Abruf – Job „refresh-rainforest-account-status“ ausführen.
              </p>
            )}
          </div>
          <div className="space-y-1.5 text-xs text-zinc-600">
            <p className="text-sm font-medium text-zinc-800">
              Prognose aus aktuellen Einstellungen
            </p>
            <p>
              Produktabrufe: ~{formatNumber(forecast.productRunsPerDay)}/Tag · Leaderboards ({activeCategories}{" "}
              Kategorien): ~{formatNumber(forecast.leaderboardRunsPerDay)}/Tag
            </p>
            <p>
              Gesamt: ~{formatNumber(forecast.totalRequestsPerDay)} Requests/Tag ≈{" "}
              {formatNumber(forecast.totalRequestsPerMonth)}/Monat
            </p>
            <p>
              Voraussichtliche Erschöpfung:{" "}
              {forecast.exhaustionDate
                ? formatBerlinDateTime(forecast.exhaustionDate)
                : "nicht absehbar"}
            </p>
            {forecast.warnLevel !== "ok" ? (
              <Badge variant={forecast.warnLevel === "critical" ? "danger" : "warning"}>
                {forecast.warnLevel === "critical"
                  ? "Kritisch: unter 10 % Credits"
                  : forecast.warnLevel === "warning"
                    ? "Warnung: unter 20 % Credits"
                    : forecast.warnLevel === "hint"
                      ? "Hinweis: unter 30 % Credits"
                      : "Prognose überschreitet Restbudget"}
              </Badge>
            ) : null}
            {forecast.exceedsDailyBudget ? (
              <Badge variant="warning">Tagesbudget würde überschritten</Badge>
            ) : null}
            <p className="text-zinc-400">
              Fallback-Läufe (24 h): {formatNumber(fallbackCount)} · Account API ist kostenlos.
            </p>
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Verbindungstest</CardTitle>
          </CardHeader>
          <CardContent>
            <TestProvidersForm />
            <p className="mt-2 text-xs text-zinc-400">
              Serverseitiger Test beider Provider (Creators: OAuth-Token; Rainforest: kostenlose
              Account API). Es werden nur Status, Latenz und eine sichere Meldung angezeigt – nie
              Zugangsdaten.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Laufhistorie */}
      <Card>
        <CardHeader>
          <CardTitle>Letzte Provider-Läufe</CardTitle>
        </CardHeader>
        <TableWrapper>
          <Table minWidth={760}>
            <Thead>
              <tr>
                <Th>Start</Th>
                <Th>Job</Th>
                <Th>Provider</Th>
                <Th>Status</Th>
                <Th className="text-right">Requests</Th>
                <Th className="text-right">Credits</Th>
                <Th className="text-right">Latenz</Th>
                <Th>Fehler</Th>
              </tr>
            </Thead>
            <tbody>
              {recentRuns.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="py-8 text-center text-zinc-400">
                    Noch keine Läufe.
                  </Td>
                </tr>
              ) : (
                recentRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-zinc-50/60">
                    <Td className="whitespace-nowrap text-xs text-zinc-500">
                      {formatBerlinDateTime(run.startedAt)}
                    </Td>
                    <Td className="font-mono text-xs">{run.jobType}</Td>
                    <Td className="text-xs">{run.provider ? PROVIDER_LABELS[run.provider] : "–"}</Td>
                    <Td>
                      <Badge
                        variant={
                          run.status === "SUCCESS"
                            ? "success"
                            : run.status === "PARTIAL"
                              ? "warning"
                              : run.status === "FAILED"
                                ? "danger"
                                : "muted"
                        }
                      >
                        {run.status}
                      </Badge>
                    </Td>
                    <Td className="text-right tabular-nums text-xs">{run.requestCount}</Td>
                    <Td className="text-right tabular-nums text-xs">
                      {run.creditsUsed !== null ? run.creditsUsed : "–"}
                    </Td>
                    <Td className="text-right tabular-nums text-xs">
                      {run.latencyMs !== null ? `${run.latencyMs} ms` : "–"}
                    </Td>
                    <Td className="max-w-[240px] truncate text-xs text-zinc-500">
                      {run.safeErrorMessage ?? "–"}
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
