"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { trackGewinnEvent } from "@/lib/gewinn-analytics";
import { BookConversionTracking } from "@/components/book-conversion-tracking";
import { RedditTracking } from "@/components/reddit-tracking";
import type { BookConversionConfig } from "@/lib/book-conversion-events";
import type { RedditTrackingConfig } from "@/lib/reddit-events";

/**
 * Marketing-Tracking der Gewinnspielseite – identische Pixel-Konfiguration
 * wie die Bridge-Page (Env-Variablen), aber DSGVO-strikt:
 *
 * - Consent-Modus "required": Drittanbieter-Skripte laden NUR, wenn der
 *   Consent-Cookie der Domain die Marketing-Einwilligung belegt. Ohne
 *   Einwilligung wird überhaupt nichts geladen.
 * - Es werden ausschließlich nicht-personenbezogene Events übermittelt
 *   (Klicks auf CTAs, erfolgreiche Registrierung – nie Formulardaten).
 *
 * Klick-Events werden delegiert über data-gw-event-Attribute erfasst.
 */

export interface GewinnTrackingConfig {
  gtmContainerId: string | null;
  ga4MeasurementId: string | null;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  redditPixelId: string | null;
  redditTracking?: RedditTrackingConfig | null;
  /**
   * Meta/TikTok/LinkedIn Pixel + Conversion-APIs mit Event-Deduplizierung
   * (PageView + AddToCart für Amazon-Klicks). Übernimmt Bootstrap und Init
   * von Meta- und TikTok-Pixel – die statischen gw-meta/gw-tiktok-Skripte
   * werden dann nicht zusätzlich gerendert.
   */
  bookConversion?: BookConversionConfig | null;
  linkedInPartnerId: string | null;
  consentMode: string;
  consentCookieName: string | null;
  consentAcceptedValue: string | null;
  /** Seiten-Event im dataLayer (Standard: gewinnspiel_seite). */
  pageEventName?: string;
}

function hasMarketingConsent(config: GewinnTrackingConfig): boolean {
  if (config.consentMode === "not-required") return true;
  if (!config.consentCookieName || !config.consentAcceptedValue) return false;
  return document.cookie.split(";").some((part) => {
    const [name, ...rest] = part.trim().split("=");
    return (
      name === config.consentCookieName &&
      decodeURIComponent(rest.join("=")) === config.consentAcceptedValue
    );
  });
}

export function GewinnTracking(config: GewinnTrackingConfig) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(hasMarketingConsent(config));
    // config ist ein statisches Server-Prop-Objekt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Delegierte Klick-Events (data-gw-event) – nur mit Einwilligung aktiv.
  useEffect(() => {
    if (!allowed) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const el = target?.closest?.("[data-gw-event]");
      const name = el?.getAttribute("data-gw-event");
      if (name) trackGewinnEvent(name);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [allowed]);

  const anyConfigured = Boolean(
    config.gtmContainerId ||
      config.ga4MeasurementId ||
      config.metaPixelId ||
      config.tiktokPixelId ||
      config.redditPixelId ||
      config.linkedInPartnerId ||
      config.bookConversion,
  );
  if (!allowed || !anyConfigured) return null;

  return (
    <>
      {/* dataLayer + Google Consent Mode v2 (Einwilligung liegt vor) */}
      <Script id="gw-consent" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {ad_storage:'granted', ad_user_data:'granted', ad_personalization:'granted', analytics_storage:'granted'});
dataLayer.push({event:'${config.pageEventName ?? "gewinnspiel_seite"}'});`}
      </Script>

      {config.gtmContainerId ? (
        <Script id="gw-gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${config.gtmContainerId}');`}
        </Script>
      ) : null}

      {!config.gtmContainerId && config.ga4MeasurementId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4MeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="gw-ga4" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${config.ga4MeasurementId}');`}
          </Script>
        </>
      ) : null}

      {config.bookConversion ? <BookConversionTracking config={config.bookConversion} /> : null}

      {config.metaPixelId && !config.bookConversion ? (
        <Script id="gw-meta" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${config.metaPixelId}');
fbq('track', 'PageView');`}
        </Script>
      ) : null}

      {config.tiktokPixelId && !config.bookConversion ? (
        <Script id="gw-tiktok" strategy="afterInteractive">
          {`!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${config.tiktokPixelId}');
ttq.page();
}(window, document, 'ttq');`}
        </Script>
      ) : null}

      {config.redditTracking ? (
        <RedditTracking config={config.redditTracking} />
      ) : config.redditPixelId ? (
        <Script id="gw-reddit" strategy="afterInteractive">
          {`!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
rdt('init', '${config.redditPixelId}');
rdt('track', 'PageVisit');`}
        </Script>
      ) : null}

      {config.linkedInPartnerId ? (
        <Script id="gw-linkedin" strategy="afterInteractive">
          {`window._linkedin_partner_id = '${config.linkedInPartnerId}';
window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
window._linkedin_data_partner_ids.push(window._linkedin_partner_id);
(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s)})(window.lintrk);`}
        </Script>
      ) : null}
    </>
  );
}
