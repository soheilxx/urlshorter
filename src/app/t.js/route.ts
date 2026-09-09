import { getEnv } from "@/lib/env";
import { BOOK_PRODUCT, BOOK_PURCHASE_URL_RULES } from "@/lib/book-conversion-events";
import { siteDomainMap } from "@/lib/tag-config";
import { resolveTagSite } from "@/lib/tag-sites";

/**
 * Zentrales Tracking-Snippet: GET /t.js
 *
 * Einbau auf angebundenen Websites (Site-IDs: src/lib/tag-config.ts):
 *   <script async src="https://lizenzzumerfolg.com/t.js" data-site="SITE_ID"></script>
 *
 * Das generierte Script
 *  - prüft den Hostname gegen die Domain-Allowlist der Site (Schutz vor
 *    Fremdeinbettung),
 *  - lädt alle konfigurierten Pixel (GA4/GTM, Meta, TikTok, Reddit, LinkedIn),
 *  - misst Seitenaufrufe inkl. SPA-Navigationen (History-API),
 *  - stellt window.lze("event", "name") für eigene Events bereit,
 *  - meldet jedes Event zusätzlich First-Party an /api/tag/collect
 *    (eigene Datenbank + serverseitige Conversion-APIs, identische event_id
 *    → Meta/TikTok deduplizieren Browser- und Server-Event).
 *
 * Pixel-IDs kommen aus den Env-Variablen – zentral pflegbar, ein Deploy
 * aktualisiert alle angebundenen Websites.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScriptConfig {
  ga4: string | null;
  gtm: string | null;
  meta: string | null;
  tiktok: string | null;
  reddit: string | null;
  linkedin: string | null;
  collect: string;
  sites: Record<string, string[]>;
  siteId?: string;
}

/** Globale Variante (Bestands-Snippets ohne ?site-Parameter). */
function legacyConfig(): ScriptConfig {
  const env = getEnv();
  return {
    ga4: env.GA4_MEASUREMENT_ID ?? null,
    gtm: env.GTM_CONTAINER_ID ?? null,
    meta: env.META_PIXEL_ID ?? null,
    tiktok: env.TIKTOK_PIXEL_ID ?? null,
    reddit: env.REDDIT_PIXEL_ID ?? null,
    linkedin: env.LINKEDIN_PARTNER_ID ?? null,
    collect: `${env.PUBLIC_BASE_URL}/api/tag/collect`,
    sites: siteDomainMap(),
  };
}

function buildScript(config: ScriptConfig): string {
  return `/* lizenzzumerfolg.com Tracking-Snippet */
(function () {
  "use strict";
  try {
    var C = ${JSON.stringify(config)};
    var el = document.currentScript;
    var siteId = C.siteId || (el && el.getAttribute("data-site")) || "";
    var domains = C.sites[siteId];
    if (!domains) return;
    var host = location.hostname.toLowerCase().replace(/\\.$/, "");
    var okHost = domains.some(function (d) { return host === d || host.slice(-(d.length + 1)) === "." + d; });
    if (!okHost) return;
    window.__lzeTags = window.__lzeTags || {};
    if (window.__lzeTags[siteId]) return;
    window.__lzeTags[siteId] = true;

    function uuid() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
    }
    function getCookie(name) {
      try {
        var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
        return m ? decodeURIComponent(m[1]) : null;
      } catch (e) { return null; }
    }
    function setCookie(name, value, days) {
      try {
        var secure = location.protocol === "https:" ? ";Secure" : "";
        document.cookie = name + "=" + encodeURIComponent(value) + ";path=/;max-age=" + days * 86400 + ";SameSite=Lax" + secure;
      } catch (e) {}
    }
    function loadScript(src) {
      var s = document.createElement("script");
      s.async = true;
      s.src = src;
      (document.head || document.documentElement).appendChild(s);
    }

    var cid = getCookie("_lze_id");
    if (!cid || !/^[0-9a-f-]{36}$/i.test(cid)) { cid = uuid(); }
    setCookie("_lze_id", cid, 400);

    // ---- dataLayer / gtag ---------------------------------------------------
    window.dataLayer = window.dataLayer || [];
    var gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag = gtag;
    gtag("consent", "default", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" });
    gtag("js", new Date());
    if (C.gtm) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      loadScript("https://www.googletagmanager.com/gtm.js?id=" + C.gtm);
    } else if (C.ga4) {
      loadScript("https://www.googletagmanager.com/gtag/js?id=" + C.ga4);
      gtag("config", C.ga4, { send_page_view: false });
    }

    // ---- Meta Pixel ---------------------------------------------------------
    if (C.meta && !window.fbq) {
      (function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
        t = b.createElement(e); t.async = true; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    }
    if (C.meta && window.fbq) {
      window.__lzeMetaPixels = window.__lzeMetaPixels || new Set();
      if (!window.__lzeMetaPixels.has(C.meta)) {
        try { window.fbq("init", C.meta); } catch (e) {}
        window.__lzeMetaPixels.add(C.meta);
      }
    }

    // ---- TikTok -------------------------------------------------------------
    if (C.tiktok && !window.ttq) {
      (function (w, d, t) {
        w.TiktokAnalyticsObject = t; var ttq = (w[t] = w[t] || []);
        ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
        ttq.setAndDefer = function (o, e) { o[e] = function () { o.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.load = function (e) {
          var u = "https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = u; ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {};
          var o = d.createElement("script"); o.async = true; o.src = u + "?sdkid=" + e + "&lib=" + t;
          var a = d.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a);
        };
      })(window, document, "ttq");
    }
    if (C.tiktok && window.ttq) {
      window.__lzeTikTokPixels = window.__lzeTikTokPixels || new Set();
      if (!window.__lzeTikTokPixels.has(C.tiktok)) {
        try { if (window.ttq.load && !(window.ttq._i && window.ttq._i[C.tiktok])) window.ttq.load(C.tiktok); } catch (e) {}
        window.__lzeTikTokPixels.add(C.tiktok);
      }
    }

    // ---- Reddit -------------------------------------------------------------
    if (C.reddit && !window.rdt) {
      (function (w, d) {
        var p = (w.rdt = function () { p.sendEvent ? p.sendEvent.apply(p, arguments) : p.callQueue.push(arguments); });
        p.callQueue = [];
        var t = d.createElement("script"); t.src = "https://www.redditstatic.com/ads/pixel.js"; t.async = true;
        var s = d.getElementsByTagName("script")[0]; s.parentNode.insertBefore(t, s);
      })(window, document);
      window.rdt("init", C.reddit);
    }

    // ---- LinkedIn Insight ---------------------------------------------------
    if (C.linkedin && !window._linkedin_partner_id) {
      window._linkedin_partner_id = C.linkedin;
      window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
      window._linkedin_data_partner_ids.push(C.linkedin);
      if (!window.lintrk) { window.lintrk = function (a, b) { window.lintrk.q.push([a, b]); }; window.lintrk.q = []; }
      loadScript("https://snap.licdn.com/li.lms-analytics/insight.min.js");
    }

    // ---- First-Party Collect ------------------------------------------------
    function utmFromSearch() {
      var out = {}; var q = new URLSearchParams(location.search);
      var map = { utm_source: "source", utm_medium: "medium", utm_campaign: "campaign", utm_content: "content", utm_term: "term" };
      Object.keys(map).forEach(function (key) { var value = q.get(key); if (value) out[map[key]] = value.slice(0, 120); });
      return out;
    }
    function deriveFbc() {
      var existing = getCookie("_fbc");
      var clickId = new URLSearchParams(location.search).get("fbclid");
      if (!clickId || !/^[A-Za-z0-9._-]{1,150}$/.test(clickId)) return existing;
      if (existing && existing.slice(-(clickId.length + 1)) === "." + clickId) return existing;
      var value = "fb.1." + Date.now() + "." + clickId;
      setCookie("_fbc", value, 90);
      return value;
    }
    function collect(id, name, params) {
      try {
        var payload = {
          site: siteId, id: id, name: name,
          url: location.href.split("#")[0],
          ref: document.referrer ? document.referrer.slice(0, 300) : undefined,
          cid: cid,
          fbp: getCookie("_fbp") || undefined,
          fbc: deriveFbc() || undefined,
          ttp: getCookie("_ttp") || undefined,
          utm: utmFromSearch(),
          params: params
        };
        var ttclid = new URLSearchParams(location.search).get("ttclid");
        if (ttclid && /^[A-Za-z0-9._-]{1,200}$/.test(ttclid)) payload.ttclid = ttclid;
        var body = JSON.stringify(payload);
        var queued = false;
        try { queued = navigator.sendBeacon && navigator.sendBeacon(C.collect, new Blob([body], { type: "text/plain" })); } catch (e) {}
        if (!queued && window.fetch) {
          fetch(C.collect, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(function () {});
        }
      } catch (e) { /* Tracking darf die Seite nie stören */ }
    }

    // ---- Pageviews (inkl. SPA) ---------------------------------------------
    function pageView() {
      if (window.__lzeBookTrackingPath === location.pathname) return;
      var id = uuid();
      try { if (C.ga4 && !C.gtm) gtag("event", "page_view", { page_location: location.href, page_title: document.title, send_to: C.ga4 }); } catch (e) {}
      try { if (C.gtm) window.dataLayer.push({ event: "virtual_page_view", page_location: location.href }); } catch (e) {}
      try { if (C.meta && window.fbq) window.fbq("trackSingle", C.meta, "PageView", {}, { eventID: id }); } catch (e) {}
      try { if (C.tiktok && window.ttq && window.ttq.page) window.ttq.page({}, { event_id: id }); } catch (e) {}
      try { if (C.reddit && window.rdt) window.rdt("track", "PageVisit"); } catch (e) {}
      collect(id, "page_view");
    }

    var lastUrl = location.href;
    function onNavigate() {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      pageView();
    }
    var origPush = history.pushState;
    history.pushState = function () { origPush.apply(this, arguments); onNavigate(); };
    var origReplace = history.replaceState;
    history.replaceState = function () { origReplace.apply(this, arguments); onNavigate(); };
    window.addEventListener("popstate", onNavigate);

    // ---- Öffentliche Event-API ---------------------------------------------
    var lastAddToCart = 0;
    function trackEvent(name, params) {
      try {
        var safe = String(name).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64);
        if (safe === "addtocart") safe = "add_to_cart";
        if (safe === "pageview") safe = "page_view";
        if (!safe) return;
        var standard = safe === "add_to_cart" ? "AddToCart" : safe === "page_view" ? "PageView" : null;
        if (standard === "AddToCart") {
          var now = Date.now();
          if (lastAddToCart && now - lastAddToCart < 600) return;
          lastAddToCart = now;
        }
        var id = uuid();
        var googleParams = params || {};
        var tiktokParams = params || {};
        if (standard === "AddToCart" && params && Array.isArray(params.content_ids)) {
          googleParams = Object.assign({}, params, { items: params.content_ids.map(function (contentId) {
            return { item_id: contentId, item_name: params.content_name, price: params.value, quantity: 1 };
          }) });
          tiktokParams = Object.assign({}, params, { contents: params.content_ids.map(function (contentId) {
            return { content_id: contentId, content_name: params.content_name, content_type: params.content_type, quantity: 1 };
          }) });
        }
        try { gtag("event", safe, googleParams); } catch (e) {}
        try { if (C.meta && window.fbq) window.fbq(standard ? "trackSingle" : "trackSingleCustom", C.meta, standard || safe, params || {}, { eventID: id }); } catch (e) {}
        try { if (C.tiktok && window.ttq && window.ttq.track) window.ttq.track(standard || safe, tiktokParams, { event_id: id }); } catch (e) {}
        try { if (C.reddit && window.rdt && safe === "add_to_cart") window.rdt("track", "AddToCart", { conversionId: id }); } catch (e) {}
        collect(id, safe, params);
      } catch (e) {}
    }
    window.lze = function (cmd, name, params) {
      if (cmd === "event" && name) trackEvent(name, params);
    };

    // ---- Buch-Kaufklicks: Standardevent, auch bei SPA-Links und Mittelklick ----
    var book = ${JSON.stringify(BOOK_PRODUCT)};
    var bookRules = ${JSON.stringify(BOOK_PURCHASE_URL_RULES)};
    function isBookLink(href) {
      try {
        var url = new URL(href, location.href);
        if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
        return bookRules.some(function (rule) {
          return new RegExp(rule.host, rule.flags).test(url.hostname) &&
            new RegExp(rule.path, rule.flags).test(url.pathname);
        });
      } catch (e) { return false; }
    }
    function bookClick(event) {
      if (!event.isTrusted || (event.type === "click" ? event.button !== 0 : event.button !== 1)) return;
      if (window.__lzeBookTrackingPath === location.pathname) return;
      var target = event.target;
      if (target && target.nodeType !== 1) target = target.parentElement;
      var link = target && target.closest ? target.closest("a[href]") : null;
      if (!link || !isBookLink(link.href)) return;
      trackEvent("add_to_cart", {
        content_name: book.name, content_ids: [book.id], content_type: "product",
        value: book.value, currency: book.currency
      });
    }
    document.addEventListener("click", bookClick, true);
    document.addEventListener("auxclick", bookClick, true);

    pageView();
  } catch (e) { /* niemals die einbettende Seite beschädigen */ }
})();
`;
}

const SCRIPT_HEADERS = {
  "Content-Type": "text/javascript; charset=utf-8",
  // Kurzer Browser-Cache, moderater CDN-Cache: Konfigurationsänderungen im
  // Dashboard greifen nach wenigen Minuten auf allen Websites.
  "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
  "Access-Control-Allow-Origin": "*",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request): Promise<Response> {
  const siteId = new URL(request.url).searchParams.get("site");

  // Ohne ?site: globale Bestands-Variante (Env-Pixel, Code-Site-Allowlist)
  if (!siteId) {
    return new Response(buildScript(legacyConfig()), { status: 200, headers: SCRIPT_HEADERS });
  }

  // Mit ?site: Konfiguration der Site aus Dashboard/DB (Env als Fallback)
  const site = await resolveTagSite(siteId);
  if (!site || !site.active) {
    return new Response("/* TRACK.SITE: unbekannte oder deaktivierte Site */", {
      status: 200,
      headers: { ...SCRIPT_HEADERS, "Cache-Control": "public, max-age=60" },
    });
  }
  const env = getEnv();
  const config: ScriptConfig = {
    siteId: site.id,
    ga4: site.pixels.ga4,
    gtm: site.pixels.gtm,
    meta: site.pixels.meta,
    tiktok: site.pixels.tiktok,
    reddit: site.pixels.reddit,
    linkedin: site.pixels.linkedin,
    collect: `${env.PUBLIC_BASE_URL}/api/tag/collect`,
    sites: { [site.id]: site.domains },
  };
  return new Response(buildScript(config), { status: 200, headers: SCRIPT_HEADERS });
}
