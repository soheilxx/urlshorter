"use client";

import { useEffect, useRef } from "react";
import {
  BOOK_IDENTIFIER_PATTERN,
  BOOK_PRODUCT,
  type BookConversionConfig,
  type BookConversionType,
} from "@/lib/book-conversion-events";

/**
 * Conversion-Tracking der Buchseiten für Meta, TikTok, LinkedIn und GA4/GTM
 * (Reddit läuft parallel in reddit-tracking.tsx nach demselben Muster).
 *
 * Pro Handlung entsteht EINE UUID, die das Browser-Pixel als eventID/event_id
 * sendet und die der Server an die Conversion-APIs weiterreicht → die
 * Anbieter deduplizieren Pixel- und Server-Event.
 *
 * - Sichtbarer Seitenaufruf → Meta "PageView" (Pixel + CAPI), TikTok Pageview
 * - Klick auf einen Amazon-CTA → Meta/TikTok "AddToCart", LinkedIn
 *   Conversion, GA4 "add_to_cart" (Kauf-Proxy, kein Umsatz)
 *
 * Diese Komponente übernimmt Bootstrap + Init von Meta- und TikTok-Pixel;
 * GewinnTracking lädt die beiden Skripte dann nicht zusätzlich.
 * Nur mounten, wenn die übergeordnete Consent-Prüfung Marketing freigibt.
 */

type QueueFn = ((...args: unknown[]) => void) & {
  queue?: unknown[];
  callMethod?: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
  push?: unknown;
};
type TikTokQueue = unknown[] & {
  methods?: string[];
  setAndDefer?: (target: Record<string, unknown>, method: string) => void;
  instance?: (id: string) => unknown;
  load?: (id: string, options?: Record<string, unknown>) => void;
  page?: (...args: unknown[]) => void;
  track?: (...args: unknown[]) => void;
  _i?: Record<string, unknown[] & { _u?: string }>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
};
type TrackingWindow = Window & {
  fbq?: QueueFn;
  _fbq?: QueueFn;
  ttq?: TikTokQueue;
  TiktokAnalyticsObject?: string;
  lintrk?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
  __lzeMetaPixels?: Set<string>;
  __lzeTikTokPixels?: Set<string>;
};

function cookie(name: string): string | undefined {
  try {
    const part = document.cookie.split(";").find((entry) => entry.trim().startsWith(`${name}=`));
    const value = part ? decodeURIComponent(part.trim().slice(name.length + 1)) : undefined;
    return value && value.length <= 200 ? value : undefined;
  } catch {
    return undefined;
  }
}

function identifier(value: string | null | undefined): string | undefined {
  return value && BOOK_IDENTIFIER_PATTERN.test(value) ? value : undefined;
}

/** Offizieller Meta-Pixel-Bootstrap (Queue-Stub + Skript), idempotent. */
function bootstrapMeta(w: TrackingWindow, pixelId: string) {
  if (!w.fbq) {
    const n: QueueFn = (...args: unknown[]) => {
      if (n.callMethod) n.callMethod(...args);
      else n.queue?.push(args);
    };
    n.queue = [];
    n.loaded = true;
    n.version = "2.0";
    n.push = n;
    w.fbq = n;
    if (!w._fbq) w._fbq = n;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  w.__lzeMetaPixels ??= new Set();
  if (!w.__lzeMetaPixels.has(pixelId)) {
    try {
      w.fbq("init", pixelId);
    } catch {
      /* Ein blockiertes Pixel darf CAPI nicht unterbrechen. */
    }
    w.__lzeMetaPixels.add(pixelId);
  }
}

/** Offizieller TikTok-Pixel-Bootstrap (portiert), idempotent. */
function bootstrapTikTok(w: TrackingWindow, pixelId: string) {
  if (!w.ttq) {
    w.TiktokAnalyticsObject = "ttq";
    const ttq: TikTokQueue = [];
    ttq.methods = [
      "page",
      "track",
      "identify",
      "instances",
      "debug",
      "on",
      "off",
      "once",
      "ready",
      "alias",
      "group",
      "enableCookie",
      "disableCookie",
    ];
    ttq.setAndDefer = (target, method) => {
      target[method] = (...args: unknown[]) => {
        (target as unknown as unknown[]).push([method, ...args]);
      };
    };
    for (const method of ttq.methods) {
      ttq.setAndDefer(ttq as unknown as Record<string, unknown>, method);
    }
    ttq.instance = (id) => {
      const instance = (ttq._i?.[id] ?? []) as unknown as Record<string, unknown>;
      for (const method of ttq.methods ?? []) ttq.setAndDefer?.(instance, method);
      return instance;
    };
    ttq.load = (id, options) => {
      const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i ??= {};
      const bucket = [] as unknown[] & { _u?: string };
      bucket._u = url;
      ttq._i[id] = bucket;
      ttq._t ??= {};
      ttq._t[id] = Date.now();
      ttq._o ??= {};
      ttq._o[id] = options ?? {};
      const script = document.createElement("script");
      script.async = true;
      script.src = `${url}?sdkid=${id}&lib=ttq`;
      document.head.appendChild(script);
    };
    w.ttq = ttq;
  }
  w.__lzeTikTokPixels ??= new Set();
  if (!w.__lzeTikTokPixels.has(pixelId)) {
    try {
      w.ttq.load?.(pixelId);
    } catch {
      /* siehe oben */
    }
    w.__lzeTikTokPixels.add(pixelId);
  }
}

const CONTENTS = {
  content_name: BOOK_PRODUCT.name,
  content_ids: [BOOK_PRODUCT.id],
  content_type: "product",
  value: BOOK_PRODUCT.value,
  currency: BOOK_PRODUCT.currency,
};
const AMAZON_CTA_SELECTOR =
  'a[data-gw-event="buch_amazon_klick"],a[data-gw-event="gewinnspiel_amazon_klick"],a[data-reddit-event="amazon"]';

export function BookConversionTracking({ config }: { config: BookConversionConfig }) {
  const pageSent = useRef(false);
  const lastClick = useRef(0);

  useEffect(() => {
    const w = window as TrackingWindow;
    if (location.pathname !== config.path) return;
    if (config.metaPixelId) bootstrapMeta(w, config.metaPixelId);
    if (config.tiktokPixelId) bootstrapTikTok(w, config.tiktokPixelId);

    const query = new URLSearchParams(location.search);
    const utm = Object.fromEntries(
      ["source", "medium", "campaign", "content", "term"]
        .map((key) => [key, query.get(`utm_${key}`)?.slice(0, 120)])
        .filter(([, value]) => value),
    );

    function send(type: BookConversionType, id: string, ctaId?: string) {
      try {
        const body = JSON.stringify({
          id,
          type,
          timestamp: Date.now(),
          context: config.context,
          path: config.path,
          fbp: identifier(cookie("_fbp")),
          fbc: identifier(cookie("_fbc")),
          fbclid: identifier(query.get("fbclid")),
          ttp: identifier(cookie("_ttp")),
          ttclid: identifier(query.get("ttclid")),
          liFatId: identifier(query.get("li_fat_id") ?? cookie("li_fat_id")),
          utm,
          ...(type === "AddToCart" ? { destination: config.amazonUrl, ctaId } : {}),
        });
        const queued = navigator.sendBeacon?.(
          "/api/book/events",
          new Blob([body], { type: "text/plain" }),
        );
        if (!queued) {
          void fetch("/api/book/events", {
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
      const id = crypto.randomUUID();
      try {
        if (config.metaPixelId) w.fbq?.("track", "PageView", {}, { eventID: id });
        if (config.tiktokPixelId) w.ttq?.page?.();
      } catch {
        /* CAPI bleibt unabhängig. */
      }
      send("PageView", id);
    }

    function addToCart(ctaId: string) {
      const id = crypto.randomUUID();
      try {
        if (config.metaPixelId) w.fbq?.("track", "AddToCart", CONTENTS, { eventID: id });
        if (config.tiktokPixelId) {
          w.ttq?.track?.(
            "AddToCart",
            {
              contents: [
                {
                  content_id: BOOK_PRODUCT.id,
                  content_type: "product",
                  content_name: BOOK_PRODUCT.name,
                },
              ],
              value: BOOK_PRODUCT.value,
              currency: BOOK_PRODUCT.currency,
            },
            { event_id: id },
          );
        }
        if (config.linkedInConversionId) {
          w.lintrk?.("track", { conversion_id: Number(config.linkedInConversionId) });
        }
        const ga4 = {
          currency: BOOK_PRODUCT.currency,
          value: BOOK_PRODUCT.value,
          items: [
            {
              item_id: BOOK_PRODUCT.id,
              item_name: BOOK_PRODUCT.name,
              price: BOOK_PRODUCT.value,
              quantity: 1,
            },
          ],
        };
        if (w.gtag) w.gtag("event", "add_to_cart", ga4);
        else (w.dataLayer ??= []).push({ event: "add_to_cart", ecommerce: ga4 });
      } catch {
        /* siehe oben */
      }
      send("AddToCart", id, ctaId);
    }

    function click(event: MouseEvent) {
      if (!event.isTrusted || (event.type === "click" ? event.button !== 0 : event.button !== 1))
        return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>(AMAZON_CTA_SELECTOR);
      if (!link || link.href !== new URL(config.amazonUrl, location.origin).href) return;
      const now = Date.now();
      if (now - lastClick.current < 600) return;
      lastClick.current = now;
      addToCart(link.dataset.ctaId?.slice(0, 64) ?? link.dataset.gwEvent ?? "amazon");
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
