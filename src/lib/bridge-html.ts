import { escapeHtml, jsonForInlineScript } from "@/lib/utils";

/**
 * Serverseitige Generierung der Weiterleitungsseite (Bridge-Page).
 *
 * Bewusst KEIN React / kein Framework-JavaScript: Die Seite besteht aus
 * wenigen KB Inline-HTML/CSS/JS, lädt keine Bilder oder Fonts und leitet
 * nach kurzer, konfigurierbarer Verzögerung per `window.location.replace()`
 * zur Amazon-URL weiter.
 */

export interface BridgeTrackingConfig {
  gtmContainerId: string | null;
  ga4MeasurementId: string | null;
  metaPixelId: string | null;
  redditPixelId: string | null;
  tiktokPixelId: string | null;
  linkedInPartnerId: string | null;
}

export interface BridgeEventParams {
  event_id: string;
  short_code: string;
  link_name: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  destination_host: string;
}

export interface BridgePageOptions {
  destinationUrl: string;
  delayMs: number;
  eventToken: string;
  hasMarketingConsent: boolean;
  tracking: BridgeTrackingConfig;
  eventParams: BridgeEventParams;
  privacyUrl: string | null;
  imprintUrl: string | null;
}

// Nur syntaktisch gültige IDs werden in die Seite eingebettet (XSS-Schutz,
// falls eine Environment Variable manipuliert oder falsch gesetzt wurde).
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;
const GA4_ID_PATTERN = /^G-[A-Z0-9]{4,16}$/;
const META_PIXEL_PATTERN = /^[0-9]{5,20}$/;
const REDDIT_PIXEL_PATTERN = /^a2_[a-z0-9]{4,24}$/i;
const TIKTOK_PIXEL_PATTERN = /^[A-Z0-9]{10,32}$/i;
const LINKEDIN_PARTNER_PATTERN = /^[0-9]{4,12}$/;

export function sanitizeTrackingConfig(config: BridgeTrackingConfig): BridgeTrackingConfig {
  return {
    gtmContainerId:
      config.gtmContainerId && GTM_ID_PATTERN.test(config.gtmContainerId)
        ? config.gtmContainerId
        : null,
    ga4MeasurementId:
      config.ga4MeasurementId && GA4_ID_PATTERN.test(config.ga4MeasurementId)
        ? config.ga4MeasurementId
        : null,
    metaPixelId:
      config.metaPixelId && META_PIXEL_PATTERN.test(config.metaPixelId) ? config.metaPixelId : null,
    redditPixelId:
      config.redditPixelId && REDDIT_PIXEL_PATTERN.test(config.redditPixelId)
        ? config.redditPixelId
        : null,
    tiktokPixelId:
      config.tiktokPixelId && TIKTOK_PIXEL_PATTERN.test(config.tiktokPixelId)
        ? config.tiktokPixelId
        : null,
    linkedInPartnerId:
      config.linkedInPartnerId && LINKEDIN_PARTNER_PATTERN.test(config.linkedInPartnerId)
        ? config.linkedInPartnerId
        : null,
  };
}

/**
 * Content-Security-Policy der Bridge-Page. Erlaubt nur die konfigurierten
 * Tracking-Anbieter (GTM/GA4/Meta) plus optionale Zusatz-Hosts.
 */
export function buildBridgeCsp(extraHosts: string[]): string {
  const extra = extraHosts.map((h) => `https://${h.replace(/^https?:\/\//, "")}`).join(" ");
  const scriptSrc =
    `script-src 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net ` +
    `https://www.redditstatic.com https://analytics.tiktok.com https://snap.licdn.com` +
    (extra ? ` ${extra}` : "");
  const connectSrc =
    `connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com ` +
    `https://*.analytics.google.com https://stats.g.doubleclick.net https://www.facebook.com ` +
    `https://alb.reddit.com https://pixel.redditmedia.com https://www.redditstatic.com ` +
    `https://analytics.tiktok.com https://*.tiktok.com https://px.ads.linkedin.com ` +
    `https://*.linkedin.com` +
    (extra ? ` ${extra}` : "");
  return [
    "default-src 'none'",
    scriptSrc,
    "style-src 'unsafe-inline'",
    "img-src https: data:",
    connectSrc,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Anzeigename des Ziels auf der Bridge-Page: "Amazon" für Amazon-Hosts,
 * sonst der bereinigte Hostname (z. B. "example.com").
 */
export function destinationLabel(host: string): string {
  const normalized = (host ?? "").toLowerCase().replace(/\.+$/, "");
  if (
    /(^|\.)amazon\.[a-z.]{2,10}$/.test(normalized) ||
    /(^|\.)amzn\.[a-z.]{2,10}$/.test(normalized)
  ) {
    return "Amazon";
  }
  const cleaned = normalized.replace(/^www\./, "");
  return cleaned.length > 0 ? cleaned : "deinem Ziel";
}

export function renderBridgePage(opts: BridgePageOptions): string {
  const tracking = sanitizeTrackingConfig(opts.tracking);
  const dest = opts.destinationUrl;
  const destHtml = escapeHtml(dest);
  const label = escapeHtml(destinationLabel(opts.eventParams.destination_host));
  const delayMs = Math.min(2000, Math.max(300, Math.round(opts.delayMs)));
  const noscriptDelaySeconds = Math.max(0, Math.round(delayMs / 1000));

  const config = {
    dest,
    delay: delayMs,
    token: opts.eventToken,
    consent: opts.hasMarketingConsent,
    gtm: opts.hasMarketingConsent ? tracking.gtmContainerId : null,
    // GA4 nur nativ laden, wenn KEIN GTM konfiguriert ist (sonst droht
    // doppelte Event-Auslösung über den Container).
    ga4: opts.hasMarketingConsent && !tracking.gtmContainerId ? tracking.ga4MeasurementId : null,
    meta: opts.hasMarketingConsent ? tracking.metaPixelId : null,
    reddit: opts.hasMarketingConsent ? tracking.redditPixelId : null,
    tiktok: opts.hasMarketingConsent ? tracking.tiktokPixelId : null,
    linkedin: opts.hasMarketingConsent ? tracking.linkedInPartnerId : null,
    params: opts.eventParams,
  };

  const footerLinks: string[] = [];
  if (opts.privacyUrl) {
    footerLinks.push(`<a href="${escapeHtml(opts.privacyUrl)}" rel="noopener">Datenschutz</a>`);
  }
  if (opts.imprintUrl) {
    footerLinks.push(`<a href="${escapeHtml(opts.imprintUrl)}" rel="noopener">Impressum</a>`);
  }

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>Weiterleitung zu ${label} …</title>
<noscript><meta http-equiv="refresh" content="${noscriptDelaySeconds};url=${destHtml}"></noscript>
<style>
:root{color-scheme:light dark}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
background:#fafafa;color:#1a1a1a;min-height:100svh;display:flex;flex-direction:column;
align-items:center;justify-content:center;padding:24px;text-align:center}
@media(prefers-color-scheme:dark){body{background:#111214;color:#f2f2f2}}
.spinner{width:34px;height:34px;border:3px solid rgba(128,128,128,.25);border-top-color:#e47911;
border-radius:50%;animation:spin .8s linear infinite;margin-bottom:20px}
@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:1.15rem;font-weight:600;margin-bottom:8px}
p.hint{font-size:.9rem;color:#6b7280;max-width:26rem;margin-bottom:24px}
@media(prefers-color-scheme:dark){p.hint{color:#9ca3af}}
a.btn{display:inline-block;background:#ffd814;color:#111;font-weight:600;font-size:1rem;
padding:12px 28px;border-radius:999px;text-decoration:none;border:1px solid #f2c200}
a.btn:hover{background:#f7ca00}
a.btn:focus-visible{outline:3px solid #e47911;outline-offset:2px}
footer{position:fixed;bottom:14px;left:0;right:0;font-size:.75rem;color:#9ca3af}
footer a{color:inherit;text-decoration:underline;margin:0 8px}
</style>
</head>
<body>
<div class="spinner" aria-hidden="true"></div>
<h1>Du wirst zu ${label} weitergeleitet …</h1>
<p class="hint">Falls die automatische Weiterleitung nicht startet, nutze bitte den Button.</p>
<a class="btn" id="go" href="${destHtml}">Jetzt zu ${label}</a>
${footerLinks.length > 0 ? `<footer>${footerLinks.join(" · ")}</footer>` : ""}
<script>
(function(){
"use strict";
var C=${jsonForInlineScript(config)};
function beacon(stage){
  try{
    var body=JSON.stringify({token:C.token,stage:stage});
    if(navigator.sendBeacon){
      navigator.sendBeacon("/api/beacon",new Blob([body],{type:"text/plain"}));
    }else{
      fetch("/api/beacon",{method:"POST",body:body,keepalive:true,
        headers:{"Content-Type":"text/plain"}}).catch(function(){});
    }
  }catch(e){}
}
beacon("bridge");

window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
// Google Consent Mode v2: ohne erkannte Einwilligung ist alles "denied".
gtag("consent","default",{
  ad_storage:C.consent?"granted":"denied",
  analytics_storage:C.consent?"granted":"denied",
  ad_user_data:C.consent?"granted":"denied",
  ad_personalization:C.consent?"granted":"denied",
  wait_for_update:0
});
dataLayer.push(Object.assign({event:"amazon_outbound_click"},C.params));

var trackingAttempted=false;
try{
  if(C.gtm){
    trackingAttempted=true;
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({"gtm.start":new Date().getTime(),event:"gtm.js"});
    var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;
    j.src="https://www.googletagmanager.com/gtm.js?id="+i;f.parentNode.insertBefore(j,f);
    })(window,document,"script","dataLayer",C.gtm);
  }
  if(C.ga4){
    trackingAttempted=true;
    var gs=document.createElement("script");gs.async=true;
    gs.src="https://www.googletagmanager.com/gtag/js?id="+C.ga4;
    document.head.appendChild(gs);
    gtag("js",new Date());
    gtag("config",C.ga4,{transport_type:"beacon"});
    gtag("event","amazon_outbound_click",C.params);
  }
  if(C.meta){
    trackingAttempted=true;
    (function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=true;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=true;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,
    "script","https://connect.facebook.net/en_US/fbevents.js"));
    fbq("init",C.meta);
    fbq("track","PageView",{},{eventID:C.params.event_id});
    fbq("trackCustom","AmazonOutboundClick",C.params,{eventID:C.params.event_id});
  }
  if(C.reddit){
    trackingAttempted=true;
    !function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?
    p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];
    var t=d.createElement("script");
    t.src="https://www.redditstatic.com/ads/pixel.js";t.async=!0;
    var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
    rdt("init",C.reddit);
    rdt("track","PageVisit");
    rdt("track","Custom",{customEventName:"OutboundClick",conversionId:C.params.event_id});
  }
  if(C.tiktok){
    trackingAttempted=true;
    !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
    ttq.methods=["page","track","identify","instances","debug","on","off","once","ready",
    "alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
    ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(
    Array.prototype.slice.call(arguments,0)))}};
    for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
    ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)
    ttq.setAndDefer(e,ttq.methods[n]);return e};
    ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
    ttq._o=ttq._o||{};ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript";
    n.async=!0;n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];
    e.parentNode.insertBefore(n,e)}}(window,document,"ttq");
    ttq.load(C.tiktok);
    ttq.page();
    ttq.track("ClickButton",{content_name:C.params.link_name,
    content_category:C.params.source},{event_id:C.params.event_id});
  }
  if(C.linkedin){
    trackingAttempted=true;
    window._linkedin_partner_id=C.linkedin;
    window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];
    window._linkedin_data_partner_ids.push(C.linkedin);
    (function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};
    window.lintrk.q=[]}
    var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");
    b.type="text/javascript";b.async=!0;
    b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";
    s.parentNode.insertBefore(b,s)})(window.lintrk);
  }
}catch(e){}
if(trackingAttempted){beacon("tracking");}

var went=false;
function go(){
  if(went)return;
  went=true;
  beacon("redirect");
  window.location.replace(C.dest);
}
setTimeout(go,C.delay);
var btn=document.getElementById("go");
if(btn){btn.addEventListener("click",function(){went=true;beacon("manual");});}
})();
</script>
</body>
</html>`;
}

export type LinkErrorKind = "not_found" | "inactive" | "expired" | "server_error";

const ERROR_TEXTS: Record<LinkErrorKind, { title: string; message: string; status: number }> = {
  not_found: {
    title: "Link nicht gefunden",
    message: "Dieser Kurzlink existiert nicht. Bitte prüfe die Adresse auf Tippfehler.",
    status: 404,
  },
  inactive: {
    title: "Link nicht mehr aktiv",
    message: "Dieser Kurzlink wurde deaktiviert und leitet nicht mehr weiter.",
    status: 410,
  },
  expired: {
    title: "Link abgelaufen",
    message: "Dieser Kurzlink ist abgelaufen und leitet nicht mehr weiter.",
    status: 410,
  },
  server_error: {
    title: "Etwas ist schiefgelaufen",
    message: "Die Weiterleitung ist momentan nicht möglich. Bitte versuche es später erneut.",
    status: 500,
  },
};

export function getLinkErrorStatus(kind: LinkErrorKind): number {
  return ERROR_TEXTS[kind].status;
}

/** Saubere, neutrale Fehlerseite – es erfolgt bewusst KEINE Weiterleitung. */
export function renderLinkErrorPage(
  kind: LinkErrorKind,
  legal: { privacyUrl: string | null; imprintUrl: string | null },
): string {
  const { title, message } = ERROR_TEXTS[kind];
  const footerLinks: string[] = [];
  if (legal.privacyUrl) {
    footerLinks.push(`<a href="${escapeHtml(legal.privacyUrl)}" rel="noopener">Datenschutz</a>`);
  }
  if (legal.imprintUrl) {
    footerLinks.push(`<a href="${escapeHtml(legal.imprintUrl)}" rel="noopener">Impressum</a>`);
  }
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
background:#fafafa;color:#1a1a1a;min-height:100svh;display:flex;flex-direction:column;
align-items:center;justify-content:center;padding:24px;text-align:center}
@media(prefers-color-scheme:dark){body{background:#111214;color:#f2f2f2}}
h1{font-size:1.3rem;font-weight:600;margin-bottom:10px}
p{font-size:.95rem;color:#6b7280;max-width:28rem}
@media(prefers-color-scheme:dark){p{color:#9ca3af}}
footer{position:fixed;bottom:14px;left:0;right:0;font-size:.75rem;color:#9ca3af}
footer a{color:inherit;text-decoration:underline;margin:0 8px}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
${footerLinks.length > 0 ? `<footer>${footerLinks.join(" · ")}</footer>` : ""}
</body>
</html>`;
}
