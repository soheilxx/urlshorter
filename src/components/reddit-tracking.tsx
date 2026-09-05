"use client";

import { useEffect, useRef } from "react";
import { REDDIT_IDENTIFIER_PATTERN, type RedditTrackingConfig } from "@/lib/reddit-events";

type RedditFunction = ((...args: unknown[]) => void) & {
  callQueue?: unknown[][];
  sendEvent?: (...args: unknown[]) => void;
};
type RedditWindow = Window & { rdt?: RedditFunction; __lzeRedditPixels?: Set<string> };

function cookie(name: string): string | undefined {
  try {
    const part = document.cookie.split(";").find((entry) => entry.trim().startsWith(`${name}=`));
    const value = part ? decodeURIComponent(part.trim().slice(name.length + 1)) : undefined;
    return value && REDDIT_IDENTIFIER_PATTERN.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Nur mounten, wenn die übergeordnete Consent-Prüfung Marketing freigibt. */
export function RedditTracking({ config }: { config: RedditTrackingConfig }) {
  const pageSent = useRef(false);
  const lastClick = useRef(0);
  useEffect(() => {
    const w = window as RedditWindow;
    if (location.pathname !== config.path) return;
    if (!w.rdt) {
      const queue: RedditFunction = (...args) => {
        if (queue.sendEvent) queue.sendEvent(...args);
        else queue.callQueue?.push(args);
      };
      queue.callQueue = [];
      w.rdt = queue;
      const script = document.createElement("script");
      script.src = "https://www.redditstatic.com/ads/pixel.js";
      script.async = true;
      document.head.appendChild(script);
    }
    w.__lzeRedditPixels ??= new Set();
    if (!w.__lzeRedditPixels.has(config.pixelId)) {
      try {
        w.rdt("init", config.pixelId);
      } catch {
        /* Auch eine blockierte Pixel-Initialisierung darf CAPI nicht unterbrechen. */
      }
      w.__lzeRedditPixels.add(config.pixelId);
    }
    const query = new URLSearchParams(location.search);
    let clickId = query.get("rdt_cid") ?? undefined;
    if (clickId && !REDDIT_IDENTIFIER_PATTERN.test(clickId)) clickId = undefined;
    try {
      if (clickId) sessionStorage.setItem("lze_reddit_click_id", clickId);
      else clickId = sessionStorage.getItem("lze_reddit_click_id") ?? cookie("_rdt_cid");
    } catch {
      clickId ??= cookie("_rdt_cid");
    }
    if (clickId && !REDDIT_IDENTIFIER_PATTERN.test(clickId)) clickId = undefined;

    function track(type: "PageVisit" | "AddToCart", ctaId?: string) {
      const id = crypto.randomUUID();
      try {
        w.rdt?.("track", type, { conversionId: id });
      } catch {
        /* CAPI bleibt unabhängig. */
      }
      try {
        const utm = Object.fromEntries(
          ["source", "medium", "campaign", "content", "term"]
            .map((key) => [key, query.get(`utm_${key}`)?.slice(0, 120)])
            .filter(([, value]) => value),
        );
        const body = JSON.stringify({
          id,
          type,
          timestamp: Date.now(),
          context: config.context,
          path: config.path,
          clickId,
          uuid: cookie("_rdt_uuid"),
          utm,
          ...(type === "AddToCart" ? { destination: config.amazonUrl, ctaId } : {}),
        });
        const queued = navigator.sendBeacon?.(
          "/api/reddit/events",
          new Blob([body], { type: "text/plain" }),
        );
        if (!queued) {
          void fetch("/api/reddit/events", {
            method: "POST",
            body,
            keepalive: true,
            headers: { "Content-Type": "text/plain" },
          }).catch(() => {});
        }
      } catch {
        /* Der Amazon-Link bleibt auch ohne Tracking bedienbar. */
      }
    }
    function pageView() {
      if (document.visibilityState !== "visible" || pageSent.current) return;
      pageSent.current = true;
      track("PageVisit");
    }
    function click(event: MouseEvent) {
      if (!event.isTrusted || (event.type === "click" ? event.button !== 0 : event.button !== 1))
        return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>(
        'a[data-gw-event="buch_amazon_klick"],a[data-gw-event="gewinnspiel_amazon_klick"],a[data-reddit-event="amazon"]',
      );
      if (!link || link.href !== new URL(config.amazonUrl, location.origin).href) return;
      const now = Date.now();
      if (now - lastClick.current < 600) return;
      lastClick.current = now;
      track("AddToCart", link.dataset.ctaId?.slice(0, 64) ?? link.dataset.gwEvent ?? "amazon");
    }
    pageView();
    document.addEventListener("visibilitychange", pageView);
    document.addEventListener("click", click, true);
    document.addEventListener("auxclick", click, true);
    return () => {
      document.removeEventListener("visibilitychange", pageView);
      document.removeEventListener("click", click, true);
      document.removeEventListener("auxclick", click, true);
    };
  }, [config]);
  return null;
}
