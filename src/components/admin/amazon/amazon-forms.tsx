"use client";

import { useActionState } from "react";
import { EMPTY_USER_STATE } from "@/actions/action-states";
import {
  createAlertRuleAction,
  createAnnotationAction,
  importActualSalesAction,
  importBaselineAction,
  runAmazonJobAction,
  saveAmazonSettingsAction,
  saveEditionAction,
  testProvidersAction,
  updateCategoryAction,
} from "@/actions/amazon-actions";
import { useSuccessRefresh } from "@/components/admin/use-success-refresh";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

/**
 * Client-Formulare des Amazon-Ranking-Moduls (useActionState +
 * useSuccessRefresh-Muster – kein revalidatePath in den Actions).
 */

const INTERVAL_PRESETS = [
  { minutes: 15, label: "15 Minuten" },
  { minutes: 30, label: "30 Minuten" },
  { minutes: 60, label: "60 Minuten" },
  { minutes: 180, label: "3 Stunden" },
  { minutes: 360, label: "6 Stunden" },
  { minutes: 720, label: "12 Stunden" },
  { minutes: 1440, label: "24 Stunden" },
];

function IntervalSelect({
  name,
  id,
  defaultMinutes,
}: {
  name: string;
  id: string;
  defaultMinutes: number;
}) {
  const isPreset = INTERVAL_PRESETS.some((p) => p.minutes === defaultMinutes);
  return (
    <Select name={name} id={id} defaultValue={String(defaultMinutes)}>
      {INTERVAL_PRESETS.map((preset) => (
        <option key={preset.minutes} value={preset.minutes}>
          {preset.label}
        </option>
      ))}
      {!isPreset ? (
        <option value={defaultMinutes}>Benutzerdefiniert ({defaultMinutes} min)</option>
      ) : null}
    </Select>
  );
}

function StateAlerts({ state }: { state: { error: string | null; success: string | null } }) {
  return (
    <>
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

export interface AmazonSettingsFormValues {
  enabled: boolean;
  rankIntervalMinutes: number;
  leaderboardIntervalMinutes: number;
  metadataIntervalMinutes: number;
  staleAfterMinutes: number;
  providerPriority: string;
  fallbackEnabled: boolean;
  digestEnabled: boolean;
  digestTime: string;
  digestRecipient: string;
  dailyCreditBudget: number | null;
  salesEstimationEnabled: boolean;
  autoFollowCategories: boolean;
}

export function AmazonSettingsForm({ values }: { values: AmazonSettingsFormValues }) {
  const [state, formAction, pending] = useActionState(saveAmazonSettingsAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <StateAlerts state={state} />

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={values.enabled}
          className="h-4 w-4 rounded border-zinc-300"
        />
        Modul aktiv (Scheduler ruft Provider automatisch ab)
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="as-rank">Rang-Intervall (eigenes Buch + Kategorien)</Label>
          <IntervalSelect name="rankIntervalMinutes" id="as-rank" defaultMinutes={values.rankIntervalMinutes} />
        </div>
        <div>
          <Label htmlFor="as-lb">Top-25-Intervall</Label>
          <IntervalSelect
            name="leaderboardIntervalMinutes"
            id="as-lb"
            defaultMinutes={values.leaderboardIntervalMinutes}
          />
        </div>
        <div>
          <Label htmlFor="as-meta">Metadaten-Intervall</Label>
          <IntervalSelect
            name="metadataIntervalMinutes"
            id="as-meta"
            defaultMinutes={values.metadataIntervalMinutes}
          />
        </div>
        <div>
          <Label htmlFor="as-stale">Stale-Grenze (Minuten ohne frische Messung)</Label>
          <Input
            id="as-stale"
            name="staleAfterMinutes"
            type="number"
            min={15}
            max={10080}
            defaultValue={values.staleAfterMinutes}
          />
        </div>
        <div>
          <Label htmlFor="as-priority">Providerpriorität (kanonischer Rang)</Label>
          <Select name="providerPriority" id="as-priority" defaultValue={values.providerPriority}>
            <option value="creators_first">Amazon Creators zuerst</option>
            <option value="rainforest_first">Rainforest zuerst</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="as-budget">Tägliches Rainforest-Creditbudget (leer = kein Limit)</Label>
          <Input
            id="as-budget"
            name="dailyCreditBudget"
            type="number"
            min={1}
            max={1000000}
            defaultValue={values.dailyCreditBudget ?? ""}
            placeholder="z. B. 100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="fallbackEnabled"
            defaultChecked={values.fallbackEnabled}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Provider-Fallback aktiv
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="autoFollowCategories"
            defaultChecked={values.autoFollowCategories}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Neue Kategorien automatisch beobachten (Auto-Follow)
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="digestEnabled"
            defaultChecked={values.digestEnabled}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Tägliche Zusammenfassung aktiv
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="salesEstimationEnabled"
            defaultChecked={values.salesEstimationEnabled}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Verkaufsschätzung (extern, max. 1×/Tag, verbraucht Credits)
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="as-digest-time">Digest-Uhrzeit (Europe/Berlin)</Label>
          <Input
            id="as-digest-time"
            name="digestTime"
            type="time"
            defaultValue={values.digestTime}
          />
        </div>
        <div>
          <Label htmlFor="as-digest-recipient">Digest-Empfänger</Label>
          <Input
            id="as-digest-recipient"
            name="digestRecipient"
            defaultValue={values.digestRecipient}
            placeholder="dashboard oder E-Mail-Adresse"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Wird gespeichert …" : "Einstellungen speichern"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Manuelle Job-Auslösung + Verbindungstest
// ---------------------------------------------------------------------------

export function ManualJobForm({ jobs }: { jobs: Array<{ type: string; label: string }> }) {
  const [state, formAction, pending] = useActionState(runAmazonJobAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state);
  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <StateAlerts state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <Label htmlFor="mj-job">Job manuell ausführen (verbraucht ggf. Credits)</Label>
          <Select name="jobType" id="mj-job" defaultValue={jobs[0]?.type}>
            {jobs.map((job) => (
              <option key={job.type} value={job.type}>
                {job.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={pending} variant="secondary" className="w-full sm:w-auto">
          {pending ? "Läuft …" : "Jetzt ausführen"}
        </Button>
      </div>
    </form>
  );
}

export function TestProvidersForm() {
  const [state, formAction, pending] = useActionState(testProvidersAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state);
  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <StateAlerts state={state} />
      <Button type="submit" disabled={pending} variant="secondary" className="w-full sm:w-auto">
        {pending ? "Teste Verbindungen …" : "Test Connection (beide Provider)"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Kategorie bearbeiten
// ---------------------------------------------------------------------------

export function CategoryEditForm({
  category,
}: {
  category: {
    id: string;
    canonicalName: string;
    active: boolean;
    required: boolean;
    leaderboardEnabled: boolean;
    autoFollow: boolean;
    refreshIntervalOverride: number | null;
  };
}) {
  const [state, formAction, pending] = useActionState(updateCategoryAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state);
  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <StateAlerts state={state} />
      <input type="hidden" name="categoryId" value={category.id} />
      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-700">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="active"
            defaultChecked={category.active}
            disabled={category.required}
            className="h-3.5 w-3.5 rounded border-zinc-300"
          />
          Aktiv{category.required ? " (Pflicht)" : ""}
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="leaderboardEnabled"
            defaultChecked={category.leaderboardEnabled}
            className="h-3.5 w-3.5 rounded border-zinc-300"
          />
          Top 25
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="autoFollow"
            defaultChecked={category.autoFollow}
            className="h-3.5 w-3.5 rounded border-zinc-300"
          />
          Auto-Follow
        </label>
        <input
          type="number"
          name="refreshIntervalOverride"
          defaultValue={category.refreshIntervalOverride ?? ""}
          placeholder="Intervall (min)"
          min={15}
          max={10080}
          aria-label={`Individuelles Intervall für ${category.canonicalName} in Minuten`}
          className="h-7 w-28 rounded-lg border border-zinc-300 px-2 text-xs"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending} className="w-full sm:w-auto">
          {pending ? "…" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Edition bearbeiten
// ---------------------------------------------------------------------------

export function EditionForm({
  edition,
}: {
  edition: {
    id: string;
    asin: string;
    isbn10: string | null;
    isbn13: string | null;
    format: string;
    preorder: boolean;
    trackedShortCode: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(saveEditionAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state);
  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <StateAlerts state={state} />
      <input type="hidden" name="editionId" value={edition.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ed-asin">ASIN</Label>
          <Input id="ed-asin" name="asin" defaultValue={edition.asin} className="font-mono" required maxLength={10} />
        </div>
        <div>
          <Label htmlFor="ed-format">Format</Label>
          <Input id="ed-format" name="format" defaultValue={edition.format} required maxLength={60} />
        </div>
        <div>
          <Label htmlFor="ed-isbn10">ISBN-10</Label>
          <Input id="ed-isbn10" name="isbn10" defaultValue={edition.isbn10 ?? ""} className="font-mono" />
        </div>
        <div>
          <Label htmlFor="ed-isbn13">ISBN-13</Label>
          <Input id="ed-isbn13" name="isbn13" defaultValue={edition.isbn13 ?? ""} className="font-mono" />
        </div>
        <div>
          <Label htmlFor="ed-code">Kurzlink-Code (Klick-Verknüpfung)</Label>
          <Input
            id="ed-code"
            name="trackedShortCode"
            defaultValue={edition.trackedShortCode ?? ""}
            maxLength={4}
            placeholder="z. B. wulp"
            className="font-mono"
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="preorder"
            defaultChecked={edition.preorder}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Vorbestellphase aktiv
        </label>
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Wird gespeichert …" : "Edition speichern"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Baseline-Import (manuelle Stände, source=manual)
// ---------------------------------------------------------------------------

export function BaselineImportForm({ editionId }: { editionId: string }) {
  const [state, formAction, pending] = useActionState(importBaselineAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state, true);
  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <StateAlerts state={state} />
      <input type="hidden" name="editionId" value={editionId} />
      <div>
        <Label htmlFor="bl-ts">Beobachtungszeitpunkt</Label>
        <Input id="bl-ts" name="timestamp" type="datetime-local" required />
      </div>
      <div>
        <Label htmlFor="bl-entries">Stände (eine Zeile je Kategorie: Kategorie = Rang)</Label>
        <Textarea
          id="bl-entries"
          name="entries"
          rows={5}
          required
          placeholder={"Bücher = 12484\nPräsentationen = 16\nE-Business (Bücher) = 33\nBiografien von Geschäftsleuten = 42"}
          className="font-mono"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Wird als manuelle Baseline (Quelle „manuell“) gespeichert – niemals als Live-Messung.
        </p>
      </div>
      <Button type="submit" disabled={pending} variant="secondary" className="w-full sm:w-auto">
        {pending ? "Importiere …" : "Baseline importieren"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Kampagnen-Annotation
// ---------------------------------------------------------------------------

export function AnnotationForm() {
  const [state, formAction, pending] = useActionState(createAnnotationAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state, true);
  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <StateAlerts state={state} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="an-title">Titel</Label>
          <Input id="an-title" name="title" required maxLength={200} placeholder="z. B. Newsletter-Kampagne Start" />
        </div>
        <div>
          <Label htmlFor="an-ts">Zeitpunkt</Label>
          <Input id="an-ts" name="timestamp" type="datetime-local" />
        </div>
        <div>
          <Label htmlFor="an-type">Typ</Label>
          <Select name="type" id="an-type" defaultValue="campaign">
            <option value="campaign">Kampagne</option>
            <option value="press">Presse</option>
            <option value="price">Preisaktion</option>
            <option value="other">Sonstiges</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="an-campaign">Kampagnen-Kennung (optional)</Label>
          <Input id="an-campaign" name="campaign" maxLength={200} placeholder="utm_campaign-Wert" />
        </div>
      </div>
      <div>
        <Label htmlFor="an-desc">Beschreibung (optional)</Label>
        <Textarea id="an-desc" name="description" rows={2} maxLength={1000} />
      </div>
      <Button type="submit" disabled={pending} variant="secondary" className="w-full sm:w-auto">
        {pending ? "Wird angelegt …" : "Annotation anlegen"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Alert-Regel
// ---------------------------------------------------------------------------

export function AlertRuleForm({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState(createAlertRuleAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state, true);
  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <StateAlerts state={state} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ar-name">Name</Label>
          <Input id="ar-name" name="name" required maxLength={200} placeholder="z. B. Sachbücher Top 10" />
        </div>
        <div>
          <Label htmlFor="ar-cat">Kategorie (leer = alle)</Label>
          <Select name="categoryId" id="ar-cat" defaultValue="">
            <option value="">Alle Kategorien</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ar-metric">Kennzahl</Label>
          <Select name="metric" id="ar-metric" defaultValue="rank_below">
            <option value="rank_below">Rang</option>
            <option value="movement_positions">Bewegung (Plätze)</option>
            <option value="movement_percent">Bewegung (Prozent)</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="ar-op">Vergleich</Label>
            <Select name="operator" id="ar-op" defaultValue="lte">
              <option value="lte">≤</option>
              <option value="lt">&lt;</option>
              <option value="gte">≥</option>
              <option value="gt">&gt;</option>
              <option value="eq">=</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="ar-th">Schwelle</Label>
            <Input id="ar-th" name="threshold" type="number" step="any" required />
          </div>
        </div>
        <div>
          <Label htmlFor="ar-cd">Cooldown (Minuten)</Label>
          <Input id="ar-cd" name="cooldownMinutes" type="number" min={5} max={10080} defaultValue={360} />
        </div>
        <div>
          <Label htmlFor="ar-ch">Kanäle</Label>
          <Select name="channels" id="ar-ch" defaultValue="inapp">
            <option value="inapp">In-App</option>
            <option value="inapp,email">In-App + E-Mail</option>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={pending} variant="secondary" className="w-full sm:w-auto">
        {pending ? "Wird angelegt …" : "Alert-Regel anlegen"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Echte Verkaufszahlen importieren
// ---------------------------------------------------------------------------

export function ActualSalesForm({ editionId }: { editionId: string }) {
  const [state, formAction, pending] = useActionState(importActualSalesAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state, true);
  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <StateAlerts state={state} />
      <input type="hidden" name="editionId" value={editionId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sa-start">Zeitraum von</Label>
          <Input id="sa-start" name="periodStart" type="date" required />
        </div>
        <div>
          <Label htmlFor="sa-end">Zeitraum bis</Label>
          <Input id="sa-end" name="periodEnd" type="date" required />
        </div>
        <div>
          <Label htmlFor="sa-units">Verkaufte Exemplare</Label>
          <Input id="sa-units" name="units" type="number" min={0} required />
        </div>
        <div>
          <Label htmlFor="sa-source">Quelle</Label>
          <Input id="sa-source" name="source" required maxLength={200} placeholder="z. B. Verlagsabrechnung Q4" />
        </div>
      </div>
      <p className="text-xs text-zinc-400">
        Echte Verkaufszahlen bleiben strikt von Schätzungen getrennt und werden nie überschrieben.
      </p>
      <Button type="submit" disabled={pending} variant="secondary" className="w-full sm:w-auto">
        {pending ? "Importiere …" : "Verkaufszahlen importieren"}
      </Button>
    </form>
  );
}
