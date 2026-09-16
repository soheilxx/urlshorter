"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { CONSENT_CHANGE_EVENT } from "@/lib/consent";
import { trackGewinnEvent } from "@/lib/gewinn-analytics";

/**
 * Teilnahme ohne Seitensprung: Das Formular liegt inline in der Sektion
 * #teilnehmen (sichtbar beim Scrollen, Fallback ohne JavaScript). Jeder Link
 * auf „#teilnehmen“ – Header, Hero, Gutschein-, Buch-, Abschluss-Sektion,
 * Sticky-Balken – öffnet dasselbe Formular stattdessen sofort als modalen
 * Dialog an Ort und Stelle.
 *
 * Es gibt genau EINE dauerhaft gemountete Formularinstanz: Das <dialog>
 * bleibt immer im Baum und wird nur zwischen „inline“ (open, nicht modal;
 * Optik per CSS dialog[data-inline] neutralisiert) und „modal“ (showModal)
 * umgeschaltet. Eingaben und Erfolgsansicht bleiben dadurch erhalten.
 * Deep-Link „/verlosung#teilnehmen“ (Newsletter) öffnet den Dialog beim Laden
 * (erst nach einer Consent-Entscheidung, falls das Banner noch offen ist).
 * Links mit data-no-dialog (Skip-Link) werden nicht abgefangen.
 */

/**
 * Der Wechsel in den Top-Layer stößt im Browser sonst einen Scroll zum
 * Seitenanfang an (mit html { scroll-behavior: smooth } als Animation).
 * Position merken, Animation kurz abschalten, nach dem Wechsel wiederherstellen.
 */
function holdScrollPosition() {
  const root = document.documentElement;
  const x = window.scrollX;
  const y = window.scrollY;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  const restore = () => window.scrollTo(x, y);
  return () => {
    restore();
    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(() => {
        restore();
        root.style.scrollBehavior = previous;
      });
    });
  };
}

export function ParticipationHost({
  form,
  enabled,
  dialogTitle,
  inlineLabelId,
}: {
  /** Das Formular (bzw. der Hinweis bei geschlossener Phase). */
  form: ReactNode;
  /** false = Phase geschlossen: Links springen normal zum Inline-Bereich. */
  enabled: boolean;
  dialogTitle: string;
  /** ID der Sektionsüberschrift – benennt den Dialog auch im Inline-Modus. */
  inlineLabelId: string;
}) {
  const [modal, setModal] = useState(false);
  const [spacer, setSpacer] = useState(0);
  const modalRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const pointerOnBackdropRef = useRef(false);

  /** true = Dialog ist jetzt modal; false = nicht möglich, Aufrufer lässt den Anker springen. */
  const openModal = useCallback((opener: HTMLElement | null): boolean => {
    const dialog = dialogRef.current;
    if (!dialog || typeof dialog.showModal !== "function") return false;
    if (modalRef.current) return true;
    openerRef.current = opener;
    const restoreScroll = holdScrollPosition();
    // Modal-Darstellung synchron herstellen (fixed im Top-Layer, Platzhalter gegen
    // Layout-Sprung, Scroll-Sperre), BEVOR showModal() seine Fokussierung ausführt.
    document.documentElement.dataset.dialogOpen = "1";
    flushSync(() => {
      setSpacer(dialog.offsetHeight);
      setModal(true);
    });
    try {
      // Attribut entfernen statt close(): so feuert kein (asynchrones) close-Event.
      dialog.removeAttribute("open");
      dialog.showModal();
    } catch {
      flushSync(() => {
        setSpacer(0);
        setModal(false);
      });
      delete document.documentElement.dataset.dialogOpen;
      if (!dialog.open) dialog.setAttribute("open", "");
      restoreScroll();
      return false;
    }
    modalRef.current = true;
    trackGewinnEvent("verlosung_formular_geoeffnet");
    dialog.querySelector<HTMLElement>("#retailer")?.focus({ preventScroll: true });
    restoreScroll();
    return true;
  }, []);

  const closeModal = useCallback(() => {
    const dialog = dialogRef.current;
    if (modalRef.current && dialog?.open) dialog.close();
  }, []);

  // Inline-Modus: Dialog offen, aber nicht modal (auch beim ersten Rendern).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.setAttribute("open", "");
    if (modalRef.current) document.documentElement.dataset.dialogOpen = "1";
    return () => {
      if (!modalRef.current) delete document.documentElement.dataset.dialogOpen;
    };
  }, []);

  // Jeder Link auf #teilnehmen öffnet den Dialog (nur mit offener Phase).
  useEffect(() => {
    if (!enabled) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>('a[href$="#teilnehmen"]');
      if (!link || link.hasAttribute("data-no-dialog") || dialogRef.current?.contains(link)) return;
      if (link.origin !== location.origin || link.pathname !== location.pathname) return;
      if (openModal(link)) event.preventDefault();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [enabled, openModal]);

  // Deep-Link aus Newsletter/Mail: /verlosung#teilnehmen – nur beim Laden, nicht bei
  // späteren Hash-Sprüngen (Skip-Link). Bei offenem Consent-Banner erst nach der Entscheidung.
  useEffect(() => {
    if (!enabled || location.hash !== "#teilnehmen") return;
    if (document.documentElement.dataset.consentOpen !== "1") {
      openModal(null);
      return;
    }
    const afterConsent = () => {
      if (location.hash === "#teilnehmen") openModal(null);
    };
    window.addEventListener(CONSENT_CHANGE_EVENT, afterConsent, { once: true });
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, afterConsent);
  }, [enabled, openModal]);

  // Schließen (Escape, X, Backdrop): zurück in den Inline-Modus – ohne Remount.
  function onClose() {
    const dialog = dialogRef.current;
    const restoreScroll = holdScrollPosition();
    modalRef.current = false;
    if (dialog && !dialog.open) dialog.setAttribute("open", "");
    setModal(false);
    setSpacer(0);
    delete document.documentElement.dataset.dialogOpen;
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener && document.contains(opener)) {
      opener.focus({ preventScroll: true });
    } else if (dialog?.contains(document.activeElement)) {
      // Kein Auslöser (Deep-Link): Fokus nicht im jetzt außerhalb des Bildes liegenden Formular lassen.
      (document.activeElement as HTMLElement).blur();
    }
    restoreScroll();
  }

  function onPointerDown(event: React.PointerEvent<HTMLDialogElement>) {
    pointerOnBackdropRef.current = event.target === dialogRef.current;
  }

  function onClick(event: React.MouseEvent<HTMLDialogElement>) {
    // Nur ein vollständiger Klick auf den Backdrop schließt (keine Drag-Selektion aus einem Feld).
    if (modal && pointerOnBackdropRef.current && event.target === dialogRef.current) closeModal();
    pointerOnBackdropRef.current = false;
  }

  return (
    <div style={spacer ? { minHeight: spacer } : undefined}>
      <dialog
        ref={dialogRef}
        open
        onClose={onClose}
        onPointerDown={onPointerDown}
        onClick={onClick}
        aria-labelledby={modal ? "teilnahme-dialog-heading" : inlineLabelId}
        data-testid="teilnahme-dialog"
        data-inline={modal ? undefined : ""}
        className={
          modal
            ? "verlosung-theme m-0 h-dvh max-h-dvh w-full max-w-none bg-[var(--vl-ivory)] p-0 text-[var(--vl-ink)] shadow-2xl backdrop:bg-[rgba(5,45,49,0.65)] backdrop:backdrop-blur-sm sm:m-auto sm:h-auto sm:max-h-[92dvh] sm:w-[min(100vw-2rem,44rem)] sm:rounded-3xl"
            : ""
        }
      >
        <div className={modal ? "flex h-full max-h-dvh flex-col sm:h-auto sm:max-h-[92dvh]" : ""}>
          {modal ? (
            <div className="flex items-center justify-between gap-4 border-b border-[var(--vl-border-soft)] bg-[var(--vl-ivory)] px-5 py-4 sm:px-8">
              <h2
                id="teilnahme-dialog-heading"
                className="text-lg font-semibold tracking-tight text-[var(--vl-petrol)] sm:text-xl"
              >
                {dialogTitle}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Formular schließen"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--vl-ink-soft)] outline-none hover:bg-[var(--vl-petrol-soft)] hover:text-[var(--vl-petrol)] focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <div
            className={
              modal
                ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-7"
                : ""
            }
          >
            {form}
          </div>
        </div>
      </dialog>
    </div>
  );
}
