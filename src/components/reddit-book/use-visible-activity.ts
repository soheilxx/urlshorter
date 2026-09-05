"use client";

import { useEffect, useState, type RefObject } from "react";
import { nextReaderCount } from "@/lib/reddit-book-config";

const BOOST_KEY = "lze_book_live_boost";
const READERS_KEY = "lze_book_readers";

/** Öffentliche Anzeigeeffekte; keine Votes, Besucher- oder Conversion-Ereignisse erzeugen. */
export function useVisibleActivity(
  target: RefObject<HTMLDivElement | null>,
  saving: RefObject<boolean>,
  initialReaders: number,
) {
  const [boost, setBoost] = useState(0);
  const [readers, setReaders] = useState(initialReaders);
  const [increase, setIncrease] = useState(0);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    let currentBoost = 0;
    let previousReaders = initialReaders;
    try {
      const storedBoost = Number(sessionStorage.getItem(BOOST_KEY));
      if (Number.isInteger(storedBoost) && storedBoost >= 0 && storedBoost <= 50_000)
        currentBoost = storedBoost;
      const storedReaders = Number(sessionStorage.getItem(READERS_KEY));
      if (Number.isInteger(storedReaders) && storedReaders >= 100 && storedReaders <= 999)
        previousReaders = storedReaders;
    } catch {
      /* Die Anzeige funktioniert auch ohne verfügbaren Speicher. */
    }
    let currentReaders = nextReaderCount(previousReaders);
    const persist = () => {
      try {
        sessionStorage.setItem(BOOST_KEY, String(currentBoost));
        sessionStorage.setItem(READERS_KEY, String(currentReaders));
      } catch {
        /* Keine Abhängigkeit von Storage. */
      }
    };
    persist();
    setBoost(currentBoost);
    setReaders(currentReaders);
    let inView = false;
    let disposed = false;
    let ticks = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pulse: ReturnType<typeof setTimeout> | undefined;
    const visible = () => {
      if (disposed || !inView || document.visibilityState !== "visible") return false;
      // Observer-Benachrichtigungen können nach einem Scroll noch ausstehen.
      // Unmittelbar vor jedem Zuwachs deshalb auch die aktuelle Position prüfen.
      const rect = element.getBoundingClientRect();
      const visibleHeight = Math.min(rect.bottom, innerHeight - 88) - Math.max(rect.top, 80);
      return rect.height > 0 && visibleHeight >= rect.height * 0.75;
    };

    function schedule(delay: number) {
      timer = setTimeout(() => {
        timer = undefined;
        if (!visible()) return;
        if (saving.current) {
          schedule(900);
          return;
        }
        const delta = Math.random() < 0.15 ? 2 : 1;
        currentBoost += delta;
        ticks++;
        if (ticks % 3 === 0) {
          currentReaders = nextReaderCount(currentReaders);
          setReaders(currentReaders);
        }
        persist();
        setBoost(currentBoost);
        setIncrease(delta);
        pulse = setTimeout(() => {
          if (!disposed) setIncrease(0);
        }, 950);
        schedule(3_200 + Math.random() * 3_600);
      }, delay);
    }
    function syncVisibility() {
      if (!visible()) {
        clearTimeout(timer);
        timer = undefined;
        clearTimeout(pulse);
        setIncrease(0);
      } else if (!timer) {
        // Ein gut sichtbarer erster Zuwachs kurz nach Eintritt ins Blickfeld.
        schedule(1_200 + Math.random() * 900);
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.75);
        syncVisibility();
      },
      { threshold: [0, 0.75, 1], rootMargin: "-80px 0px -88px 0px" },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
      clearTimeout(timer);
      clearTimeout(pulse);
    };
  }, [initialReaders, saving, target]);

  return { boost, readers, increase };
}
