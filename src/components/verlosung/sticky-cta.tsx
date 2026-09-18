"use client";

import { useEffect, useState } from "react";

/**
 * Mobiler Sticky-Balken: direkter Amazon-Bestell-CTA + Sofortweg zum Formular (Dialog).
 * Erscheint erst, wenn der Hero aus dem Bild gescrollt ist; verschwindet,
 * solange ein Formularfeld fokussiert ist, und nie gleichzeitig mit dem
 * Consent-Banner (beides über html[data-*] in globals.css).
 */
const VARIANTS = {
  verlosung: {
    bar: "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2 rounded-2xl border border-[var(--vl-border)] bg-white/95 p-2 shadow-[0_14px_40px_-16px_rgba(7,62,67,0.6)] backdrop-blur",
    primary:
      "inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--vl-yellow)] px-3 text-center text-sm font-semibold leading-tight text-[var(--vl-ink)] outline-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)] focus-visible:ring-offset-2",
    secondary:
      "inline-flex min-h-[48px] items-center justify-center rounded-xl border-2 border-[var(--vl-petrol)] px-3 text-center text-sm font-semibold leading-tight text-[var(--vl-petrol)] outline-none hover:bg-[var(--vl-petrol-soft)] focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)] focus-visible:ring-offset-2",
  },
  cards: {
    bar: "grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-2 rounded-2xl border border-[var(--cd-border)] bg-[rgba(18,26,44,0.96)] p-2 shadow-[0_14px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur",
    primary:
      "cd-btn-gold inline-flex min-h-[48px] items-center justify-center px-3 text-center text-sm font-semibold leading-tight outline-none focus-visible:ring-2 focus-visible:ring-[var(--cd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cd-surface)]",
    secondary:
      "inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--cd-cyan)]/70 px-3 text-center text-sm font-semibold leading-tight text-[var(--cd-ink)] outline-none hover:bg-[rgba(81,217,237,0.12)] focus-visible:ring-2 focus-visible:ring-[var(--cd-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cd-surface)]",
  },
} as const;

export function StickyCta({
  primary,
  secondary,
  heroId,
  formId,
  variant = "verlosung",
}: {
  /** external: öffnet in neuem Tab (z. B. direkter Amazon-Link). */
  primary: { label: string; href: string; event: string; external?: boolean; ctaId?: string };
  secondary: { label: string; href: string; event: string };
  heroId: string;
  formId: string;
  /** Kampagnen-Theme des Balkens. */
  variant?: keyof typeof VARIANTS;
}) {
  const styles = VARIANTS[variant];
  const [visible, setVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    if (!hero || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry ? !entry.isIntersecting : false),
      { threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroId]);

  // Solange das Formular selbst den Bildschirm dominiert (≥ 40 % der Viewport-Höhe),
  // braucht es keinen Balken darüber. Das <form> wird bei jeder Messung neu aufgelöst, weil
  // EntryForm es nach Erfolg/„weitere Bestellnummer“ neu mountet; während des
  // modalen Dialogs blendet CSS (html[data-dialog-open]) aus.
  useEffect(() => {
    const section = document.getElementById(formId);
    if (!section) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      // Im modalen Dialog liegt das Formular im Top-Layer – das zählt nicht als „im Bild“.
      if (document.documentElement.dataset.dialogOpen === "1") return setFormVisible(false);
      const form = section.querySelector("form");
      if (!form) return setFormVisible(false);
      const rect = form.getBoundingClientRect();
      const visible = Math.max(
        0,
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
      );
      setFormVisible(rect.height > 0 && visible / window.innerHeight >= 0.4);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Nach dem Schließen des Dialogs (Attributwechsel am <html>) neu messen.
    const attributes = new MutationObserver(schedule);
    attributes.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-dialog-open"],
    });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      attributes.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [formId]);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const onFocusIn = () => {
      // Fokus im modalen Dialog zählt nicht als Inline-Formularfokus – sonst bliebe der
      // Balken nach dem Schließen dauerhaft ausgeblendet (Fokus-Rückgabe an den Balken).
      if (document.documentElement.dataset.dialogOpen === "1") return;
      document.documentElement.dataset.formFocus = "1";
    };
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (!next || !form.contains(next)) delete document.documentElement.dataset.formFocus;
    };
    form.addEventListener("focusin", onFocusIn);
    form.addEventListener("focusout", onFocusOut);
    return () => {
      form.removeEventListener("focusin", onFocusIn);
      form.removeEventListener("focusout", onFocusOut);
      delete document.documentElement.dataset.formFocus;
    };
  }, [formId]);

  if (!visible || formVisible) return null;

  return (
    <div className="vl-sticky px-3 pb-3" data-testid="sticky-cta">
      <div className={styles.bar}>
        <a
          href={primary.href}
          data-gw-event={primary.event}
          data-cta-id={primary.ctaId}
          {...(primary.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className={styles.primary}
        >
          {primary.label}
          {primary.external ? <span className="sr-only">(öffnet in neuem Tab)</span> : null}
        </a>
        <a href={secondary.href} data-gw-event={secondary.event} className={styles.secondary}>
          {secondary.label}
        </a>
      </div>
    </div>
  );
}
