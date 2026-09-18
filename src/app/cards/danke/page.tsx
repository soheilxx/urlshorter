import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CardsDanke } from "@/components/cards/cards-danke";
import { GewinnTracking } from "@/components/gewinn/gewinn-tracking";
import { createBookConversionConfig } from "@/lib/book-conversion-context";
import { BUCH_TITEL } from "@/lib/buch-config";
import {
  CARDS_CAMPAIGN_ID,
  CARDS_ENTRY_PATH,
  CARDS_SHARE_TEXT,
  CARDS_SHARE_TEXT_CLOSED,
  CARDS_URL,
  getCardsPhase,
} from "@/lib/cards-giveaway-config";
import { CARDS_RECEIPT_COOKIE, verifyCardsReceipt } from "@/lib/cards-receipt";
import { getEnv } from "@/lib/env";
import { createRedditTrackingConfig } from "@/lib/reddit-context";

/**
 * Bestätigungsseite /cards/danke.
 *
 * Wird ausschließlich über das kurzlebige, signierte Receipt-Cookie der
 * Cards-Server-Action freigeschaltet (kein ?success=true, nichts in der URL).
 * Ohne gültiges Receipt erscheint ein neutraler Hinweis. noindex + no-store
 * (next.config.ts); nicht in Share-Links. Tracking (GA4/Meta/TikTok/Reddit)
 * läuft wie auf /cards ohne Consent-Gate (Betreiberentscheidung); das
 * Registrierungsevent feuert der Client-Teil nur einmal je Vorgang.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: `Anmeldung eingegangen · Cards-Gewinnspiel | ${BUCH_TITEL}` },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: CARDS_URL },
};

export default async function CardsDankePage() {
  const jar = await cookies();
  const receipt = verifyCardsReceipt(jar.get(CARDS_RECEIPT_COOKIE)?.value);
  const env = getEnv();
  const open = getCardsPhase() === "open";
  const shareText = open ? CARDS_SHARE_TEXT : CARDS_SHARE_TEXT_CLOSED;

  return (
    <div className="cards-theme min-h-screen">
      {receipt ? (
        <GewinnTracking
          gtmContainerId={env.GTM_CONTAINER_ID ?? null}
          ga4MeasurementId={env.GA4_MEASUREMENT_ID ?? null}
          metaPixelId={env.META_PIXEL_ID ?? null}
          tiktokPixelId={env.TIKTOK_PIXEL_ID ?? null}
          redditPixelId={env.REDDIT_PIXEL_ID ?? null}
          redditTracking={createRedditTrackingConfig("/cards/danke", "not-required")}
          bookConversion={await createBookConversionConfig("/cards/danke", "not-required", {
            eventParams: { giveaway_campaign: CARDS_CAMPAIGN_ID },
          })}
          linkedInPartnerId={env.LINKEDIN_PARTNER_ID ?? null}
          consentMode="not-required"
          consentCookieName={env.CONSENT_COOKIE_NAME ?? null}
          consentAcceptedValue={env.CONSENT_COOKIE_ACCEPTED_VALUE ?? null}
          pageEventName="cards_danke_seite"
          eventParams={{ giveaway_campaign: CARDS_CAMPAIGN_ID, landing_path: CARDS_ENTRY_PATH }}
        />
      ) : null}
      <header className="border-b border-[var(--cd-border-soft)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-8">
          <Link
            href={CARDS_ENTRY_PATH}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[var(--cd-ink-soft)] hover:text-[var(--cd-ink)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Zurück zum Cards-Gewinnspiel
          </Link>
          <span className="rounded-md border border-[var(--cd-border)] px-2 py-0.5 text-[11px] font-semibold tracking-[0.18em] text-[var(--cd-gold)] uppercase">
            TCG-Gewinnspiel
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8 lg:py-16">
        {receipt ? (
          <CardsDanke
            referenceNumber={receipt.referenceNumber}
            trackingEventId={receipt.trackingEventId}
            nonce={receipt.nonce}
            persisted={receipt.persisted}
            shareText={shareText}
          />
        ) : (
          <section
            data-testid="cards-kein-vorgang"
            className="cd-holo rounded-3xl bg-[var(--cd-surface)] p-6 text-center sm:p-10"
          >
            <h1 className="cd-display text-2xl font-semibold text-[var(--cd-ink)] sm:text-3xl">
              Kein aktueller Vorgang
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[var(--cd-ink-soft)]">
              Diese Bestätigungsseite wird nur direkt nach einer Registrierung im Cards-Gewinnspiel
              angezeigt. Wenn du gerade teilgenommen hast, findest du deine Teilnahme-Referenz in
              der Bestätigung nach dem Absenden.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={CARDS_ENTRY_PATH}
                className="cd-btn-gold inline-flex min-h-[48px] items-center justify-center px-5 text-sm font-semibold"
              >
                Zum Cards-Gewinnspiel
              </Link>
              {open ? (
                <Link
                  href={`${CARDS_ENTRY_PATH}#teilnehmen`}
                  className="cd-btn-outline inline-flex min-h-[48px] items-center justify-center px-5 text-sm font-semibold"
                >
                  Bestellnummer eintragen
                </Link>
              ) : null}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
