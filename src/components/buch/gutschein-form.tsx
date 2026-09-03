"use client";

import { AlertTriangle, CheckCircle2, Copy, Ticket, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { EMPTY_VOUCHER_STATE } from "@/actions/action-states";
import { redeemVoucherAction } from "@/actions/gutschein-actions";
import { trackGewinnEvent } from "@/lib/gewinn-analytics";
import { RETAILERS } from "@/lib/gewinnspiel-config";
import { GUTSCHEIN_RABATT_LABEL, GUTSCHEIN_SHOP_NAME, GUTSCHEIN_SHOP_URL } from "@/lib/gutschein-config";
import { cn } from "@/lib/utils";

/**
 * Gutschein-Formular der Newsletter-Aktion: Bestelldaten eintragen → der
 * Code erscheint sofort in einem Bestätigungsfenster (und bleibt danach als
 * Karte sichtbar). Der Code wird NICHT per E-Mail versendet – die Oberfläche
 * drängt deshalb auf Kopieren/Notieren.
 * Bot-Schutz wie beim Gewinnspiel: Honeypot + signiertes Zeit-Token.
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

/** Gutscheincode groß + Kopieren-Button mit Clipboard-Fallback. */
function CodeBox({ code, testId }: { code: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLSpanElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Fallback: Text markieren, damit manuelles Kopieren sofort möglich ist
      const range = document.createRange();
      if (codeRef.current) {
        range.selectNodeContents(codeRef.current);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="rounded-xl border border-[var(--gw-gold)]/50 bg-[var(--gw-bg)] px-4 py-4">
      <p className="text-xs font-semibold tracking-[0.2em] text-[var(--gw-gold)] uppercase">
        Dein Gutscheincode
      </p>
      <div className="mt-2 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <span
          ref={codeRef}
          data-testid={testId}
          className="min-w-0 flex-1 select-all break-all rounded-lg bg-white/[0.05] px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.15em] text-[var(--gw-gold-strong)] sm:text-3xl"
        >
          {code}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[var(--gw-gold-strong)] to-[var(--gw-gold-deep)] px-5 text-sm font-semibold text-[#181207] shadow-lg shadow-black/40 outline-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--gw-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gw-bg)]"
        >
          {copied ? (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Kopiert!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" /> Code kopieren
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function NoEmailHint() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Wichtig:</strong> Der Code wird{" "}
        <strong className="font-semibold">nicht per E-Mail</strong> versendet. Bitte kopiere
        ihn jetzt oder notiere ihn dir – du kannst ihn später nur mit derselben Bestellnummer
        und E-Mail-Adresse erneut aufrufen.
      </span>
    </p>
  );
}

export function GutscheinForm({
  formToken,
  utm,
  privacyUrl,
}: {
  formToken: string;
  utm: UtmParams;
  privacyUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(redeemVoucherAction, EMPTY_VOUCHER_STATE);
  const [retailer, setRetailer] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const referrerRef = useRef<HTMLInputElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const formStartTracked = useRef(false);

  useEffect(() => {
    if (referrerRef.current && document.referrer) {
      referrerRef.current.value = document.referrer.slice(0, 300);
    }
  }, []);

  useEffect(() => {
    if (state.error) errorSummaryRef.current?.focus();
  }, [state]);

  // Erfolg → Bestätigungsfenster öffnen + Tracking (nur Event-Namen)
  useEffect(() => {
    if (state.ok && state.code) {
      setDialogOpen(true);
      trackGewinnEvent(state.alreadyIssued ? "gutschein_erneut_angezeigt" : "gutschein_ausgestellt");
    } else if (state.error) {
      trackGewinnEvent("gutschein_formular_fehler");
    }
  }, [state]);

  // Dialog: Fokus, Escape, Scroll-Lock
  useEffect(() => {
    if (!dialogOpen) return undefined;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialogOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [dialogOpen]);

  const fe = state.fieldErrors ?? {};

  if (state.ok && state.code) {
    return (
      <>
        {dialogOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Fenster schließen"
              onClick={() => setDialogOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="gutschein-dialog-title"
              className="gewinn-theme relative w-full max-w-lg rounded-2xl border border-[var(--gw-gold)]/40 bg-[var(--gw-surface)] p-6 shadow-2xl shadow-black/60 sm:p-8"
            >
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                aria-label="Schließen"
                className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl text-[var(--gw-ink-mute)] hover:bg-white/[0.06] hover:text-[var(--gw-ink)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <CheckCircle2
                className="h-12 w-12 text-[var(--gw-gold)]"
                aria-hidden="true"
                strokeWidth={1.5}
              />
              <h3
                id="gutschein-dialog-title"
                className="mt-4 text-2xl font-semibold tracking-tight text-[var(--gw-ink)]"
              >
                {state.alreadyIssued ? "Hier ist dein Gutschein noch einmal" : "Dein Gutschein ist da!"}
              </h3>
              <p className="mt-2 text-[var(--gw-ink-soft)]">
                {GUTSCHEIN_RABATT_LABEL} Rabatt auf das gesamte Sortiment im {GUTSCHEIN_SHOP_NAME}.
              </p>
              <div className="mt-5">
                <CodeBox code={state.code} testId="gutschein-code" />
              </div>
              <div className="mt-4">
                <NoEmailHint />
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setDialogOpen(false)}
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border gw-hairline bg-white/[0.04] px-5 text-sm font-semibold text-[var(--gw-ink)] outline-none hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[var(--gw-gold)]"
              >
                Ich habe den Code gespeichert
              </button>
            </div>
          </div>
        ) : null}

        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border gw-hairline bg-[var(--gw-surface)] p-6 sm:p-10"
        >
          <div className="mx-auto max-w-xl">
            <div className="flex items-center gap-3">
              <Ticket className="h-8 w-8 text-[var(--gw-gold)]" aria-hidden="true" strokeWidth={1.5} />
              <h3 className="text-2xl font-semibold tracking-tight text-[var(--gw-ink)]">
                {state.alreadyIssued ? "Dein Gutschein (erneut angezeigt)" : "Dein Gutschein ist da!"}
              </h3>
            </div>
            <p className="mt-3 text-[var(--gw-ink-soft)]">
              Danke für deine Buchbestellung! Löse den Code im{" "}
              <a
                href={GUTSCHEIN_SHOP_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-gw-event="gutschein_shop_klick"
                className="underline decoration-[var(--gw-gold)]/50 underline-offset-2 hover:text-[var(--gw-gold-strong)]"
              >
                {GUTSCHEIN_SHOP_NAME}
              </a>{" "}
              ein – {GUTSCHEIN_RABATT_LABEL} Rabatt auf das gesamte Sortiment.
            </p>
            <div className="mt-6">
              <CodeBox code={state.code} testId="gutschein-code-karte" />
            </div>
            <div className="mt-4">
              <NoEmailHint />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <form
      action={formAction}
      onFocusCapture={() => {
        if (!formStartTracked.current) {
          formStartTracked.current = true;
          trackGewinnEvent("gutschein_formular_start");
        }
      }}
      className="rounded-2xl border gw-hairline bg-[var(--gw-surface)] p-5 sm:p-8"
    >
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="gs-website">Website (bitte leer lassen)</label>
        <input id="gs-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
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
          Deine Buchbestellung
        </legend>
        <p className="mt-1 text-sm text-[var(--gw-ink-mute)]">
          Die Bestellnummer findest du in deiner Bestellbestätigung.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="gs-retailer" label="Händler" error={fe.retailer}>
            <select
              id="gs-retailer"
              name="retailer"
              required
              value={retailer}
              onChange={(e) => setRetailer(e.target.value)}
              aria-invalid={fe.retailer ? true : undefined}
              aria-describedby={fe.retailer ? "gs-retailer-error" : undefined}
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
          <Field id="gs-orderNumber" label="Bestell- / Auftragsnummer" error={fe.orderNumber}>
            <input
              id="gs-orderNumber"
              name="orderNumber"
              type="text"
              required
              maxLength={60}
              autoComplete="off"
              spellCheck={false}
              placeholder="z. B. 306-1234567-1234567"
              aria-invalid={fe.orderNumber ? true : undefined}
              aria-describedby={fe.orderNumber ? "gs-orderNumber-error" : undefined}
              className={inputClass}
            />
          </Field>
          {retailer === "other" ? (
            <Field
              id="gs-retailerOther"
              label="Name des Händlers"
              error={fe.retailerOther}
              className="sm:col-span-2"
            >
              <input
                id="gs-retailerOther"
                name="retailerOther"
                type="text"
                required
                maxLength={120}
                placeholder="z. B. Osiander"
                aria-invalid={fe.retailerOther ? true : undefined}
                aria-describedby={fe.retailerOther ? "gs-retailerOther-error" : undefined}
                className={inputClass}
              />
            </Field>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="mt-9 min-w-0">
        <legend className="text-lg font-semibold tracking-tight text-[var(--gw-ink)]">
          Deine Daten
        </legend>
        <p className="mt-1 text-sm text-[var(--gw-ink-mute)]">
          Wir verwenden deine Daten ausschließlich für die Ausstellung des Gutscheins.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="gs-firstName" label="Vorname" error={fe.firstName}>
            <input
              id="gs-firstName"
              name="firstName"
              type="text"
              required
              maxLength={100}
              autoComplete="given-name"
              aria-invalid={fe.firstName ? true : undefined}
              aria-describedby={fe.firstName ? "gs-firstName-error" : undefined}
              className={inputClass}
            />
          </Field>
          <Field id="gs-lastName" label="Nachname" error={fe.lastName}>
            <input
              id="gs-lastName"
              name="lastName"
              type="text"
              required
              maxLength={100}
              autoComplete="family-name"
              aria-invalid={fe.lastName ? true : undefined}
              aria-describedby={fe.lastName ? "gs-lastName-error" : undefined}
              className={inputClass}
            />
          </Field>
          <Field id="gs-email" label="E-Mail-Adresse" error={fe.email} className="sm:col-span-2">
            <input
              id="gs-email"
              name="email"
              type="email"
              required
              maxLength={200}
              autoComplete="email"
              inputMode="email"
              placeholder="name@beispiel.de"
              aria-invalid={fe.email ? true : undefined}
              aria-describedby={fe.email ? "gs-email-error" : undefined}
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
          <label htmlFor="gs-consent" className="flex min-h-[44px] cursor-pointer items-start gap-3">
            <input
              id="gs-consent"
              name="consent"
              type="checkbox"
              required
              aria-invalid={fe.consent ? true : undefined}
              aria-describedby={fe.consent ? "gs-consent-error" : undefined}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-auto rounded border-[var(--gw-border)] bg-white/[0.06] accent-[var(--gw-gold)]"
            />
            <span className="text-sm leading-relaxed text-[var(--gw-ink-soft)]">
              Ich bestätige, dass meine Angaben korrekt sind, akzeptiere die{" "}
              <a
                href="#aktionsbedingungen"
                className="underline decoration-[var(--gw-gold)]/50 underline-offset-2 hover:text-[var(--gw-gold-strong)]"
              >
                Aktionsbedingungen
              </a>{" "}
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
            </span>
          </label>
          {fe.consent ? (
            <p id="gs-consent-error" className="mt-1 pl-8 text-sm text-[#e8a08a]">
              {fe.consent}
            </p>
          ) : null}
        </div>
      </fieldset>

      <div className="mt-9">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[var(--gw-gold-strong)] to-[var(--gw-gold-deep)] px-6 py-3.5 text-base font-semibold text-[#181207] shadow-lg shadow-black/40 outline-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--gw-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gw-surface)] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          <Ticket className="h-4 w-4" aria-hidden="true" />
          {pending ? "Gutschein wird ausgestellt …" : "Gutscheincode jetzt anzeigen"}
        </button>
        <p className="mt-3 text-sm text-[var(--gw-ink-mute)]">
          Dein Code erscheint sofort nach dem Absenden – er wird nicht per E-Mail versendet.
        </p>
      </div>
    </form>
  );
}
