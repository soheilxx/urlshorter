import type { Metadata } from "next";
import Link from "next/link";
import { deleteAlertRuleAction, toggleAlertRuleAction } from "@/actions/amazon-actions";
import { getAmazonSettings } from "@/lib/amazon/amazon-settings";
import { AMAZON_JOB_TYPES } from "@/lib/amazon/constants";
import {
  ActualSalesForm,
  AlertRuleForm,
  AmazonSettingsForm,
  AnnotationForm,
  BaselineImportForm,
  ManualJobForm,
} from "@/components/admin/amazon/amazon-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Thead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBerlinDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Amazon Einstellungen" };
export const dynamic = "force-dynamic";

const JOB_LABELS: Record<string, string> = {
  "refresh-primary-book-ranks": "Buch- & Kategorienränge",
  "refresh-category-leaderboards": "Top-25-Listen",
  "refresh-product-metadata": "Produktmetadaten",
  "resolve-amazon-categories": "Kategorien auflösen",
  "refresh-provider-health": "Provider-Health",
  "refresh-rainforest-account-status": "Rainforest-Credits",
  "send-daily-ranking-digest": "Tägliche Zusammenfassung",
  "cleanup-provider-payloads": "Payload-Bereinigung",
};

/** Amazon-Modul-Einstellungen (nur ADMIN). */
export default async function AmazonSettingsPage() {
  await requireRole("ADMIN");
  const settings = await getAmazonSettings();

  const [jobStates, alertRules, digests, edition, categories] = await Promise.all([
    prisma.amazonJobState.findMany(),
    prisma.amazonAlertRule.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.amazonDigestRun.findMany({ orderBy: { calendarDate: "desc" }, take: 10 }),
    prisma.amazonEdition.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }),
    prisma.amazonCategory.findMany({
      where: { active: true },
      orderBy: { canonicalName: "asc" },
      select: { id: true, canonicalName: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/amazon" className="text-sm text-zinc-500 hover:underline">
          ← Amazon Rankings
        </Link>
        <h1 className="mt-1 font-display text-xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-zinc-500">
          Intervalle, Provider-Prioritäten, Digest und Alerts – ohne Deployment änderbar.
          Zeitzone für Anzeige und Berichte: {settings.timezone} (Speicherung in UTC).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modul & Intervalle</CardTitle>
        </CardHeader>
        <CardContent>
          <AmazonSettingsForm
            values={{
              enabled: settings.enabled,
              rankIntervalMinutes: settings.rankIntervalMinutes,
              leaderboardIntervalMinutes: settings.leaderboardIntervalMinutes,
              metadataIntervalMinutes: settings.metadataIntervalMinutes,
              staleAfterMinutes: settings.staleAfterMinutes,
              providerPriority: settings.providerPriority,
              fallbackEnabled: settings.fallbackEnabled,
              digestEnabled: settings.digestEnabled,
              digestTime: settings.digestTime,
              digestRecipient: settings.digestRecipient,
              dailyCreditBudget: settings.dailyCreditBudget,
              salesEstimationEnabled: settings.salesEstimationEnabled,
              autoFollowCategories: settings.autoFollowCategories,
            }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Manueller Refresh</CardTitle>
          </CardHeader>
          <CardContent>
            <ManualJobForm
              jobs={AMAZON_JOB_TYPES.map((type) => ({
                type,
                label: JOB_LABELS[type] ?? type,
              }))}
            />
            <p className="mt-2 text-xs text-zinc-400">
              Rate-Limit: 2 Minuten je Job · paralleler Doppelstart wird über den Job-Lock
              verhindert · Rainforest-Jobs verbrauchen Credits.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduler-Status</CardTitle>
          </CardHeader>
          <TableWrapper className="hidden md:block">
            <Table>
              <Thead>
                <tr>
                  <Th>Job</Th>
                  <Th>Nächster Lauf</Th>
                  <Th>Letzter Status</Th>
                </tr>
              </Thead>
              <tbody>
                {AMAZON_JOB_TYPES.map((type) => {
                  const state = jobStates.find((s) => s.jobType === type);
                  return (
                    <tr key={type} className="hover:bg-zinc-50/60">
                      <Td className="text-xs">{JOB_LABELS[type] ?? type}</Td>
                      <Td className="text-xs text-zinc-500">
                        {state?.nextRunAt ? formatBerlinDateTime(state.nextRunAt) : "beim nächsten Tick"}
                      </Td>
                      <Td>
                        {state?.lastStatus ? (
                          <Badge
                            variant={
                              state.lastStatus === "SUCCESS"
                                ? "success"
                                : state.lastStatus === "PARTIAL"
                                  ? "warning"
                                  : state.lastStatus === "FAILED"
                                    ? "danger"
                                    : "muted"
                            }
                          >
                            {state.lastStatus}
                          </Badge>
                        ) : (
                          <span className="text-xs text-zinc-400">nie gelaufen</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrapper>

          {/* Mobil: Job-Liste */}
          <ul className="divide-y divide-zinc-100 md:hidden">
            {AMAZON_JOB_TYPES.map((type) => {
              const state = jobStates.find((s) => s.jobType === type);
              return (
                <li key={type} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-800">{JOB_LABELS[type] ?? type}</p>
                    <p className="text-xs text-zinc-400">
                      {state?.nextRunAt
                        ? formatBerlinDateTime(state.nextRunAt)
                        : "beim nächsten Tick"}
                    </p>
                  </div>
                  {state?.lastStatus ? (
                    <Badge
                      variant={
                        state.lastStatus === "SUCCESS"
                          ? "success"
                          : state.lastStatus === "PARTIAL"
                            ? "warning"
                            : state.lastStatus === "FAILED"
                              ? "danger"
                              : "muted"
                      }
                    >
                      {state.lastStatus}
                    </Badge>
                  ) : (
                    <span className="shrink-0 text-xs text-zinc-400">nie gelaufen</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Alert-Regeln</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {alertRules.length > 0 ? (
            <ul className="space-y-2">
              {alertRules.map((rule) => (
                <li
                  key={rule.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-100 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{rule.name}</span>
                  <span className="font-mono text-xs text-zinc-500">
                    {rule.metric} {rule.operator} {rule.threshold !== null ? Number(rule.threshold) : "?"}
                  </span>
                  <span className="text-xs text-zinc-400">
                    Cooldown {rule.cooldownMinutes} min · {rule.channels}
                  </span>
                  {rule.enabled ? (
                    <Badge variant="success">aktiv</Badge>
                  ) : (
                    <Badge variant="muted">pausiert</Badge>
                  )}
                  {rule.lastTriggeredAt ? (
                    <span className="text-xs text-zinc-400">
                      zuletzt: {formatBerlinDateTime(rule.lastTriggeredAt)}
                    </span>
                  ) : null}
                  <span className="ml-auto flex gap-1.5">
                    <form action={toggleAlertRuleAction}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <button
                        type="submit"
                        className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
                      >
                        {rule.enabled ? "Pausieren" : "Aktivieren"}
                      </button>
                    </form>
                    <form action={deleteAlertRuleAction}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <button
                        type="submit"
                        className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        Löschen
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-400">
              Keine eigenen Regeln – Systemalerts (Bestwert, Schwellen, Provider, Credits) laufen
              automatisch.
            </p>
          )}
          <div className="border-t border-zinc-100 pt-4">
            <AlertRuleForm categories={categories.map((c) => ({ id: c.id, name: c.canonicalName }))} />
          </div>
        </CardContent>
      </Card>

      {edition ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Manuelle Baseline importieren</CardTitle>
            </CardHeader>
            <CardContent>
              <BaselineImportForm editionId={edition.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Kampagnen-Annotation</CardTitle>
            </CardHeader>
            <CardContent>
              <AnnotationForm />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Tatsächliche Verkaufszahlen importieren</CardTitle>
            </CardHeader>
            <CardContent>
              <ActualSalesForm editionId={edition.id} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Digest-Historie */}
      <Card>
        <CardHeader>
          <CardTitle>Digest-Historie</CardTitle>
        </CardHeader>
        <TableWrapper className="hidden md:block">
          <Table minWidth={560}>
            <Thead>
              <tr>
                <Th>Kalendertag</Th>
                <Th>Empfänger</Th>
                <Th>Status</Th>
                <Th>Versendet</Th>
                <Th className="text-right">Datenvollständigkeit</Th>
              </tr>
            </Thead>
            <tbody>
              {digests.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-8 text-center text-zinc-400">
                    Noch kein Digest gelaufen (Standard: erster Lauf ab {settings.digestTime} Uhr).
                  </Td>
                </tr>
              ) : (
                digests.map((digest) => (
                  <tr key={digest.id} className="hover:bg-zinc-50/60">
                    <Td>{digest.calendarDate.toISOString().slice(0, 10)}</Td>
                    <Td className="text-xs">{digest.recipient}</Td>
                    <Td>
                      <Badge variant={digest.status === "sent" ? "success" : digest.status === "failed" ? "danger" : "muted"}>
                        {digest.status}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-zinc-500">
                      {digest.sentAt ? formatBerlinDateTime(digest.sentAt) : "–"}
                    </Td>
                    <Td className="text-right text-xs tabular-nums">
                      {digest.dataCompleteness !== null
                        ? `${Math.round(digest.dataCompleteness * 100)} %`
                        : "–"}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrapper>

        {/* Mobil: Digest-Liste */}
        <ul className="divide-y divide-zinc-100 md:hidden">
          {digests.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-400">
              Noch kein Digest gelaufen (Standard: erster Lauf ab {settings.digestTime} Uhr).
            </li>
          ) : (
            digests.map((digest) => (
              <li key={digest.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm tabular-nums text-zinc-800">
                    {digest.calendarDate.toISOString().slice(0, 10)}
                  </p>
                  <p className="truncate text-xs text-zinc-400">
                    {digest.recipient}
                    {digest.sentAt ? ` · ${formatBerlinDateTime(digest.sentAt)}` : ""}
                    {digest.dataCompleteness !== null
                      ? ` · ${Math.round(digest.dataCompleteness * 100)} %`
                      : ""}
                  </p>
                </div>
                <Badge
                  variant={
                    digest.status === "sent"
                      ? "success"
                      : digest.status === "failed"
                        ? "danger"
                        : "muted"
                  }
                >
                  {digest.status}
                </Badge>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
