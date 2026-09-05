"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { EMPTY_SWEEPSTAKES_STATE } from "@/actions/action-states";
import { submitSweepstakesAction } from "@/actions/sweepstakes-actions";
import { trackGewinnEvent } from "@/lib/gewinn-analytics";
import { ANNOUNCEMENT_DATETIME_LABEL, RETAILERS } from "@/lib/gewinnspiel-config";
import { cn } from "@/lib/utils";

/**
 * Teilnahmeformular des Gewinnspiels.
 * - Ein Feld pro Zeile auf Mobilgeräten, sinnvolle Gruppierung ab sm:
 * - Sichtbare Labels, Inline-Fehler mit aria-describedby, Fokus-Ringe
 * - Honeypot + signiertes Formular-Token gegen Bots
 * - Erfolgsansicht ersetzt das Formular (mit Teilnahme-Referenz)
 */

interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

const inputClass =
  "w-full rounded-xl border border-[var(--gw-border-soft)] bg-white/[0.04] px-4 py-3 text-base text-[var(--gw-ink)] placeholder:text-[var(--gw-ink-mute)] outline-none transition-colors focus:border-[var(--gw-gold)] focus:ring-2 focus:ring-[var(--gw-gold)]/30";

const labelClass = "mb-1.5 block text-sm font-medium text-[var(--gw-ink-soft)]";

function Field({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-[#e8a08a]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function EntryForm({
  formToken,
  utm,
  privacyUrl,
}: {
  formToken: string;
  utm: UtmParams;
  privacyUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    submitSweepstakesAction,
    EMPTY_SWEEPSTAKES_STATE,
  );
  const [retailer, setRetailer] = useState<string>("");
  const referrerRef = useRef<HTMLInputElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const formStartTracked = useRef(false);

  // Ursprünglichen Referrer clientseitig erfassen (nur serverseitig gespeichert)
  useEffect(() => {
    if (referrerRef.current && document.referrer) {
      referrerRef.current.value = document.referrer.slice(0, 300);
    }
  }, []);

  // Fehlerzusammenfassung fokussieren (Screenreader + Sichtbarkeit)
  useEffect(() => {
    if (state.error) errorSummaryRef.current?.focus();
  }, [state]);

  // Nicht-personenbezogene Tracking-Events (nur Event-Namen, keine Inhalte)
  useEffect(() => {
    if (state.ok) trackGewinnEvent("gewinnspiel_teilnahme");
    else if (state.error) trackGewinnEvent("gewinnspiel_formular_fehler");
  }, [state]);

  const fe = state.fieldErrors ?? {};

  if (state.ok && state.referenceNumber) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border gw-hairline bg-[var(--gw-surface)] p-6 sm:p-10"
      >
        <div className="mx-auto max-w-xl text-center">
          <CheckCircle2
            className="mx-auto h-12 w-12 text-[var(--gw-gold)]"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--gw-ink)]">
            Deine Teilnahme wurde erfolgreich registriert.
          </h3>
          <p className="mt-4 text-[var(--gw-ink-soft)]">
            Vielen Dank für deine Teilnahme – und vor allem für deine Bestellung und die Unterstützung
            meines Buches. Deine Angaben sind bei uns eingegangen.
          </p>
          <p className="mt-3 text-[var(--gw-ink-soft)]">
            Ich wünsche dir viel Glück bei der Verlosung! Die Gewinnerbekanntgabe erfolgt am{" "}
            {ANNOUNCEMENT_DATETIME_LABEL}.
          </p>
          <p className="mt-4 font-medium text-[var(--gw-ink)]">Soheil Hosseini</p>

          <div className="mt-8 rounded-xl border gw-hairline bg-white/[0.04] px-5 py-4">
            <p className="text-sm text-[var(--gw-ink-mute)]">Deine Teilnahme-Referenz</p>
            <p
              data-testid="teilnahme-referenz"
              className="mt-1 font-mono text-xl font-semibold tracking-wide text-[var(--gw-gold-strong)]"
            >
              {state.referenceNumber}
            </p>
          </div>
          <p className="mt-4 text-sm text-[var(--gw-ink-mute)]">
            Bitte bewahre deine Bestellbestätigung bis zum Abschluss der Verlosung auf.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      noValidate={false}
      onFocusCapture={() => {
        if (!formStartTracked.current) {
          formStartTracked.current = true;
          trackGewinnEvent("gewinnspiel_formular_start");
        }
      }}
      className="rounded-2xl border gw-hairline bg-[var(--gw-surface)] p-5 sm:p-8"
    >
      {/* Anti-Bot: Honeypot (für Menschen unsichtbar) + signiertes Zeit-Token */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="website">Website (bitte leer lassen)</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="formToken" value={formToken} />
      <input type="hidden" name="utm_source" value={utm.utm_source ?? ""} />
      <input type="hidden" name="utm_medium" value={utm.utm_medium ?? ""} />
      <input type="hidden" name="utm_campaign" value={utm.utm_campaign ?? ""} />
      <input type="hidden" name="utm_content" value={utm.utm_content ?? ""} />
      <input type="hidden" name="utm_term" value={utm.utm_term ?? ""} />
      <input type="hidden" name="clientReferrer" ref={referrerRef} />

      {state.error ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="mb-6 rounded-xl border border-[#8a4a38]/60 bg-[#2a1510] px-4 py-3 text-sm text-[#f0c0b0]"
        >
          {state.error}
        </div>
      ) : null}

      <fieldset className="min-w-0">
        <legend className="text-lg font-semibold tracking-tight text-[var(--gw-ink)]">
          Bestelldaten
        </legend>
        <p className="mt-1 text-sm text-[var(--gw-ink-mute)]">
          Du findest die Bestellnummer in deiner Bestellbestätigung.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field id="retailer" label="Händler" error={fe.retailer}>
            <select
              id="retailer"
              name="retailer"
              required
              value={retailer}
              onChange={(e) => setRetailer(e.target.value)}
              aria-invalid={fe.retailer ? true : undefined}
              aria-describedby={fe.retailer ? "retailer-error" : undefined}
              className={cn(inputClass, "appearance-none")}
            >
              <option value="" disabled>
                Bitte auswählen …
              </option>
              {RETAILERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="orderNumber" label="Bestell- / Auftragsnummer" error={fe.orderNumber}>
            <input
              id="orderNumber"
              name="orderNumber"
              type="text"
              required
              maxLength={60}
              autoComplete="off"
              spellCheck={false}
              placeholder="z. B. 306-1234567-1234567"
              aria-invalid={fe.orderNumber ? true : undefined}
              aria-describedby={fe.orderNumber ? "orderNumber-error" : undefined}
              className={inputClass}
            />
          </Field>
          {retailer === "other" ? (
            <Field
              id="retailerOther"
              label="Name des Händlers"
              error={fe.retailerOther}
              className="sm:col-span-2"
            >
              <input
                id="retailerOther"
                name="retailerOther"
                type="text"
                required
                maxLength={120}
                placeholder="z. B. Osiander"
                aria-invalid={fe.retailerOther ? true : undefined}
                aria-describedby={fe.retailerOther ? "retailerOther-error" : undefined}
                className={inputClass}
              />
            </Field>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="mt-9 min-w-0">
        <legend className="text-lg font-semibold tracking-tight text-[var(--gw-ink)]">
          Persönliche Daten
        </legend>
        <p className="mt-1 text-sm text-[var(--gw-ink-mute)]">
          Wir verwenden deine Daten ausschließlich für die Durchführung des Gewinnspiels.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field id="firstName" label="Vorname" error={fe.firstName}>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              maxLength={100}
              autoComplete="given-name"
              aria-invalid={fe.firstName ? true : undefined}
              aria-describedby={fe.firstName ? "firstName-error" : undefined}
              className={inputClass}
            />
          </Field>
          <Field id="lastName" label="Nachname" error={fe.lastName}>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              maxLength={100}
              autoComplete="family-name"
              aria-invalid={fe.lastName ? true : undefined}
              aria-describedby={fe.lastName ? "lastName-error" : undefined}
              className={inputClass}
            />
          </Field>
          <div className="grid gap-5 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_150px]">
            <Field id="street" label="Straße" error={fe.street}>
              <input
                id="street"
                name="street"
                type="text"
                required
                maxLength={100}
                autoComplete="address-line1"
                aria-invalid={fe.street ? true : undefined}
                aria-describedby={fe.street ? "street-error" : undefined}
                className={inputClass}
              />
            </Field>
            <Field id="houseNumber" label="Hausnummer" error={fe.houseNumber}>
              <input
                id="houseNumber"
                name="houseNumber"
                type="text"
                required
                maxLength={20}
                autoComplete="address-line2"
                aria-invalid={fe.houseNumber ? true : undefined}
                aria-describedby={fe.houseNumber ? "houseNumber-error" : undefined}
                className={inputClass}
              />
            </Field>
          </div>
          <Field id="postalCode" label="Postleitzahl" error={fe.postalCode}>
            <input
              id="postalCode"
              name="postalCode"
              type="text"
              required
              maxLength={12}
              inputMode="numeric"
              autoComplete="postal-code"
              aria-invalid={fe.postalCode ? true : undefined}
              aria-describedby={fe.postalCode ? "postalCode-error" : undefined}
              className={inputClass}
            />
          </Field>
          <Field id="city" label="Ort" error={fe.city}>
            <input
              id="city"
              name="city"
              type="text"
              required
              maxLength={100}
              autoComplete="address-level2"
              aria-invalid={fe.city ? true : undefined}
              aria-describedby={fe.city ? "city-error" : undefined}
              className={inputClass}
            />
          </Field>
          <Field id="country" label="Land" error={fe.country}>
            <input
              id="country"
              name="country"
              type="text"
              required
              maxLength={56}
              defaultValue="Deutschland"
              autoComplete="country-name"
              aria-invalid={fe.country ? true : undefined}
              aria-describedby={fe.country ? "country-error" : undefined}
              className={inputClass}
            />
          </Field>
          <Field id="email" label="E-Mail-Adresse" error={fe.email}>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={200}
              autoComplete="email"
              inputMode="email"
              placeholder="name@beispiel.de"
              aria-invalid={fe.email ? true : undefined}
              aria-describedby={fe.email ? "email-error" : undefined}
              className={inputClass}
            />
          </Field>
          <Field
            id="phone"
            label="Telefonnummer (mit Ländervorwahl)"
            error={fe.phone}
            className="sm:col-span-2"
          >
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              maxLength={30}
              autoComplete="tel"
              inputMode="tel"
              placeholder="+49 151 12345678"
              aria-invalid={fe.phone ? true : undefined}
              aria-describedby={fe.phone ? "phone-error" : undefined}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-9 min-w-0">
        <legend className="text-lg font-semibold tracking-tight text-[var(--gw-ink)]">
          Bestätigung
        </legend>
        <div className="mt-4">
          <CheckboxRow
            id="consent"
            error={fe.consent}
            label={
              <>
                Ich bestätige, dass meine Angaben vollständig und korrekt sind, akzeptiere die{" "}
                <Link
                  href="/gewinn/teilnahmebedingungen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-[var(--gw-gold)]/50 underline-offset-2 hover:text-[var(--gw-gold-strong)]"
                >
                  Teilnahmebedingungen
                </Link>{" "}
                und habe die{" "}
                {privacyUrl ? (
                  <a
                    href={privacyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-[var(--gw-gold)]/50 underline-offset-2 hover:text-[var(--gw-gold-strong)]"
                  >
                    Datenschutzhinweise
                  </a>
                ) : (
                  "Datenschutzhinweise"
                )}{" "}
                zur Kenntnis genommen.
              </>
            }
          />
        </div>
      </fieldset>

      <div className="mt-9">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-b from-[var(--gw-gold-strong)] to-[var(--gw-gold-deep)] px-6 py-3.5 text-base font-semibold text-[#181207] shadow-lg shadow-black/40 transition-transform outline-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--gw-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gw-surface)] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {pending ? "Wird übermittelt …" : "Verbindlich am Gewinnspiel teilnehmen"}
        </button>
        <p className="mt-3 text-sm text-[var(--gw-ink-mute)]">
          Die Gewinnerbekanntgabe erfolgt am {ANNOUNCEMENT_DATETIME_LABEL}.
        </p>
      </div>
    </form>
  );
}

function CheckboxRow({
  id,
  label,
  error,
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-start gap-3">
        <input
          id={id}
          name={id}
          type="checkbox"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-auto rounded border-[var(--gw-border)] bg-white/[0.06] accent-[var(--gw-gold)]"
        />
        <span className="text-sm leading-relaxed text-[var(--gw-ink-soft)]">{label}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-1 pl-8 text-sm text-[#e8a08a]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
