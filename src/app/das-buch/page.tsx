import { BookOpen, CalendarDays, ExternalLink, Gift, Music2 } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SpotifyEmbed } from "@/components/buch/spotify-embed";
import { YoutubeFacade } from "@/components/buch/youtube-facade";
import { GewinnTracking } from "@/components/gewinn/gewinn-tracking";
import {
  BUCH_AUTOR,
  BUCH_ERSCHEINT_ISO,
  BUCH_ERSCHEINT_LABEL,
  BUCH_FORMAT_LABEL,
  BUCH_ISBN13,
  BUCH_PREIS_LABEL,
  BUCH_PREIS_SCHEMA,
  BUCH_TITEL,
  BUCH_UNTERTITEL,
  BUCH_URL,
  BUCH_VERLAG,
  SONG_TITEL,
  SPOTIFY_TRACK_URL,
  YOUTUBE_VIDEO_ID,
} from "@/lib/buch-config";
import { getEnv } from "@/lib/env";
import {
  AMAZON_PRODUCT_URL,
  CONTACT_EMAIL,
  PRIZE_VALUE_LABEL,
  RETAILERS,
  TRIP_DURATION_LABEL,
} from "@/lib/gewinnspiel-config";

export const dynamic = "force-dynamic";

/**
 * Landingpage für Display-Ads (web.de / gmx.de): Buch + Autor + Musikvideo
 * + Song, Gewinnspiel als sekundärer Hinweis mit Link auf /gewinn.
 * Designsprache identisch zur Gewinnspiel-Seite (gewinn-theme).
 */

export const metadata: Metadata = {
  // absolute: entkommt dem "%s · TRACK.SITE"-Template des Root-Layouts
  title: { absolute: "Die Lizenz zum Erfolg – Das Buch von Soheil Hosseini" },
  description:
    "„Die Lizenz zum Erfolg – Business ohne Plan, Ausreden oder Kompromisse“ von Soheil Hosseini: eine David-gegen-Goliath-Geschichte. Jetzt Musikvideo ansehen und das Buch bei Amazon sichern.",
  alternates: { canonical: BUCH_URL },
  // PFLICHT: Das Root-Layout setzt noindex – Ads-Landingpage ist indexierbar.
  robots: { index: true, follow: true },
  openGraph: {
    title: "Die Lizenz zum Erfolg – Das Buch von Soheil Hosseini",
    description:
      "Eine David-gegen-Goliath-Geschichte – mit eigenem Song und Musikvideo. Jetzt das Buch bei Amazon sichern.",
    url: BUCH_URL,
    siteName: "Die Lizenz zum Erfolg",
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: `${BUCH_URL}/og.png`,
        width: 1200,
        height: 630,
        alt: "Die Lizenz zum Erfolg – das Buch von Soheil Hosseini",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [`${BUCH_URL}/og.png`],
  },
};

/** Strukturierte Daten (nur belegte Fakten). */
const BOOK_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Book",
  name: BUCH_TITEL,
  alternativeHeadline: BUCH_UNTERTITEL,
  author: { "@type": "Person", name: BUCH_AUTOR },
  publisher: { "@type": "Organization", name: BUCH_VERLAG },
  datePublished: BUCH_ERSCHEINT_ISO,
  bookFormat: "https://schema.org/Paperback",
  isbn: BUCH_ISBN13,
  inLanguage: "de",
  image: "https://lizenzzumerfolg.com/gewinn/buchcover.jpg",
  offers: {
    "@type": "Offer",
    price: BUCH_PREIS_SCHEMA,
    priceCurrency: "EUR",
    url: AMAZON_PRODUCT_URL,
    availability: "https://schema.org/PreOrder",
  },
};

const GOLD_CTA =
  "inline-flex min-h-[52px] items-center justify-center rounded-xl bg-gradient-to-b from-[var(--gw-gold-strong)] to-[var(--gw-gold-deep)] px-7 py-3.5 text-base font-semibold text-[#181207] shadow-lg shadow-black/40 outline-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--gw-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gw-bg)]";

const SECONDARY_CTA =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border gw-hairline bg-white/[0.04] px-6 py-3 text-sm font-semibold text-[var(--gw-ink)] outline-none hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[var(--gw-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gw-bg)]";

function SectionHeading({
  kicker,
  title,
  intro,
}: {
  kicker: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold tracking-[0.25em] text-[var(--gw-gold)] uppercase">
        {kicker}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[var(--gw-ink)] sm:text-4xl">
        {title}
      </h2>
      {intro ? <p className="mt-4 text-[var(--gw-ink-soft)]">{intro}</p> : null}
    </div>
  );
}

export default async function DasBuchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // UTM-Parameter der Anzeige an den Gewinnspiel-Link weiterreichen,
  // damit die Attribution bis ins Teilnahmeformular erhalten bleibt.
  const params = await searchParams;
  const utm = Object.fromEntries(
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
      .map((k) => [k, typeof params[k] === "string" ? (params[k] as string).slice(0, 120) : ""])
      .filter(([, v]) => v),
  ) as Record<string, string>;
  const utmQuery = new URLSearchParams(utm).toString();
  const gewinnHref = utmQuery ? `/gewinn?${utmQuery}` : "/gewinn";

  const env = getEnv();
  const contactIsPlaceholder = CONTACT_EMAIL.startsWith("[");

  return (
    <div className="gewinn-theme min-h-screen">
      {/* Entscheidung des Betreibers (Wiresoft Portal Ltd., 28.08.2026),
          identisch zu /gewinn: Tracking auf dieser Kampagnenseite lädt OHNE
          Consent-Gate ("not-required"). Ein eigenes Consent-Banner wird
          extern ergänzt – danach hier wieder env.TRACKING_CONSENT_MODE
          übergeben, dann greift der Cookie-Check erneut (und die Embeds
          in components/buch/* mitgaten). */}
      <GewinnTracking
        gtmContainerId={env.GTM_CONTAINER_ID ?? null}
        ga4MeasurementId={env.GA4_MEASUREMENT_ID ?? null}
        metaPixelId={env.META_PIXEL_ID ?? null}
        tiktokPixelId={env.TIKTOK_PIXEL_ID ?? null}
        redditPixelId={env.REDDIT_PIXEL_ID ?? null}
        linkedInPartnerId={env.LINKEDIN_PARTNER_ID ?? null}
        consentMode="not-required"
        consentCookieName={env.CONSENT_COOKIE_NAME ?? null}
        consentAcceptedValue={env.CONSENT_COOKIE_ACCEPTED_VALUE ?? null}
        pageEventName="buch_seite"
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BOOK_JSON_LD) }}
      />

      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[var(--gw-gold)] focus:px-4 focus:py-2 focus:text-[#181207]"
      >
        Zum Inhalt springen
      </a>

      <main id="inhalt">
        {/* ---------------------------------------------------------------- */}
        {/* 1 · Hero                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative overflow-hidden" aria-labelledby="hero-heading">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 45% at 75% 0%, rgba(214,178,111,0.14) 0%, transparent 60%), radial-gradient(50% 40% at 10% 100%, rgba(214,178,111,0.07) 0%, transparent 60%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-y-9 px-5 pt-12 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_auto] lg:gap-x-20 lg:gap-y-7 lg:pt-20 lg:pb-24">
            <div className="gw-fade lg:col-start-1 lg:row-start-1">
              <p className="inline-flex items-center gap-2 rounded-full border gw-hairline bg-white/[0.04] px-4 py-1.5 text-xs font-medium tracking-wide text-[var(--gw-ink-soft)]">
                <CalendarDays className="h-3.5 w-3.5 text-[var(--gw-gold)]" aria-hidden="true" />
                Neuerscheinung · erscheint am {BUCH_ERSCHEINT_LABEL}
              </p>
              <h1
                id="hero-heading"
                className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
              >
                Die Lizenz <span className="gw-gold-text">zum Erfolg</span>
              </h1>
              <p className="mt-4 text-xl font-medium text-[var(--gw-ink)]">{BUCH_UNTERTITEL}.</p>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--gw-ink-soft)]">
                Das neue Buch von{" "}
                <strong className="font-semibold text-[var(--gw-ink)]">{BUCH_AUTOR}</strong> – die
                David-gegen-Goliath-Geschichte eines Außenseiters, der sich nicht geschlagen
                gibt. Das Musikvideo bringt sie auf den Punkt.
              </p>
            </div>

            {/* 3D-Buchcover (LCP-Kandidat: priority, ohne Einblend-Verzögerung) */}
            <div className="mx-auto w-52 pr-3 sm:w-60 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:w-full lg:self-center lg:pr-6">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-8 rounded-[2.5rem] bg-[radial-gradient(closest-side,rgba(214,178,111,0.2),transparent)]"
                />
                <div className="gw-book relative">
                  <div className="gw-book-core">
                    <Image
                      src="/gewinn/buchcover.jpg"
                      alt={`Buchcover: ${BUCH_TITEL} von ${BUCH_AUTOR}`}
                      width={700}
                      height={1115}
                      priority
                      sizes="(min-width: 1024px) 380px, (min-width: 640px) 240px, 208px"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="gw-fade lg:col-start-1 lg:row-start-2">
              <ul className="flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-[var(--gw-ink-soft)]">
                {[BUCH_FORMAT_LABEL, BUCH_PREIS_LABEL, BUCH_VERLAG].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[var(--gw-gold)]"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col gap-4 sm:items-start">
                <a
                  href={AMAZON_PRODUCT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-gw-event="buch_amazon_klick"
                  className={GOLD_CTA}
                >
                  Jetzt Buch bei Amazon sichern
                </a>
                <a
                  href="#musikvideo"
                  data-gw-event="buch_video_scroll"
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 self-center text-sm font-medium text-[var(--gw-ink-soft)] underline decoration-[var(--gw-gold)]/40 underline-offset-4 outline-none hover:text-[var(--gw-gold-strong)] focus-visible:ring-2 focus-visible:ring-[var(--gw-gold)] sm:self-start"
                >
                  <Music2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Musikvideo ansehen
                </a>
              </div>

              {/* Vertrauenssiegel: das Buch gibt es im gesamten Buchhandel */}
              <div className="mt-9 border-t gw-hairline pt-6">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-[var(--gw-ink-mute)] uppercase">
                  Erhältlich bei
                </p>
                <ul className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                  {RETAILERS.filter((r) => r.id !== "other").map((retailer) => (
                    <li
                      key={retailer.id}
                      className="rounded-lg border gw-hairline bg-white/[0.03] px-3.5 py-1.5 text-sm font-semibold tracking-wide text-[var(--gw-ink-soft)]"
                    >
                      {retailer.label}
                    </li>
                  ))}
                  <li className="pl-1 text-sm text-[var(--gw-ink-mute)]">
                    … und im Buchhandel vor Ort
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 2 · Musikvideo & Song                                             */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="musikvideo"
          className="scroll-mt-8 border-y gw-hairline bg-[var(--gw-bg-soft)]"
        >
          <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:py-20">
            <SectionHeading
              kicker="Reinhören & reinschauen"
              title="Das Musikvideo zum Buch"
              intro="Zum Buch gehört ein eigener Song – das Video zeigt dir in wenigen Minuten, wofür „Die Lizenz zum Erfolg“ steht."
            />
            <div className="mt-10">
              <YoutubeFacade
                videoId={YOUTUBE_VIDEO_ID}
                title={`Musikvideo: ${SONG_TITEL} – ${BUCH_AUTOR}`}
                posterSrc="/das-buch/video-poster.jpg"
                posterWidth={1280}
                posterHeight={720}
                eventName="buch_video_play"
              />
            </div>
            <div className="mx-auto mt-8 max-w-xl">
              <SpotifyEmbed title={`Spotify-Player: ${SONG_TITEL} – ${BUCH_AUTOR}`} />
              <p className="mt-3 text-center text-sm text-[var(--gw-ink-mute)]">
                <a
                  href={SPOTIFY_TRACK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-gw-event="buch_spotify_klick"
                  className="underline decoration-[var(--gw-gold)]/40 underline-offset-4 hover:text-[var(--gw-gold-strong)]"
                >
                  Song auf Spotify öffnen
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 3 · Über das Buch                                                 */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 lg:py-20">
            <SectionHeading
              kicker="Die Geschichte"
              title="David gegen Goliath"
              intro="Business ohne Plan, Ausreden oder Kompromisse – die Geschichte hinter „Die Lizenz zum Erfolg“."
            />
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
              <div className="space-y-4 text-lg leading-relaxed text-[var(--gw-ink-soft)]">
                <p>
                  Auf der einen Seite: die Giganten einer Branche – mit großen Budgets, großen
                  Namen und besten Beziehungen. Auf der anderen: ein Einzelner mit nichts als
                  einer Idee und der Entscheidung, sie durchzuziehen.
                </p>
                <p>
                  „{BUCH_TITEL}“ ist die David-gegen-Goliath-Geschichte von {BUCH_AUTOR}: der Weg
                  eines Außenseiters, der sich weigert aufzugeben – ohne Plan&nbsp;B, ohne
                  Ausreden, ohne Kompromisse. Mit jedem Rückschlag, jeder Ohrfeige des Marktes
                  und dem Moment, in dem sich das Blatt wendet.
                </p>
                <p>
                  Wie es ausgeht? Das erzählt dir das Buch. Den Vorgeschmack liefert der Song –
                  danach willst du die ganze Geschichte.
                </p>
                <a
                  href={AMAZON_PRODUCT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-gw-event="buch_amazon_klick"
                  className={SECONDARY_CTA}
                >
                  Buch bei Amazon sichern
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <dl className="h-fit rounded-2xl border gw-hairline bg-[var(--gw-surface)] p-6 text-sm">
                <div className="flex items-center gap-2 text-[var(--gw-gold)]">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs font-semibold tracking-[0.2em] uppercase">
                    Auf einen Blick
                  </span>
                </div>
                {[
                  ["Titel", BUCH_TITEL],
                  ["Untertitel", BUCH_UNTERTITEL],
                  ["Autor", BUCH_AUTOR],
                  ["Format", BUCH_FORMAT_LABEL],
                  ["Preis", BUCH_PREIS_LABEL],
                  ["Verlag", BUCH_VERLAG],
                  ["Erscheint am", BUCH_ERSCHEINT_LABEL],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="mt-3 flex items-baseline justify-between gap-4 border-b gw-hairline pb-2 last:border-b-0"
                  >
                    <dt className="shrink-0 text-[var(--gw-ink-mute)]">{label}</dt>
                    <dd className="min-w-0 text-right font-medium text-[var(--gw-ink)]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 4 · Über den Autor                                                */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="autor-heading"
          className="border-y gw-hairline bg-[var(--gw-bg-soft)]"
        >
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-14 lg:py-20">
            <div className="mx-auto hidden w-52 lg:block lg:w-full">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-4 rounded-[1.75rem] bg-[radial-gradient(closest-side,rgba(214,178,111,0.16),transparent)]"
                />
                <Image
                  src="/gewinn/autor.jpg"
                  alt={`${BUCH_AUTOR}, Autor von „${BUCH_TITEL}“`}
                  width={859}
                  height={1280}
                  sizes="260px"
                  className="relative rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/10"
                />
              </div>
            </div>
            <figure className="relative">
              <span
                aria-hidden="true"
                className="absolute -top-8 -left-2 font-serif text-[7rem] leading-none text-[var(--gw-gold)]/20 select-none"
              >
                „
              </span>
              <h2
                id="autor-heading"
                className="text-2xl font-semibold tracking-tight text-[var(--gw-ink)] sm:text-3xl"
              >
                Über den Autor
              </h2>
              <blockquote className="mt-6 space-y-4 text-lg leading-relaxed text-[var(--gw-ink-soft)]">
                <p>
                  {BUCH_AUTOR} ist der Autor von „{BUCH_TITEL}“. Mit dem Buch – und dem
                  gleichnamigen Song – erzählt er seine Geschichte und die Idee dahinter.
                </p>
                <p>„Dass du meinem Buch dein Vertrauen schenkst, bedeutet mir sehr viel.“</p>
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-4">
                <Image
                  src="/gewinn/autor.jpg"
                  alt=""
                  aria-hidden="true"
                  width={112}
                  height={167}
                  sizes="56px"
                  className="w-14 rounded-xl shadow-lg shadow-black/50 ring-1 ring-white/10 lg:hidden"
                />
                <div>
                  <p className="font-semibold text-[var(--gw-ink)]">{BUCH_AUTOR}</p>
                  <p className="text-sm text-[var(--gw-ink-mute)]">Autor</p>
                </div>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 5 · Gewinnspiel-Hinweis (sekundär)                                */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="gewinn-heading">
          <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
            <div className="rounded-2xl border border-[var(--gw-gold)]/45 bg-gradient-to-b from-[var(--gw-surface-2)] to-[var(--gw-surface)] p-7 text-center sm:p-9">
              <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.25em] text-[var(--gw-gold)] uppercase">
                <Gift className="h-4 w-4" aria-hidden="true" />
                Zum Buch gehört ein Gewinnspiel
              </p>
              <h2
                id="gewinn-heading"
                className="mt-3 text-xl font-semibold tracking-tight text-[var(--gw-ink)] sm:text-2xl"
              >
                Buch bestellen und zusätzlich gewinnen
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[var(--gw-ink-soft)]">
                Wer das Buch bestellt und die Bestellung registriert, nimmt an der Verlosung
                einer {TRIP_DURATION_LABEL}-Reise nach Dubai für zwei Personen im Wert von{" "}
                {PRIZE_VALUE_LABEL} teil.
              </p>
              <Link
                href={gewinnHref}
                data-gw-event="buch_gewinnspiel_klick"
                className={`${SECONDARY_CTA} mt-6`}
              >
                Zum Gewinnspiel
              </Link>
              <p className="mt-4 text-xs text-[var(--gw-ink-mute)]">
                Alle Details und Teilnahmebedingungen auf der Gewinnspielseite.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 6 · Finale                                                        */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="final-heading" className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(55% 60% at 50% 100%, rgba(214,178,111,0.13) 0%, transparent 65%)",
            }}
          />
          <div className="relative mx-auto max-w-3xl px-5 pt-6 pb-20 text-center sm:px-8 lg:pb-28">
            <h2
              id="final-heading"
              className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              Sichere dir <span className="gw-gold-text">dein Exemplar</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--gw-ink-soft)]">
              „{BUCH_TITEL}“ erscheint am {BUCH_ERSCHEINT_LABEL}. Sichere dir dein Exemplar jetzt
              – und gehöre zu den Ersten, die die ganze Geschichte kennen.
            </p>
            <a
              href={AMAZON_PRODUCT_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-gw-event="buch_amazon_klick"
              className={`${GOLD_CTA} mt-8 px-8`}
            >
              Jetzt mein Exemplar sichern
            </a>
            <p className="mt-4 text-sm text-[var(--gw-ink-mute)]">
              {BUCH_FORMAT_LABEL} · {BUCH_PREIS_LABEL} · {BUCH_VERLAG}
            </p>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t gw-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 text-sm text-[var(--gw-ink-mute)] sm:flex-row sm:px-8">
          <p>„{BUCH_TITEL}“ · {BUCH_AUTOR}</p>
          <nav
            aria-label="Rechtliches"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          >
            {env.IMPRINT_URL ? (
              <a
                href={env.IMPRINT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--gw-ink)]"
              >
                Impressum
              </a>
            ) : null}
            {env.PRIVACY_URL ? (
              <a
                href={env.PRIVACY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--gw-ink)]"
              >
                Datenschutzerklärung
              </a>
            ) : null}
            <Link href={gewinnHref} className="hover:text-[var(--gw-ink)]">
              Gewinnspiel
            </Link>
            {contactIsPlaceholder ? (
              <span title="Kontaktadresse wird vor Veröffentlichung ergänzt">Kontakt</span>
            ) : (
              <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-[var(--gw-ink)]">
                Kontakt
              </a>
            )}
          </nav>
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
          <p className="text-center text-xs text-[var(--gw-ink-mute)] sm:text-left">
            Als Amazon-Partner verdienen wir an qualifizierten Verkäufen.
          </p>
        </div>
      </footer>
    </div>
  );
}
