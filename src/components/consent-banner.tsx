"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_COOKIE_MAX_AGE_DAYS,
  CONSENT_DENIED_VALUE,
  CONSENT_OPEN_EVENT,
  consentDecisionFromValue,
  type ConsentDecision,
} from "@/lib/consent";

/**
 * Schlankes First-Party-Consent-Banner der Kampagnenseiten.
 *
 * - Nicht blockierend (Seite bleibt bedienbar), zwei gleichwertige Buttons.
 * - Entscheidung liegt als Cookie vor (Name/Wert kommen vom Server, damit
 *   Browser und Server dieselbe Konfiguration nutzen).
 * - Änderungen werden per CustomEvent signalisiert; GewinnTracking reagiert
 *   ohne Reload (Zustimmung lädt Pixel, Widerruf stoppt weitere Events).
 * - Der Footer-Link „Cookie-Einstellungen“ öffnet das Banner erneut.
 */

export interface ConsentBannerProps {
  cookieName: string;
  acceptedValue: string;
  privacyUrl: string | null;
}

function readCookie(name: string): string | null {
  try {
    for (const part of document.cookie.split(";")) {
      const idx = part.indexOf("=");
      if (idx <= 0) continue;
      if (part.slice(0, idx).trim() !== name) continue;
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  } catch {
    /* Cookie-Zugriff blockiert → wie „unentschieden“ behandeln */
  }
  return null;
}

function writeCookie(name: string, value: string) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${
    CONSENT_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
  }; Path=/; SameSite=Lax${secure}`;
}

export function ConsentBanner({ cookieName, acceptedValue, privacyUrl }: ConsentBannerProps) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<ConsentDecision>("undecided");

  useEffect(() => {
    const current = consentDecisionFromValue(readCookie(cookieName), acceptedValue);
    setDecision(current);
    if (current === "undecided") setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, [cookieName, acceptedValue]);

  // Sticky-CTA der Seite ausblenden, solange das Banner sichtbar ist.
  useEffect(() => {
    if (open) document.documentElement.dataset.consentOpen = "1";
    else delete document.documentElement.dataset.consentOpen;
    return () => {
      delete document.documentElement.dataset.consentOpen;
    };
  }, [open]);

  const decide = useCallback(
    (accepted: boolean) => {
      writeCookie(cookieName, accepted ? acceptedValue : CONSENT_DENIED_VALUE);
      setDecision(accepted ? "accepted" : "denied");
      setOpen(false);
      window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: { accepted } }));
    },
    [cookieName, acceptedValue],
  );

  if (!open) return null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="lze-consent-title"
      data-testid="consent-banner"
      className="lze-consent px-3 pb-3 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--vl-border,rgba(7,62,67,0.16))] bg-white p-3.5 text-[var(--vl-ink,#102d32)] shadow-[0_18px_50px_-20px_rgba(7,62,67,0.45)] sm:p-5">
        <h2 id="lze-consent-title" className="text-sm font-semibold sm:text-base">
          Cookies für Reichweitenmessung
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-[var(--vl-ink-soft,#3b5a5e)] sm:text-sm sm:leading-relaxed">
          Mit deiner Zustimmung nutzen wir Marketing-Cookies und Pixel (Meta, TikTok, LinkedIn,
          Reddit), um die Reichweite dieser Aktion zu messen. Ohne Zustimmung wird nichts davon
          geladen – die Seite bleibt voll nutzbar. Formulardaten gehen nie an diese Anbieter.
          {privacyUrl ? (
            <>
              {" "}
              <a
                href={privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-[var(--vl-petrol,#073e43)]"
              >
                Datenschutzerklärung
              </a>
            </>
          ) : null}
          {decision !== "undecided" ? (
            <>
              {" "}
              Aktuelle Einstellung:{" "}
              <strong className="font-semibold">
                {decision === "accepted" ? "zugestimmt" : "nur notwendige"}
              </strong>
              .
            </>
          ) : null}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <button
            type="button"
            onClick={() => decide(false)}
            className="inline-flex min-h-[46px] items-center justify-center rounded-xl border-2 border-[var(--vl-petrol,#073e43)] bg-white px-3 text-sm font-semibold text-[var(--vl-petrol,#073e43)] outline-none hover:bg-[var(--vl-petrol-soft,rgba(7,62,67,0.08))] focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol,#073e43)] focus-visible:ring-offset-2"
          >
            Nur notwendige
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className="inline-flex min-h-[46px] items-center justify-center rounded-xl border-2 border-[var(--vl-petrol,#073e43)] bg-[var(--vl-petrol,#073e43)] px-3 text-sm font-semibold text-white outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol,#073e43)] focus-visible:ring-offset-2"
          >
            Alle akzeptieren
          </button>
        </div>
      </div>
    </section>
  );
}

/** Footer-Link, der das Consent-Banner erneut öffnet. */
export function ConsentSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
      className={className}
    >
      Cookie-Einstellungen
    </button>
  );
}
