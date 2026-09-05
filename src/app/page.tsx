import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { classifyRequest } from "@/lib/bot-detection";
import { DelayedRedirect } from "@/components/gewinn/delayed-redirect";
import { GewinnTracking } from "@/components/gewinn/gewinn-tracking";
import { getEnv } from "@/lib/env";
import { createRedditTrackingConfig } from "@/lib/reddit-context";
import { getRedirectDelayMs } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Startseite: kurze Tracking-Zwischenseite, danach Weiterleitung zur
 * Hauptseite (ROOT_REDIRECT_URL, Standard: soheil-hosseini.de).
 *
 * - Menschen: Marketing-Pixel laden (gleiche Betreiber-Entscheidung wie
 *   /gewinn: ohne Consent-Gate), Event "weiterleitung_hauptseite", dann
 *   clientseitiger Redirect nach der im Dashboard einstellbaren Verzögerung.
 * - Bots/Crawler/Link-Previews: direkter Server-Redirect wie bisher.
 * - Ohne JavaScript: noscript-Meta-Refresh + sichtbarer Link.
 */
export default async function RootPage() {
  const env = getEnv();
  const targetUrl = env.ROOT_REDIRECT_URL;

  const h = await headers();
  const bot = classifyRequest({
    method: "GET",
    userAgent: h.get("user-agent"),
    purposeHeader: h.get("purpose"),
    secPurposeHeader: h.get("sec-purpose"),
  });
  if (bot.isBot) redirect(targetUrl);

  const delayMs = await getRedirectDelayMs();

  return (
    <div className="gewinn-theme flex min-h-screen items-center justify-center px-5">
      <GewinnTracking
        gtmContainerId={env.GTM_CONTAINER_ID ?? null}
        ga4MeasurementId={env.GA4_MEASUREMENT_ID ?? null}
        metaPixelId={env.META_PIXEL_ID ?? null}
        tiktokPixelId={env.TIKTOK_PIXEL_ID ?? null}
        redditPixelId={env.REDDIT_PIXEL_ID ?? null}
        redditTracking={createRedditTrackingConfig("/", "not-required")}
        linkedInPartnerId={env.LINKEDIN_PARTNER_ID ?? null}
        consentMode="not-required"
        consentCookieName={env.CONSENT_COOKIE_NAME ?? null}
        consentAcceptedValue={env.CONSENT_COOKIE_ACCEPTED_VALUE ?? null}
        pageEventName="weiterleitung_hauptseite"
      />
      <DelayedRedirect url={targetUrl} delayMs={delayMs} />
      <noscript>
        <meta httpEquiv="refresh" content={`1;url=${targetUrl}`} />
      </noscript>

      <main className="text-center">
        <p className="text-sm font-semibold tracking-[0.25em] text-[var(--gw-gold)] uppercase">
          Die Lizenz zum Erfolg
        </p>
        <div
          aria-hidden="true"
          className="mx-auto mt-8 h-10 w-10 animate-spin rounded-full border-2 border-[var(--gw-border)] border-t-[var(--gw-gold)]"
        />
        <h1 className="mt-8 text-xl font-semibold text-[var(--gw-ink)]">
          Du wirst weitergeleitet …
        </h1>
        <p className="mt-3 text-sm text-[var(--gw-ink-mute)]">
          Falls nichts passiert:{" "}
          <a
            href={targetUrl}
            className="underline decoration-[var(--gw-gold)]/40 underline-offset-4 hover:text-[var(--gw-gold-strong)]"
          >
            Weiter zu soheil-hosseini.de
          </a>
        </p>
      </main>
    </div>
  );
}
