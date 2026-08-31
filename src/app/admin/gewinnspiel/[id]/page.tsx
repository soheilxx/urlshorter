import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { anonymizeSweepstakesEntryAction } from "@/actions/sweepstakes-actions";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { SweepstakesStatusForm } from "@/components/admin/sweepstakes-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { retailerLabel, SWEEPSTAKES_STATUS_LABELS } from "@/lib/gewinnspiel-config";
import { decryptOrderNumber } from "@/lib/sweepstakes-crypto";
import { formatBerlinDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Teilnahme-Details" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium break-words text-zinc-900 sm:text-right">{value}</dd>
    </div>
  );
}

export default async function SweepstakesEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const entry = await prisma.sweepstakesEntry.findUnique({ where: { id } });
  if (!entry) notFound();

  const anonymized = entry.status === "DELETED";
  const orderNumber = anonymized
    ? null
    : (decryptOrderNumber(entry.orderNumberEncrypted) ?? "(nicht entschlüsselbar)");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/gewinnspiel"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Zurück zur Übersicht
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-xl font-bold tracking-tight">{entry.referenceNumber}</h1>
          <Badge variant={anonymized ? "danger" : "muted"}>
            {SWEEPSTAKES_STATUS_LABELS[entry.status] ?? entry.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Eingegangen am {formatBerlinDateTime(entry.createdAt)} · Zuletzt geändert am{" "}
          {formatBerlinDateTime(entry.updatedAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Kaufdaten</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-zinc-100">
                <Row label="Händler" value={retailerLabel(entry.retailer, entry.retailerOther)} />
                <Row
                  label="Bestellnummer"
                  value={
                    anonymized ? (
                      "(anonymisiert)"
                    ) : (
                      <span className="font-mono">{orderNumber}</span>
                    )
                  }
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Persönliche Daten</CardTitle>
            </CardHeader>
            <CardContent>
              {anonymized ? (
                <p className="text-sm text-zinc-400">
                  Diese Teilnahme wurde anonymisiert – personenbezogene Daten sind gelöscht.
                </p>
              ) : (
                <dl className="divide-y divide-zinc-100">
                  <Row label="Name" value={`${entry.firstName} ${entry.lastName}`} />
                  <Row
                    label="Anschrift"
                    value={`${entry.street} ${entry.houseNumber}, ${entry.postalCode} ${entry.city}, ${entry.country}`}
                  />
                  <Row label="E-Mail" value={entry.email} />
                  <Row label="Telefon" value={entry.phone} />
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bestätigungen & Herkunft</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-zinc-100">
                <Row
                  label="Richtigkeit bestätigt"
                  value={formatBerlinDateTime(entry.confirmedAccuracyAt)}
                />
                <Row
                  label="Teilnahmebedingungen"
                  value={`${formatBerlinDateTime(entry.acceptedTermsAt)} (${entry.termsVersion})`}
                />
                <Row
                  label="Datenschutzhinweise"
                  value={`${formatBerlinDateTime(entry.acknowledgedPrivacyAt)} (${entry.privacyVersion})`}
                />
                <Row
                  label="Quelle (UTM)"
                  value={
                    [entry.utmSource, entry.utmMedium, entry.utmCampaign]
                      .filter(Boolean)
                      .join(" / ") || "–"
                  }
                />
                <Row label="Referrer" value={entry.referrer ?? "–"} />
                <Row label="Landing-Host" value={entry.landingHost ?? "–"} />
                <Row
                  label="Bestätigungs-E-Mail"
                  value={
                    entry.emailConfirmationSentAt
                      ? `versendet am ${formatBerlinDateTime(entry.emailConfirmationSentAt)}`
                      : "nicht versendet (kein E-Mail-Dienst konfiguriert)"
                  }
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status & interne Notiz</CardTitle>
            </CardHeader>
            <CardContent>
              {anonymized ? (
                <p className="text-sm text-zinc-400">
                  Anonymisierte Teilnahmen können nicht mehr bearbeitet werden.
                </p>
              ) : (
                <SweepstakesStatusForm
                  entry={{
                    id: entry.id,
                    status: entry.status,
                    internalNote: entry.internalNote,
                  }}
                />
              )}
            </CardContent>
          </Card>

          {!anonymized ? (
            <Card>
              <CardHeader>
                <CardTitle>Datenschutz-Löschung</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-zinc-500">
                  Entfernt alle personenbezogenen Daten dieser Teilnahme unwiderruflich
                  (Anonymisierung). Referenz und Bestellnummern-Hash bleiben erhalten, damit die
                  Bestellung nicht erneut registriert werden kann.
                </p>
                <form action={anonymizeSweepstakesEntryAction}>
                  <input type="hidden" name="id" value={entry.id} />
                  <ConfirmSubmitButton
                    confirmText={`Teilnahme ${entry.referenceNumber} wirklich anonymisieren? Dies kann nicht rückgängig gemacht werden.`}
                  >
                    Teilnahme anonymisieren
                  </ConfirmSubmitButton>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
