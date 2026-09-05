"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { RedditTracking } from "@/components/reddit-tracking";
import type { RedditTrackingConfig } from "@/lib/reddit-events";
import styles from "./reddit-book.module.css";

export function BookConsent({
  config,
  cookieName,
  acceptedValue,
  privacyUrl,
}: {
  config: RedditTrackingConfig | null;
  cookieName: string;
  acceptedValue: string;
  privacyUrl: string;
}) {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const pageVisitSent = useRef(false);
  useEffect(() => {
    const sync = () => {
      let value: string | undefined;
      try {
        value = document.cookie
          .split(";")
          .map((x) => x.trim())
          .find((x) => x.startsWith(`${cookieName}=`))
          ?.slice(cookieName.length + 1);
        value = value === undefined ? undefined : decodeURIComponent(value);
      } catch {
        value = undefined;
      }
      setAllowed(value === acceptedValue);
      setOpen(value === undefined);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, [cookieName, acceptedValue]);
  function choose(accept: boolean) {
    const value = accept ? acceptedValue : "declined";
    document.cookie = `${cookieName}=${encodeURIComponent(value)}; Path=/; Max-Age=15552000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setAllowed(accept);
    setOpen(false);
    try {
      localStorage.setItem("reddit-book-consent-change", `${Date.now()}`);
    } catch {
      /* Cookie bleibt maßgeblich. */
    }
  }
  return (
    <>
      {allowed && config && <RedditTracking config={config} visitState={pageVisitSent} />}
      <button className={styles.textButton} type="button" onClick={() => setOpen(true)}>
        Cookie-Einstellungen
      </button>
      {open && (
        <section
          className={styles.consentPanel}
          data-consent-open="true"
          aria-label="Datenschutzeinstellungen"
        >
          <div className={styles.consentHeading}>
            <ShieldCheck size={20} aria-hidden="true" />
            <strong>Du entscheidest über deine Daten.</strong>
            {allowed && (
              <button
                type="button"
                aria-label="Einstellungen schließen"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            )}
          </div>
          <p>
            Mit deiner Zustimmung messen wir über Reddit, ob unsere Anzeigen zu Seitenbesuchen und
            Amazon-Klicks führen. Lesen, Abstimmen und Bestellen funktionieren auch ohne diese
            Messung.{" "}
            <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
              Datenschutz
            </a>
          </p>
          <div className={styles.consentChoices}>
            <button type="button" onClick={() => choose(false)}>
              Ohne Werbe-Tracking
            </button>
            <button type="button" onClick={() => choose(true)}>
              Tracking erlauben
            </button>
          </div>
        </section>
      )}
    </>
  );
}
