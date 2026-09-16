"use client";

import { Check, CheckCircle2, Copy, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { newFormTokenAction } from "@/actions/sweepstakes-actions";
import { EntryForm, type UtmParams } from "@/components/gewinn/entry-form";
import { Confetti } from "@/components/verlosung/confetti";
import { ShareBox } from "@/components/verlosung/share-box";
import { trackGewinnEvent } from "@/lib/gewinn-analytics";
import { ANNOUNCEMENT_DATETIME_LABEL } from "@/lib/gewinnspiel-config";

/**
 * Teilnahmebereich der Kampagnenseite: gemeinsames EntryForm (Backend,
 * Validierung und Anti-Bot unverändert) mit eigener Erfolgsansicht.
 *
 * „Weitere Bestellnummer registrieren“ holt ein frisches, signiertes
 * Formular-Token vom Server und mountet das Formular neu – ein neuer Vorgang
 * mit leeren Feldern. Die bereits gespeicherte Anmeldung bleibt bestehen; die
 * Bestellnummern-Deduplizierung greift weiterhin serverseitig.
 */
export function VerlosungEntry({
  initialFormToken,
  utm,
  privacyUrl,
  shareText,
}: {
  initialFormToken: string;
  utm: UtmParams;
  privacyUrl: string | null;
  shareText: string;
}) {
  const [formToken, setFormToken] = useState(initialFormToken);
  const [instance, setInstance] = useState(0);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  // Nach einem neuen Vorgang das erste Feld fokussieren (Tastatur/Screenreader).
  useEffect(() => {
    if (instance === 0) return;
    document.getElementById("teilnehmen")?.scrollIntoView({ block: "start" });
    document.getElementById("retailer")?.focus();
  }, [instance]);

  async function startAnother() {
    setRenewing(true);
    setRenewError(null);
    try {
      const token = await newFormTokenAction();
      trackGewinnEvent("verlosung_weitere_bestellnummer");
      setFormToken(token);
      setInstance((i) => i + 1);
    } catch {
      setRenewError(
        "Der neue Vorgang konnte nicht gestartet werden. Bitte lade die Seite neu, um eine weitere Bestellnummer zu registrieren.",
      );
    } finally {
      setRenewing(false);
    }
  }

  return (
    <EntryForm
      key={instance}
      formToken={formToken}
      utm={utm}
      privacyUrl={privacyUrl}
      landingPath="/verlosung"
      submitLabel="Teilnahme absenden"
      termsHref="/gewinn/teilnahmebedingungen"
      submitHint={
        <>
          Mit dem Absenden registrierst du genau diese Bestellnummer als ein Los. Gewinnerbekanntgabe
          am {ANNOUNCEMENT_DATETIME_LABEL}.
        </>
      }
      renderSuccess={({ referenceNumber }) => (
        <SuccessView
          referenceNumber={referenceNumber}
          shareText={shareText}
          onAnother={startAnother}
          renewing={renewing}
          renewError={renewError}
        />
      )}
    />
  );
}

function SuccessView({
  referenceNumber,
  shareText,
  onAnother,
  renewing,
  renewError,
}: {
  referenceNumber: string;
  shareText: string;
  onAnother: () => void;
  renewing: boolean;
  renewError: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(referenceNumber);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 3000);
    } catch {
      /* Ohne Clipboard-Zugriff bleibt die Referenz sichtbar und markierbar. */
    }
  }

  return (
    <div className="space-y-5">
      <div
        role="status"
        aria-live="polite"
        data-testid="verlosung-erfolg"
        className="relative overflow-hidden rounded-2xl border gw-hairline bg-[var(--vl-surface)] p-6 sm:p-10"
      >
        <Confetti burst className="opacity-90" />
        <div className="relative mx-auto max-w-xl text-center">
          <CheckCircle2
            className="mx-auto h-12 w-12 text-[var(--vl-petrol)]"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="mt-5 text-2xl font-semibold tracking-tight text-[var(--vl-ink)] outline-none sm:text-3xl"
          >
            Danke! Deine Anmeldung ist eingegangen.
          </h3>
          <p className="mt-4 text-[var(--vl-ink-soft)]">
            Wir berücksichtigen deine Teilnahme gemäß den Teilnahmebedingungen. Bewahre deine
            Bestellbestätigung auf.
          </p>

          <div className="mt-8 rounded-xl border border-[var(--vl-border)] bg-[var(--vl-ivory)] px-5 py-4">
            <p className="text-sm text-[var(--vl-ink-mute)]">Deine Teilnahme-Referenz</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
              <p
                data-testid="teilnahme-referenz"
                className="font-mono text-2xl font-semibold tracking-wide text-[var(--vl-petrol)] select-all"
              >
                {referenceNumber}
              </p>
              <button
                type="button"
                onClick={copyReference}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--vl-border)] bg-white px-3 text-sm font-medium text-[var(--vl-ink)] outline-none hover:bg-[var(--vl-petrol-soft)] focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)]"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? "Kopiert" : "Referenz kopieren"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--vl-ink-mute)]">
              Notiere oder speichere dir diese Referenz – eine Bestätigungs-E-Mail versenden wir
              derzeit nicht. Bei Fragen zu deiner Teilnahme nenne uns bitte diese Referenz.
            </p>
          </div>

          <p className="mt-6 text-sm text-[var(--vl-ink-soft)]">
            Noch eine gültige Bestellung mit eigener Bestellnummer? Dann registriere sie separat –
            jede gültige Bestellnummer zählt als ein Los.
          </p>
          <button
            type="button"
            onClick={onAnother}
            disabled={renewing}
            className="mt-3 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-[var(--vl-petrol)] bg-white px-5 text-sm font-semibold text-[var(--vl-petrol)] outline-none hover:bg-[var(--vl-petrol-soft)] focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {renewing ? "Neuer Vorgang wird gestartet …" : "Weitere Bestellnummer registrieren"}
          </button>
          {renewError ? (
            <p role="alert" className="mt-2 text-sm text-[var(--gw-error-ink)]">
              {renewError}
            </p>
          ) : null}
        </div>
      </div>

      <ShareBox
        compact
        shareText={shareText}
        heading="Das könnte auch deinen Freunden gefallen."
        intro="Teile dieses Angebot mit deinen Freunden: Eine Dubai-Reise für zwei und 300 Gutscheine warten auf ihre Gewinner. Einfach den Link kopieren und weiterschicken!"
      />
    </div>
  );
}
