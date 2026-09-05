"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Share2 } from "lucide-react";
import { REDDIT_BOOK_URL } from "@/lib/reddit-book-config";
import { AMAZON_PRODUCT_URL } from "@/lib/gewinnspiel-config";
import { BUCH_PREIS_LABEL } from "@/lib/buch-config";
import styles from "./reddit-book.module.css";
import { useVisibleActivity } from "./use-visible-activity";

type Activity = { score: number; readers: number; vote: number };
export function PostActions({ initial }: { initial: Activity }) {
  const [activity, setActivity] = useState(initial);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [manualShare, setManualShare] = useState(false);
  const saving = useRef(false);
  const voteElement = useRef<HTMLDivElement>(null);
  const live = useVisibleActivity(voteElement, saving, initial.readers);
  const displayedScore = activity.score + live.boost;
  const generation = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function refresh() {
      if (document.visibilityState !== "visible" || saving.current) return;
      const version = generation.current;
      try {
        const response = await fetch("/api/reddit/book-vote", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("unavailable");
        const next = (await response.json()) as Activity;
        if (
          alive &&
          version === generation.current &&
          !saving.current &&
          Number.isInteger(next.score) &&
          [-1, 0, 1].includes(next.vote)
        ) {
          setActivity(next);
          setReady(true);
          setMessage((current) => (current.startsWith("Abstimmung gerade") ? "" : current));
        }
      } catch {
        if (alive && !saving.current)
          setMessage("Abstimmung gerade nicht erreichbar. Wir versuchen es erneut.");
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 27_000);
    document.addEventListener("visibilitychange", refresh);
    try {
      channel.current = new BroadcastChannel("reddit-book-votes");
      channel.current.onmessage = () => void refresh();
    } catch {
      /* Polling-Fallback. */
    }
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      channel.current?.close();
    };
  }, []);

  async function vote(direction: number) {
    if (saving.current || !ready) return;
    saving.current = true;
    generation.current++;
    setBusy(true);
    setMessage("");
    const previous = activity;
    const nextVote = activity.vote === direction ? 0 : direction;
    setActivity({
      ...activity,
      vote: nextVote,
      score: Math.max(0, activity.score + nextVote - activity.vote),
    });
    try {
      const response = await fetch("/api/reddit/book-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: nextVote }),
      });
      if (!response.ok) throw new Error("vote");
      const next = (await response.json()) as Activity;
      setActivity(next);
      setMessage(nextVote === 0 ? "Stimme zurückgenommen." : "Deine Stimme ist gespeichert.");
      channel.current?.postMessage("updated");
    } catch {
      setActivity(previous);
      setMessage("Deine Stimme wurde nicht gespeichert. Bitte versuche es gleich erneut.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Die Lizenz zum Erfolg – eine ungewöhnliche Lebensgeschichte",
          url: REDDIT_BOOK_URL,
        });
        return;
      }
      await navigator.clipboard.writeText(REDDIT_BOOK_URL);
      setMessage("Link kopiert. Du kannst ihn jetzt teilen.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setManualShare(true);
      setMessage("Du kannst den Link hier markieren und kopieren.");
    }
  }

  return (
    <div className={styles.actionsArea}>
      <div className={styles.actions}>
        <div
          ref={voteElement}
          data-live-like={live.increase > 0}
          className={`${styles.votePill} ${activity.vote === 1 ? styles.upvoted : activity.vote === -1 ? styles.downvoted : ""}`}
          aria-label="Beitrag bewerten"
        >
          <button
            type="button"
            aria-label="Upvote"
            aria-pressed={activity.vote === 1}
            disabled={busy || !ready}
            onClick={() => void vote(1)}
          >
            <ArrowUp size={21} aria-hidden="true" />
          </button>
          <span data-testid="vote-score" aria-label={`${displayedScore} Punkte`}>
            {new Intl.NumberFormat("de-DE").format(displayedScore)}
          </span>
          {live.increase > 0 && (
            <span className={styles.liveIncrease} aria-hidden="true">
              +{live.increase}
            </span>
          )}
          <button
            type="button"
            aria-label="Downvote"
            aria-pressed={activity.vote === -1}
            disabled={busy || !ready}
            onClick={() => void vote(-1)}
          >
            <ArrowDown size={21} aria-hidden="true" />
          </button>
        </div>
        <button type="button" className={styles.actionButton} onClick={() => void share()}>
          <Share2 size={17} aria-hidden="true" /> Teilen
        </button>
        <a className={styles.actionButton} href="#fragen">
          Fragen zum Buch <span aria-hidden="true">4</span>
        </a>
        <span className={styles.readers}>
          <span className={styles.liveDot} aria-hidden="true" />
          <span data-testid="reader-count">{live.readers}</span> lesen gerade
        </span>
      </div>
      <p className={styles.actionStatus} role="status">
        {message}
      </p>
      {manualShare && (
        <label className={styles.shareFallback}>
          <Copy size={16} aria-hidden="true" /> Link zum Teilen
          <input readOnly value={REDDIT_BOOK_URL} onFocus={(event) => event.target.select()} />
        </label>
      )}
      <noscript>
        <p>
          Zum Abstimmen bitte JavaScript aktivieren. Das Buch kannst du direkt bei Amazon ansehen.
        </p>
      </noscript>
    </div>
  );
}

export function MobileBookCta({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("first-book-cta");
    const footer = document.getElementById("book-footer");
    if (!hero || !footer) return;
    const update = () =>
      setVisible(
        hero.getBoundingClientRect().bottom < 72 &&
          footer.getBoundingClientRect().top > window.innerHeight &&
          (window.visualViewport?.height ?? innerHeight) > 450,
      );
    const observer = new IntersectionObserver(update, {
      threshold: [0, 1],
      rootMargin: "-72px 0px 0px 0px",
    });
    observer.observe(hero);
    observer.observe(footer);
    update();
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);
  return (
    <div className={styles.mobileCta} data-visible={visible} aria-hidden={!visible}>
      <div>
        <strong>{BUCH_PREIS_LABEL}</strong>
        <span>Taschenbuch</span>
      </div>
      <a
        href={AMAZON_PRODUCT_URL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={styles.primaryButton}
        data-reddit-event="amazon"
        data-cta-id="mobile-sticky"
        tabIndex={visible ? 0 : -1}
      >
        {label}
        <ArrowUp className={styles.outArrow} size={17} aria-hidden="true" />
      </a>
    </div>
  );
}

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setProgress(
          Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)),
        ),
      );
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, []);
  return (
    <div className={styles.progress} aria-hidden="true">
      <span style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

export function SavedReadingNote() {
  return (
    <span className={styles.smallNote}>
      <Check size={14} aria-hidden="true" /> Bestellabwicklung direkt bei Amazon
    </span>
  );
}
