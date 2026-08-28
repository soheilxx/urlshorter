import { getEnv } from "@/lib/env";
import { siteDomainMap } from "@/lib/tag-config";

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

function buildScript(): string {
  const env = getEnv();
  const config = {
    ga4: env.GA4_MEASUREMENT_ID ?? null,
    gtm: env.GTM_CONTAINER_ID ?? null,
    meta: env.META_PIXEL_ID ?? null,
    tiktok: env.TIKTOK_PIXEL_ID ?? null,
    reddit: env.REDDIT_PIXEL_ID ?? null,
    linkedin: env.LINKEDIN_PARTNER_ID ?? null,
    collect: `${env.PUBLIC_BASE_URL}/api/tag/collect`,
    sites: siteDomainMap(),
  };

  return `/* lizenzzumerfolg.com Tracking-Snippet */
(function () {
  "use strict";
  try {
    var C = ${JSON.stringify(config)};
    var el = document.currentScript;
    var siteId = (el && el.getAttribute("data-site")) || "";
    var domains = C.sites[siteId];
    if (!domains) return;
    var host = location.hostname.toLowerCase();
    var okHost = domains.some(function (d) { return host === d || host.slice(-(d.length + 1)) === "." + d; });
    if (!okHost) return;

    function uuid() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
    }
    function getCookie(name) {
      var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
      return m ? decodeURIComponent(m[1]) : null;
    }
    function setCookie(name, value, days) {
      var secure = location.protocol === "https:" ? ";Secure" : "";
      document.cookie = name + "=" + encodeURIComponent(value) + ";path=/;max-age=" + days * 86400 + ";SameSite=Lax" + secure;
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
      window.fbq("init", C.meta);
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
        ttq.load(C.tiktok);
      })(window, document, "ttq");
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
      var out = {}; var q = location.search.slice(1).split("&");
      var map = { utm_source: "source", utm_medium: "medium", utm_campaign: "campaign", utm_content: "content", utm_term: "term" };
      for (var i = 0; i < q.length; i++) {
        var kv = q[i].split("="); var key = map[decodeURIComponent(kv[0] || "")];
        if (key && kv[1]) out[key] = decodeURIComponent(kv[1].replace(/\\+/g, " ")).slice(0, 120);
      }
      return out;
    }
    function deriveFbc() {
      var existing = getCookie("_fbc"); if (existing) return existing;
      var m = location.search.match(/[?&]fbclid=([^&#]+)/);
      return m ? "fb.1." + Date.now() + "." + decodeURIComponent(m[1]) : null;
    }
    function collect(id, name) {
      try {
        var payload = {
          site: siteId, id: id, name: name,
          url: location.href.split("#")[0],
          ref: document.referrer ? document.referrer.slice(0, 300) : undefined,
          cid: cid,
          fbp: getCookie("_fbp") || undefined,
          fbc: deriveFbc() || undefined,
          ttp: getCookie("_ttp") || undefined,
          utm: utmFromSearch()
        };
        var m2 = location.search.match(/[?&]ttclid=([^&#]+)/);
        if (m2) payload.ttclid = decodeURIComponent(m2[1]);
        var body = JSON.stringify(payload);
        if (navigator.sendBeacon) {
          navigator.sendBeacon(C.collect, new Blob([body], { type: "text/plain" }));
        } else if (window.fetch) {
          fetch(C.collect, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } });
        }
      } catch (e) { /* Tracking darf die Seite nie stören */ }
    }

    // ---- Pageviews (inkl. SPA) ---------------------------------------------
    function pageView() {
      var id = uuid();
      try {
        if (C.ga4 && !C.gtm) gtag("event", "page_view", { page_location: location.href, page_title: document.title, send_to: C.ga4 });
        if (C.gtm) window.dataLayer.push({ event: "virtual_page_view", page_location: location.href });
        if (window.fbq) window.fbq("track", "PageView", {}, { eventID: id });
        if (window.ttq && window.ttq.page) window.ttq.page();
        if (window.rdt) window.rdt("track", "PageVisit");
      } catch (e) {}
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
    window.lze = function (cmd, name, params) {
      try {
        if (cmd !== "event" || !name) return;
        var safe = String(name).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64);
        var id = uuid();
        gtag("event", safe, params || {});
        if (window.fbq) window.fbq("trackCustom", safe, params || {}, { eventID: id });
        if (window.ttq && window.ttq.track) window.ttq.track(safe, params || {});
        collect(id, safe);
      } catch (e) {}
    };

    pageView();
  } catch (e) { /* niemals die einbettende Seite beschädigen */ }
})();
`;
}

export async function GET(): Promise<Response> {
  return new Response(buildScript(), {
    status: 200,
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // Kurzer Browser-Cache, längerer CDN-Cache: ID-Änderungen greifen nach
      // dem Deploy zügig, ohne jede Anfrage neu zu rendern.
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
