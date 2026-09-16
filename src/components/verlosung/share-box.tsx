"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { trackGewinnEvent } from "@/lib/gewinn-analytics";
import { VERLOSUNG_URL } from "@/lib/gewinnspiel-config";
import { cn } from "@/lib/utils";

/**
 * Teilen-Box: sichtbare, kopierbare Aktions-URL (umbricht auf schmalen
 * Displays, wird nie abgeschnitten) + „Link kopieren“ und – wo verfügbar –
 * die native Teilen-Funktion. Kopiert wird immer die kanonische URL, nie
 * window.location (keine UTM-/Klick-Parameter, keine Referenzen).
 * Getrackt werden nur die Aktionen „Link kopiert“/„Teilen geöffnet“.
 */

export const COPY_CONFIRMATION = "Link kopiert – jetzt mit Freunden teilen!";
const COPY_FALLBACK_HINT =
  "Kopieren war in diesem Browser nicht möglich – der Link ist markiert, kopiere ihn bitte manuell.";

export function ShareBox({
  shareText,
  heading = "Teile diese Aktion",
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
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const [canShare, setCanShare] = useState(false);
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
      await navigator.clipboard.writeText(VERLOSUNG_URL);
      ok = true;
    } catch {
      // Fallback ohne Clipboard-API: Text markieren und kopieren lassen
      try {
        ok = selectUrl() && document.execCommand("copy");
      } catch {
        ok = false;
      }
    }
    if (timer.current) window.clearTimeout(timer.current);
    if (ok) {
      setStatus("copied");
      trackGewinnEvent("verlosung_link_kopiert");
      timer.current = window.setTimeout(() => setStatus("idle"), 4000);
    } else {
      selectUrl();
      setStatus("manual");
    }
  }

  async function share() {
    try {
      trackGewinnEvent("verlosung_teilen_geoeffnet");
      await navigator.share({ title: "Die Lizenz zum Erfolg", text: shareText, url: VERLOSUNG_URL });
    } catch {
      /* Abbruch durch Nutzer oder nicht unterstützt – kein Fehler */
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border gw-hairline bg-[var(--vl-surface)] p-5 sm:p-6",
        className,
      )}
    >
      <h3 className={cn("font-semibold tracking-tight text-[var(--vl-ink)]", compact ? "text-lg" : "text-xl")}>
        {heading}
      </h3>
      {intro ? <p className="mt-1.5 text-sm text-[var(--vl-ink-soft)]">{intro}</p> : null}
      <p className="mt-4 rounded-xl border border-[var(--vl-border)] bg-[var(--vl-ivory)] px-4 py-3">
        <span className="sr-only">Link zur Aktion: </span>
        <code
          ref={urlRef}
          data-testid="share-url"
          className="font-mono text-sm break-all text-[var(--vl-ink)] select-all"
        >
          {VERLOSUNG_URL}
        </code>
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={copy}
          data-testid="share-copy"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[var(--vl-petrol)] px-5 text-sm font-semibold text-white outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)] focus-visible:ring-offset-2"
        >
          {status === "copied" ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          Link kopieren
        </button>
        {canShare ? (
          <button
            type="button"
            onClick={share}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-[var(--vl-petrol)] bg-white px-5 text-sm font-semibold text-[var(--vl-petrol)] outline-none hover:bg-[var(--vl-petrol-soft)] focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)] focus-visible:ring-offset-2"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Mit Freunden teilen
          </button>
        ) : null}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "mt-2 min-h-[1.25rem] text-sm font-medium",
          status === "manual" ? "text-[var(--gw-error-ink)]" : "text-[var(--vl-petrol)]",
        )}
      >
        {status === "copied" ? COPY_CONFIRMATION : status === "manual" ? COPY_FALLBACK_HINT : ""}
      </p>
    </div>
  );
}
