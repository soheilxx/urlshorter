"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Copy, Share2, Star } from "lucide-react";
import { BUCH_PREIS_LABEL } from "@/lib/buch-config";
import { AMAZON_PRODUCT_URL } from "@/lib/gewinnspiel-config";
import { INBOX_BOOK_URL, type InboxPortal } from "@/lib/inbox-book-config";
import styles from "./inbox-book.module.css";

const SAVE_KEY = "lze_inbox_book_saved";

export function InboxTools({ portal }: { portal: InboxPortal }) {
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [manualShare, setManualShare] = useState(false);
  const shareUrl = portal === "neutral" ? INBOX_BOOK_URL : `${INBOX_BOOK_URL}?portal=${portal}`;

  useEffect(() => {
    try {
      setSaved(localStorage.getItem(SAVE_KEY) === "1");
    } catch {
      /* Browser-Speicher optional. */
    }
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === SAVE_KEY || event.key === null) setSaved(event.newValue === "1");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggleSaved() {
    const next = !saved;
    setSaved(next);
    try {
      localStorage.setItem(SAVE_KEY, next ? "1" : "0");
      setMessage(next ? "In diesem Browser für später gemerkt." : "Aus deiner Merkliste entfernt.");
    } catch {
      setMessage(next ? "Für diesen Besuch gemerkt." : "Markierung entfernt.");
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Mit 20 stand ich Microsoft gegenüber. – Die Lizenz zum Erfolg",
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Link kopiert. Du kannst ihn jetzt weiterempfehlen.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setManualShare(true);
      setMessage("Hier kannst du den Link markieren und kopieren.");
    }
  }

  return (
    <div className={styles.tools}>
      <div className={styles.toolButtons}>
        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={saved}
          aria-label={saved ? "Buch nicht mehr merken" : "Buch für später merken"}
          disabled={!ready}
        >
          <Star size={18} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
          <span>{saved ? "Gemerkt" : "Merken"}</span>
        </button>
        <button type="button" onClick={() => void share()} aria-label="Buch weiterempfehlen">
          <Share2 size={18} aria-hidden="true" />
          <span>Teilen</span>
        </button>
      </div>
      {message && (
        <p className={styles.toolStatus} role="status">
          <Check size={14} aria-hidden="true" />
          {message}
        </p>
      )}
      {manualShare && (
        <label className={styles.shareFallback}>
          <Copy size={15} aria-hidden="true" />
          Link zum Buch
          <input readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
        </label>
      )}
    </div>
  );
}

export function InboxStickyCta() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const first = document.getElementById("inbox-first-cta");
    const footer = document.getElementById("inbox-footer");
    if (!first || !footer) return;
    const update = () =>
      setVisible(
        first.getBoundingClientRect().bottom < 68 &&
          footer.getBoundingClientRect().top > innerHeight &&
          (window.visualViewport?.height ?? innerHeight) > 450,
      );
    const observer = new IntersectionObserver(update, {
      threshold: [0, 1],
      rootMargin: "-68px 0px 0px 0px",
    });
    observer.observe(first);
    observer.observe(footer);
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return (
    <div className={styles.stickyCta} data-visible={visible} aria-hidden={!visible}>
      <div>
        <strong>{BUCH_PREIS_LABEL}</strong>
        <span>Taschenbuch</span>
      </div>
      <a
        className={styles.primaryButton}
        href={AMAZON_PRODUCT_URL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        data-gw-event="buch_amazon_klick"
        data-cta-id="inbox-mobile-sticky"
      >
        Bei Amazon bestellen
        <ArrowUpRight size={17} aria-hidden="true" />
      </a>
    </div>
  );
}
