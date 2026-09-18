"use client";

import { Check, CheckCircle2, Copy, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CardsConfetti } from "@/components/cards/cards-confetti";
import { CardsShareBox } from "@/components/cards/cards-share";
import {
  CARDS_ANNOUNCEMENT_DATETIME_LABEL,
  CARDS_CAMPAIGN_ID,
  CARDS_ENTRY_PATH,
} from "@/lib/cards-giveaway-config";
import { trackGewinnEvent, trackRegistrationCompleted } from "@/lib/gewinn-analytics";

/**
 * Bestätigungsansicht /cards/danke (Client-Teil).
 *
 * Einmalige Feier je Vorgang: Konfetti und das Browser-Registrierungsevent
 * werden nur ausgelöst, wenn das Receipt eine tatsächlich gespeicherte
 * Teilnahme belegt (Ereignis-ID vorhanden) UND die undurchsichtige
 * Vorgangskennung (nonce) noch nicht als gefeiert markiert ist. Die Markierung
 * liegt im localStorage (tab-übergreifend) und enthält nur die Nonce – keine
 * Referenz, keine Personendaten. Reload, zweiter Tab, Direktaufruf ohne Receipt
 * oder Honeypot-Scheinerfolg feiern nicht.
 */

const CELEBRATED_KEY = "lze_cards_celebrated";
const memoryCelebrated = new Set<string>();

function claimCelebration(nonce: string): boolean {
  try {
    const raw = window.localStorage.getItem(CELEBRATED_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (list.includes(nonce)) return false;
    list.push(nonce);
    window.localStorage.setItem(CELEBRATED_KEY, JSON.stringify(list.slice(-30)));
    return true;
  } catch {
    if (memoryCelebrated.has(nonce)) return false;
    memoryCelebrated.add(nonce);
    return true;
  }
}

/** Wartet kurz auf die Pixel-/GA4-Initialisierung, feuert spätestens nach 4 s. */
function whenTrackingReady(fire: () => void) {
  const w = window as Window & { gtag?: unknown; fbq?: unknown };
  const started = Date.now();
  const check = () => {
    if ((w.gtag && w.fbq) || Date.now() - started > 4000) {
      fire();
      return;
    }
    window.setTimeout(check, 100);
  };
  check();
}

export function CardsDanke({
  referenceNumber,
  trackingEventId,
  nonce,
  persisted,
  shareText,
}: {
  referenceNumber: string;
  trackingEventId: string | null;
  nonce: string;
  persisted: boolean;
  shareText: string;
}) {
  const [celebrate, setCelebrate] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [copied, setCopied] = useState(false);
  const claimed = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (claimed.current) return;
    claimed.current = true;
    if (!persisted || !trackingEventId) return;
    if (!claimCelebration(nonce)) return;
    setCelebrate(true);
    whenTrackingReady(() =>
      trackRegistrationCompleted(trackingEventId, {
        giveaway_campaign: CARDS_CAMPAIGN_ID,
        landing_path: CARDS_ENTRY_PATH,
      }),
    );
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [persisted, trackingEventId, nonce]);

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
    <div className="space-y-6">
      {celebrate && !reducedMotion ? <CardsConfetti /> : null}
      <section
        role="status"
        aria-live="polite"
        data-testid="cards-erfolg"
        data-celebrated={celebrate ? "1" : "0"}
        className="cd-holo relative overflow-hidden rounded-3xl bg-[var(--cd-surface)] p-6 sm:p-10"
      >
        <div className="relative mx-auto max-w-xl text-center">
          <span className="cd-success-ring mx-auto flex h-20 w-20 items-center justify-center rounded-full p-[3px]">
            <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--cd-surface)]">
              <CheckCircle2
                className="h-10 w-10 text-[var(--cd-gold)]"
                aria-hidden="true"
                strokeWidth={1.6}
              />
            </span>
          </span>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="cd-display mt-6 text-3xl font-semibold text-[var(--cd-ink)] outline-none sm:text-4xl"
          >
            Deine Anmeldung ist eingegangen!
          </h1>
          <p className="mt-4 text-[var(--cd-ink-soft)]">
            Danke, dass du beim Cards-Gewinnspiel dabei bist. Wir haben deine Registrierung
            gespeichert. Deine Teilnahme wird gemäß den Teilnahmebedingungen berücksichtigt. Bewahre
            deine Bestellbestätigung auf.
          </p>
          <p className="mt-3 text-[var(--cd-ink-soft)]">
            Die Gewinnerbekanntgabe findet am{" "}
            <strong className="font-semibold text-[var(--cd-ink)]">
              {CARDS_ANNOUNCEMENT_DATETIME_LABEL}
            </strong>{" "}
            statt.
          </p>
          <p className="mt-3 inline-flex rounded-full border border-[var(--cd-border-soft)] px-3 py-1 text-xs font-medium text-[var(--cd-ink-mute)]">
            Registrierung eingegangen – Prüfung ausstehend
          </p>

          <div className="mt-8 rounded-2xl border border-[var(--cd-border)] bg-[var(--cd-bg)] px-5 py-4">
            <p className="text-sm text-[var(--cd-ink-mute)]">Deine Teilnahme-Referenz</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
              <p
                data-testid="teilnahme-referenz"
                className="font-mono text-2xl font-semibold tracking-wide text-[var(--cd-gold)] select-all"
              >
                {referenceNumber}
              </p>
              <button
                type="button"
                onClick={copyReference}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--cd-border-soft)] px-3 text-sm font-medium text-[var(--cd-ink)] outline-none hover:bg-[var(--cd-surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--cd-gold)]"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? "Kopiert" : "Referenz kopieren"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--cd-ink-mute)]">
              Notiere oder speichere dir diese Referenz – eine Bestätigungs-E-Mail versenden wir
              derzeit nicht. Bei Fragen zu deiner Teilnahme nenne uns bitte diese Referenz.
            </p>
          </div>

          <p className="mt-6 text-sm text-[var(--cd-ink-soft)]">
            Noch eine gültige Bestellung mit eigener Bestellnummer? Jede weitere gültige
            Bestellnummer gibt dir im Cards-Gewinnspiel ein zusätzliches Los.
          </p>
          <Link
            href={`${CARDS_ENTRY_PATH}#teilnehmen`}
            onClick={() =>
              trackGewinnEvent("cards_weitere_bestellnummer", {
                giveaway_campaign: CARDS_CAMPAIGN_ID,
                landing_path: CARDS_ENTRY_PATH,
              })
            }
            className="cd-btn-outline mt-3 inline-flex min-h-[48px] items-center justify-center gap-2 px-5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--cd-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cd-surface)]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Weitere Bestellnummer eintragen
          </Link>
        </div>
      </section>

      <CardsShareBox
        compact
        shareText={shareText}
        heading="Deine Community sollte das sehen."
        intro="One Piece, Dragon Ball, Yu-Gi-Oh! und Cardmarket: Teile die Verlosung mit deinen Freunden, deiner TCG-Gruppe oder deiner Community."
      />
    </div>
  );
}
