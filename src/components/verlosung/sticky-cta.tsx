"use client";

import { useEffect, useState } from "react";

/**
 * Mobiler Sticky-Balken: knapper Kauf-CTA + klarer Weg zum Formular.
 * Erscheint erst, wenn der Hero aus dem Bild gescrollt ist; verschwindet,
 * solange ein Formularfeld fokussiert ist, und nie gleichzeitig mit dem
 * Consent-Banner (beides über html[data-*] in globals.css).
 */
export function StickyCta({
  primary,
  secondary,
  heroId,
  formId,
}: {
  primary: { label: string; href: string; event: string };
  secondary: { label: string; href: string; event: string };
  heroId: string;
  formId: string;
}) {
  const [visible, setVisible] = useState(false);

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

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const onFocusIn = () => {
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

  if (!visible) return null;

  return (
    <div className="vl-sticky px-3 pb-3" data-testid="sticky-cta">
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2 rounded-2xl border border-[var(--vl-border)] bg-white/95 p-2 shadow-[0_14px_40px_-16px_rgba(7,62,67,0.6)] backdrop-blur">
        <a
          href={primary.href}
          data-gw-event={primary.event}
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--vl-yellow)] px-3 text-center text-sm font-semibold leading-tight text-[var(--vl-ink)] outline-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)] focus-visible:ring-offset-2"
        >
          {primary.label}
        </a>
        <a
          href={secondary.href}
          data-gw-event={secondary.event}
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl border-2 border-[var(--vl-petrol)] px-3 text-center text-sm font-semibold leading-tight text-[var(--vl-petrol)] outline-none hover:bg-[var(--vl-petrol-soft)] focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)] focus-visible:ring-offset-2"
        >
          {secondary.label}
        </a>
      </div>
    </div>
  );
}
