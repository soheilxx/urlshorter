"use client";

import { Check, Copy, MessageCircle, Send, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CARDS_SHARE_TITLE, CARDS_URL } from "@/lib/cards-giveaway-config";
import { trackGewinnEvent } from "@/lib/gewinn-analytics";
import { cn } from "@/lib/utils";

/**
 * Teilen-Baustein des Cards-Gewinnspiels: immer sichtbare, auswählbare
 * kanonische URL, „Link kopieren“ (Bestätigung nur nach echtem Kopiererfolg)
 * und „Mit der Community teilen“ (navigator.share; Fallback: kleines
 * zugängliches Panel mit WhatsApp/Telegram-Links und Kopieren). Geteilt wird
 * IMMER die öffentliche URL /cards – nie Bestätigungs-URLs oder Personendaten.
 * Getrackt werden nur Aktionen (kopiert / Teilen geöffnet / Kanal geöffnet).
 */

export const CARDS_COPY_CONFIRMATION = "Link kopiert – jetzt mit deiner Community teilen!";
const COPY_FALLBACK_HINT =
  "Kopieren war in diesem Browser nicht möglich – der Link ist markiert, kopiere ihn bitte manuell.";

const TRACKING = { giveaway_campaign: "cards_2026", landing_path: "/cards" } as const;

function useShare(shareText: string) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const [canShare, setCanShare] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const urlRef = useRef<HTMLElement>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function selectUrl(): boolean {
    const el = urlRef.current;
    const selection = window.getSelection();
    if (!el || !selection) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(CARDS_URL);
      ok = true;
    } catch {
      try {
        ok = selectUrl() && document.execCommand("copy");
      } catch {
        ok = false;
      }
    }
    if (timer.current) window.clearTimeout(timer.current);
    if (ok) {
      setStatus("copied");
      trackGewinnEvent("cards_link_kopiert", TRACKING);
      timer.current = window.setTimeout(() => setStatus("idle"), 4000);
    } else {
      selectUrl();
      setStatus("manual");
    }
  }

  async function share() {
    trackGewinnEvent("cards_teilen_geoeffnet", TRACKING);
    if (canShare) {
      try {
        await navigator.share({ title: CARDS_SHARE_TITLE, text: shareText, url: CARDS_URL });
      } catch {
        /* Abbruch durch Nutzer oder nicht unterstützt – kein Fehler */
      }
      return;
    }
    setFallbackOpen((open) => !open);
  }

  const encodedText = encodeURIComponent(shareText);
  const whatsapp = `https://wa.me/?text=${encodedText}`;
  const telegram = `https://t.me/share/url?url=${encodeURIComponent(CARDS_URL)}&text=${encodedText}`;

  return { status, canShare, fallbackOpen, urlRef, copy, share, whatsapp, telegram };
}

export function CardsShareBox({
  shareText,
  heading = "Deine Community sollte das sehen.",
  intro,
  className,
  compact = false,
}: {
  shareText: string;
  heading?: string;
  intro?: string;
  className?: string;
  compact?: boolean;
}) {
  const s = useShare(shareText);
  return (
    <div className={cn("cd-holo rounded-2xl bg-[var(--cd-surface)] p-5 sm:p-7", className)}>
      <h3
        className={cn(
          "cd-display font-semibold text-[var(--cd-ink)]",
          compact ? "text-xl" : "text-2xl sm:text-3xl",
        )}
      >
        {heading}
      </h3>
      {intro ? <p className="mt-2 text-[var(--cd-ink-soft)]">{intro}</p> : null}
      <p className="mt-5 rounded-xl border border-[var(--cd-border)] bg-[var(--cd-bg)] px-4 py-3">
        <span className="sr-only">Link zur Aktion: </span>
        <code
          ref={s.urlRef}
          data-testid="share-url"
          className="font-mono text-sm break-all text-[var(--cd-gold)] select-all sm:text-base"
        >
          {CARDS_URL}
        </code>
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={s.copy}
          data-testid="share-copy"
          className="cd-btn-gold inline-flex min-h-[48px] items-center justify-center gap-2 px-5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--cd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cd-surface)]"
        >
          {s.status === "copied" ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          Link kopieren
        </button>
        <button
          type="button"
          onClick={s.share}
          data-testid="share-open"
          aria-expanded={s.canShare ? undefined : s.fallbackOpen}
          aria-controls={s.canShare ? undefined : "cards-share-fallback"}
          className="cd-btn-outline inline-flex min-h-[48px] items-center justify-center gap-2 px-5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--cd-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cd-surface)]"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Mit der Community teilen
        </button>
      </div>
      {!s.canShare && s.fallbackOpen ? (
        <div
          id="cards-share-fallback"
          className="mt-3 flex flex-wrap gap-2 rounded-xl border border-[var(--cd-border-soft)] bg-[var(--cd-bg)] p-3"
        >
          <a
            href={s.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackGewinnEvent("cards_teilen_whatsapp", TRACKING)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--cd-border-soft)] px-4 text-sm font-medium text-[var(--cd-ink)] hover:bg-[var(--cd-surface-2)]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Per WhatsApp teilen
          </a>
          <a
            href={s.telegram}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackGewinnEvent("cards_teilen_telegram", TRACKING)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--cd-border-soft)] px-4 text-sm font-medium text-[var(--cd-ink)] hover:bg-[var(--cd-surface-2)]"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Per Telegram teilen
          </a>
          <p className="basis-full text-xs text-[var(--cd-ink-mute)]">
            Es wird nichts automatisch versendet – du bestimmst, wem du den Link schickst.
          </p>
        </div>
      ) : null}
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "mt-2 min-h-[1.25rem] text-sm font-medium",
          s.status === "manual" ? "text-[var(--gw-error-ink)]" : "text-[var(--cd-cyan)]",
        )}
      >
        {s.status === "copied"
          ? CARDS_COPY_CONFIRMATION
          : s.status === "manual"
            ? COPY_FALLBACK_HINT
            : ""}
      </p>
    </div>
  );
}

/** Kompakter Teilen-Einstieg für Header/Hero (springt zur Teilen-Sektion, wenn kein natives Teilen). */
export function CardsShareButton({
  shareText,
  className,
}: {
  shareText: string;
  className?: string;
}) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  async function share() {
    trackGewinnEvent("cards_teilen_geoeffnet", { ...TRACKING, cta_position: "header" });
    try {
      await navigator.share({ title: CARDS_SHARE_TITLE, text: shareText, url: CARDS_URL });
    } catch {
      /* Abbruch – kein Fehler */
    }
  }
  if (canShare) {
    return (
      <button type="button" onClick={share} className={className} aria-label="Aktion teilen">
        <Share2 className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Teilen</span>
      </button>
    );
  }
  return (
    <a href="#teilen" className={className} aria-label="Zur Teilen-Sektion">
      <Share2 className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Teilen</span>
    </a>
  );
}
