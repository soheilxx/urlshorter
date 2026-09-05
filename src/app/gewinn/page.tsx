import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  Gem,
  Handshake,
  HeartHandshake,
  Hotel,
  PartyPopper,
  Plane,
  UtensilsCrossed,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DubaiSkyline } from "@/components/gewinn/dubai-skyline";
import { EntryForm } from "@/components/gewinn/entry-form";
import { GewinnTracking } from "@/components/gewinn/gewinn-tracking";
import { getEnv } from "@/lib/env";
import { createBookConversionConfig } from "@/lib/book-conversion-context";
import {
  SPENDEN_HINWEIS,
  SPENDEN_WIRKUNG,
} from "@/lib/buch-config";
import { createRedditTrackingConfig } from "@/lib/reddit-context";
import {
  AMAZON_PRODUCT_URL,
  ANNOUNCEMENT_DATETIME_LABEL,
  ENTRY_DEADLINE_LABEL,
  CONTACT_EMAIL,
  GEWINN_URL,
  getSweepstakesPhase,
  PRIZE_VALUE_LABEL,
  SECONDARY_PRIZE_EXAMPLES_LABEL,
  SECONDARY_PRIZE_SHOP_NAME,
  SECONDARY_PRIZE_SHOP_URL,
  SECONDARY_PRIZES,
  SECONDARY_PRIZES_COUNT,
  SECONDARY_PRIZES_TOTAL_LABEL,
  TRIP_DURATION_LABEL,
  type SweepstakesPhase,
} from "@/lib/gewinnspiel-config";
import { createFormToken } from "@/lib/sweepstakes-crypto";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Dubai-Reise gewinnen | Die Lizenz zum Erfolg" },
  description:
    "Buch bestellen, Dubai-Reise im Wert von 20.000 € und 100 Wiresoft-Gutscheine gewinnen. Die gesamten Einnahmen des Autors aus diesem Buch fließen an den Kinderschutzbund.",
  alternates: { canonical: GEWINN_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Dubai-Reise gewinnen | Die Lizenz zum Erfolg",
    description:
      "Registriere deine Bestellung von „Die Lizenz zum Erfolg“ und sichere dir die Chance auf eine exklusive 5-tägige Dubai-Reise für zwei Personen im Wert von 20.000 € – dazu 100 Wertgutscheine für den Wiresoft Software Shop.",
    url: GEWINN_URL,
    siteName: "Die Lizenz zum Erfolg",
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: `${GEWINN_URL}/og-v2.png`,
        width: 1200,
        height: 630,
        alt: "Gewinne 5 Tage Dubai für zwei – Gewinnspiel zum Buch „Die Lizenz zum Erfolg“",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dubai-Reise gewinnen | Die Lizenz zum Erfolg",
    description:
      "Buchbestellung registrieren und die Chance auf eine exklusive 5-tägige Dubai-Reise für zwei Personen im Wert von 20.000 € sichern – dazu 100 Wertgutscheine für den Wiresoft Software Shop.",
    images: [`${GEWINN_URL}/og-v2.png`],
  },
};

const PRIZE_ITEMS = [
  {
    icon: Plane,
    title: "Emirates Business Class",
    text: "Hin- und Rückflug für zwei Personen in der Emirates Business Class.",
  },
  {
    icon: Hotel,
    title: "5-Sterne-Designerhotel",
    text: "Fünf Tage Aufenthalt in einem exklusiven Designerhotel in Dubai.",
  },
  {
    icon: Gem,
    title: "Suite für zwei Personen",
    text: "Unterbringung in einer hochwertigen Suite.",
  },
  {
    icon: UtensilsCrossed,
    title: "Exklusives Dinner",
    text: "Dinner für zwei Personen in einem der angesagtesten Restaurants Dubais.",
  },
  {
    icon: Handshake,
    title: "Persönliches Meet & Greet",
    text: "Auf Wunsch persönliches Kennenlernen und Treffen mit Soheil Hosseini.",
  },
] as const;

const FAQ_ITEMS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Wer darf am Gewinnspiel teilnehmen?",
    a: "Teilnehmen können Personen ab 18 Jahren mit Wohnsitz in Deutschland, Österreich oder der Schweiz, die „Die Lizenz zum Erfolg“ bestellt und ihre Bestellung auf dieser Seite registriert haben. Details regeln die Teilnahmebedingungen.",
  },
  {
    q: "Welche Bestellnummer muss ich eintragen?",
    a: "Die Bestell- bzw. Auftragsnummer aus deiner Bestellbestätigung des Händlers, bei dem du das Buch bestellt hast – bei Amazon z. B. eine Nummer im Format 306-1234567-1234567.",
  },
  {
    q: "Bei welchen Händlern darf das Buch bestellt werden?",
    a: "Bei Amazon, Thalia, Hugendubel, bücher.de sowie jedem anderen Händler, der das Buch führt – wähle dafür im Formular „Anderer Händler“ und trage den Namen ein.",
  },
  {
    q: "Darf ich eine Begleitperson mitnehmen?",
    a: "Ja. Die Reise gilt für die Gewinnerin oder den Gewinner und eine frei wählbare Begleitperson.",
  },
  {
    q: "Was genau ist im Hauptgewinn enthalten?",
    a: "Eine 5-tägige Dubai-Reise: Hin- und Rückflug mit Emirates in der Business Class, Aufenthalt in einem exklusiven 5-Sterne-Designerhotel in einer Suite, ein Dinner für zwei Personen in einem der angesagtesten Restaurants Dubais sowie auf Wunsch ein persönliches Meet & Greet mit Soheil Hosseini. Gesamtwert: 20.000 €.",
  },
  {
    q: "Welche weiteren Gewinne gibt es?",
    a: `Neben der Dubai-Reise verlosen wir ${SECONDARY_PRIZES_COUNT} Wertgutscheine für den ${SECONDARY_PRIZE_SHOP_NAME} im Gesamtwert von ${SECONDARY_PRIZES_TOTAL_LABEL}: ${SECONDARY_PRIZES.map((p) => `${p.count} × ${p.valueLabel}`).join(", ")}. Die Gutscheine gelten für das gesamte Sortiment – ${SECONDARY_PRIZE_EXAMPLES_LABEL}. Pro Person wird höchstens ein Gewinn vergeben.`,
  },
  {
    q: "Wann endet die Teilnahme?",
    a: `Registrierungsschluss ist der ${ENTRY_DEADLINE_LABEL}. Später eingehende Registrierungen nehmen nicht mehr an der Verlosung teil.`,
  },
  {
    q: "Wann erfolgt die Gewinnerbekanntgabe?",
    a: `Die Gewinnerbekanntgabe erfolgt am ${ANNOUNCEMENT_DATETIME_LABEL}.`,
  },
  {
    q: "Wie wird die Gewinnerin oder der Gewinner informiert?",
    a: "Persönlich über die im Formular angegebene E-Mail-Adresse und gegebenenfalls telefonisch. Eine öffentliche Nennung erfolgt ohne ausdrückliche Einwilligung höchstens in datensparsamer Form (z. B. Vorname und abgekürzter Nachname oder Teilnahme-Referenz).",
  },
  {
    q: "Muss ich die Bestellbestätigung aufbewahren?",
    a: "Ja, bitte bewahre sie bis zum Abschluss der Verlosung auf – sie dient als Nachweis deiner Bestellung.",
  },
  {
    q: "Was passiert mit meinen persönlichen Daten?",
    a: "Deine Angaben werden ausschließlich für die Durchführung des Gewinnspiels verwendet, nicht an Werbenetzwerke übermittelt und nach Abschluss entsprechend dem Lösch- und Aufbewahrungskonzept gelöscht. Details stehen in den Datenschutzhinweisen.",
  },
  {
    q: "Ist eine Barauszahlung des Gewinns möglich?",
    a: "Nein, eine Barauszahlung oder ein Umtausch der Gewinne ist ausgeschlossen.",
  },
  {
    q: "Kann der Gewinn übertragen werden?",
    a: "Die Gewinne sind nicht auf Dritte übertragbar – die Begleitperson für die Reise wählst du aber völlig frei.",
  },
  {
    q: "Was passiert, wenn ich versehentlich falsche Daten eingetragen habe?",
    a: `Schreib uns an ${CONTACT_EMAIL} und nenne dabei deine Teilnahme-Referenz – wir korrigieren deine Angaben.`,
  },
  {
    q: "Kann ich mit mehreren Bestellungen mehrfach teilnehmen?",
    a: "Ja – jede Bestellnummer kann genau einmal registriert werden. Mit mehreren Bestellungen sind entsprechend mehrere Teilnahmen möglich.",
  },
  {
    q: "Wohin fließen die Einnahmen aus dem Buch?",
    a: `${SPENDEN_HINWEIS} ${SPENDEN_WIRKUNG} – auch wenn du das Buch verschenkst oder am Gewinnspiel gar nicht teilnehmen möchtest.`,
  },
];

/**
 * Beide Schritt-CTAs teilen exakt dieselbe Geometrie (feste Höhe, volle Breite,
 * gleiche Schrift/Abstände, kein Umbruch) und sitzen per mt-auto auf derselben
 * Linie – nur die Füllung unterscheidet sich (Outline = Amazon, Gold = Registrierung).
 */
const STEP_CTA =
  "mt-auto inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold whitespace-nowrap shadow-lg shadow-black/40 outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--gw-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gw-bg)]";
const GOLD_CTA = `${STEP_CTA} bg-gradient-to-b from-[var(--gw-gold-strong)] to-[var(--gw-gold-deep)] text-[#181207] hover:brightness-105`;
const OUTLINE_CTA = `${STEP_CTA} border-2 border-[var(--gw-gold)] bg-[var(--gw-gold)]/10 text-[var(--gw-gold-strong)] hover:bg-[var(--gw-gold)]/20`;

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

function ClosedNotice({ phase }: { phase: SweepstakesPhase }) {
  return (
    <div className="rounded-2xl border gw-hairline bg-[var(--gw-surface)] p-8 text-center sm:p-12">
      <PartyPopper className="mx-auto h-10 w-10 text-[var(--gw-gold)]" aria-hidden="true" strokeWidth={1.5} />
      {phase === "scheduled" ? (
        <>
          <h3 className="mt-5 text-2xl font-semibold text-[var(--gw-ink)]">
            Die Teilnahme startet in Kürze.
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-[var(--gw-ink-soft)]">
            Schau bald wieder vorbei – die Registrierung ist noch nicht geöffnet. Die
            Gewinnerbekanntgabe erfolgt am {ANNOUNCEMENT_DATETIME_LABEL}.
          </p>
        </>
      ) : phase === "announced" ? (
        <>
          <h3 className="mt-5 text-2xl font-semibold text-[var(--gw-ink)]">
            Die Verlosung ist abgeschlossen.
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-[var(--gw-ink-soft)]">
            Vielen Dank an alle Teilnehmenden. Die Gewinnerinnen und Gewinner wurden am{" "}
            {ANNOUNCEMENT_DATETIME_LABEL} per E-Mail benachrichtigt.
          </p>
        </>
      ) : (
        <>
          <h3 className="mt-5 text-2xl font-semibold text-[var(--gw-ink)]">
            Die Teilnahme ist beendet.
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-[var(--gw-ink-soft)]">
            Vielen Dank für die großartige Unterstützung und die zahlreichen Registrierungen. Die
            Gewinnerbekanntgabe erfolgt am {ANNOUNCEMENT_DATETIME_LABEL}.
          </p>
        </>
      )}
    </div>
  );
}

export default async function GewinnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const utm = Object.fromEntries(
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
      .map((k) => [k, typeof params[k] === "string" ? (params[k] as string).slice(0, 120) : ""])
      .filter(([, v]) => v),
  ) as Record<string, string>;

  const phase = getSweepstakesPhase();
  const formToken = createFormToken();
  const env = getEnv();
  const contactIsPlaceholder = CONTACT_EMAIL.startsWith("[");

  return (
    <div className="gewinn-theme min-h-screen">
      {/* Entscheidung des Betreibers (Wiresoft Portal Ltd., 28.08.2026):
          Tracking auf dieser Seite lädt OHNE Consent-Gate ("not-required").
          Ein eigenes Consent-Banner wird extern ergänzt – danach hier wieder
          env.TRACKING_CONSENT_MODE übergeben, dann greift der Cookie-Check
          (CONSENT_COOKIE_NAME / CONSENT_COOKIE_ACCEPTED_VALUE) erneut. */}
      <GewinnTracking
        gtmContainerId={env.GTM_CONTAINER_ID ?? null}
        ga4MeasurementId={env.GA4_MEASUREMENT_ID ?? null}
        metaPixelId={env.META_PIXEL_ID ?? null}
        tiktokPixelId={env.TIKTOK_PIXEL_ID ?? null}
        redditPixelId={env.REDDIT_PIXEL_ID ?? null}
        redditTracking={createRedditTrackingConfig("/gewinn", "not-required")}
        bookConversion={await createBookConversionConfig("/gewinn", "not-required")}
        linkedInPartnerId={env.LINKEDIN_PARTNER_ID ?? null}
        consentMode="not-required"
        consentCookieName={env.CONSENT_COOKIE_NAME ?? null}
        consentAcceptedValue={env.CONSENT_COOKIE_ACCEPTED_VALUE ?? null}
      />
      <a
        href="#teilnahme"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[var(--gw-gold)] focus:px-4 focus:py-2 focus:text-[#181207]"
      >
        Zum Teilnahmeformular springen
      </a>

      <main>
        {/* ---------------------------------------------------------------- */}
        {/* 1 · Hero                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section
          className="relative overflow-hidden"
          aria-labelledby="hero-heading"
        >
          {/* Dezente Gold-Atmosphäre */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 45% at 75% 0%, rgba(214,178,111,0.14) 0%, transparent 60%), radial-gradient(50% 40% at 10% 100%, rgba(214,178,111,0.07) 0%, transparent 60%)",
            }}
          />
          <DubaiSkyline className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full sm:h-40 lg:h-52" />
          <div className="relative mx-auto grid max-w-6xl gap-y-9 px-5 pt-12 pb-36 sm:px-8 sm:pb-44 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_auto] lg:gap-x-12 lg:gap-y-7 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-x-20 lg:pt-20 lg:pb-56">
            <div className="gw-fade order-1 lg:order-none lg:col-start-1 lg:row-start-1">
              <div className="flex flex-wrap gap-2">
                <p className="inline-flex items-center gap-2 rounded-full border gw-hairline bg-white/[0.04] px-4 py-1.5 text-xs font-medium tracking-wide text-[var(--gw-ink-soft)]">
                  <CalendarDays className="h-3.5 w-3.5 text-[var(--gw-gold)]" aria-hidden="true" />
                  Gewinnerbekanntgabe am {ANNOUNCEMENT_DATETIME_LABEL}
                </p>
                {/* Spendenzusage: sofort sichtbar – jede Bestellung ist zugleich eine Spende */}
                <p className="inline-flex items-center gap-2 rounded-full border border-[var(--gw-gold)]/50 bg-[var(--gw-gold)]/10 px-4 py-1.5 text-xs font-medium tracking-wide text-[var(--gw-gold-strong)]">
                  <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
                  {SPENDEN_HINWEIS}
                </p>
              </div>
              <h1
                id="hero-heading"
                className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl xl:text-6xl"
              >
                Deine Buchbestellung könnte dich{" "}
                <span className="gw-gold-text">nach Dubai</span> bringen.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--gw-ink-soft)]">
                Hauptgewinn: {TRIP_DURATION_LABEL} Dubai für zwei Personen im Wert von{" "}
                <strong className="font-semibold whitespace-nowrap text-[var(--gw-gold-strong)]">
                  {PRIZE_VALUE_LABEL}
                </strong>
                , dazu {SECONDARY_PRIZES_COUNT} Wertgutscheine für den {SECONDARY_PRIZE_SHOP_NAME}. Zwei
                Schritte trennen dich vom Lostopf – zusammen dauern sie keine zwei Minuten.
              </p>
            </div>

            {/* Mobil: Cover erst nach den beiden Schritten, damit der Amazon-CTA im sichtbaren Bereich bleibt */}
            <div className="gw-fade-late order-3 mx-auto w-52 pr-3 sm:w-60 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:w-full lg:self-center lg:pr-6">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-8 rounded-[2.5rem] bg-[radial-gradient(closest-side,rgba(214,178,111,0.2),transparent)]"
                />
                <div className="gw-book relative">
                  <div className="gw-book-core">
                    <Image
                      src="/gewinn/buchcover.jpg"
                      alt="Buchcover: Die Lizenz zum Erfolg von Soheil Hosseini"
                      width={700}
                      height={1115}
                      priority
                      sizes="(min-width: 1280px) 380px, (min-width: 1024px) 320px, (min-width: 640px) 240px, 208px"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="gw-fade order-2 lg:order-none lg:col-start-1 lg:row-start-2">
              {/* Zwei Schritte: erst bestellen (Amazon-CTA), dann registrieren.
                  Ab md liegen Kicker/Titel/Text/Button/Fußnote per Subgrid zeilenweise
                  auf gleicher Höhe – Buttons bleiben unabhängig von Umbrüchen bündig. */}
              <ol
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
                aria-label="Teilnahme in zwei Schritten"
              >
                <li className="flex min-w-0 flex-col rounded-2xl border gw-hairline bg-[var(--gw-surface)] p-5 sm:p-6 md:grid md:grid-rows-subgrid md:row-span-5 md:gap-y-0">
                  <p className="text-xs font-semibold tracking-[0.2em] text-[var(--gw-gold)] uppercase">
                    Schritt 1
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--gw-ink)] lg:text-lg">
                    Bei Amazon bestellen
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--gw-ink-soft)] mb-5">
                    Das Taschenbuch „Die Lizenz zum Erfolg“ bestellen.{" "}
                    <strong className="font-semibold text-[var(--gw-ink)]">
                      Bestellnummer aufbewahren
                    </strong>{" "}
                    – die brauchst du in Schritt 2.
                  </p>
                  <a
                    href={AMAZON_PRODUCT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-gw-event="gewinnspiel_amazon_klick"
                    data-cta-id="hero_schritt_1"
                    className={OUTLINE_CTA}
                  >
                    Hier geht’s zum Buch
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                  <p className="mt-3 text-xs text-[var(--gw-ink-mute)]">
                    Schon bestellt? Weiter mit Schritt 2.
                  </p>
                </li>
                <li className="flex min-w-0 flex-col rounded-2xl border border-[var(--gw-gold)]/60 bg-gradient-to-b from-[var(--gw-surface-2)] to-[var(--gw-surface)] p-5 shadow-[0_0_0_1px_rgba(214,178,111,0.12),0_24px_60px_-30px_rgba(214,178,111,0.45)] sm:p-6 md:grid md:grid-rows-subgrid md:row-span-5 md:gap-y-0">
                  <p className="text-xs font-semibold tracking-[0.2em] text-[var(--gw-gold)] uppercase">
                    Schritt 2
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--gw-ink)] lg:text-lg">
                    Registrierung abschließen
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--gw-ink-soft)] mb-5">
                    Bestellnummer und Kontaktdaten hier eintragen.{" "}
                    <strong className="font-semibold text-[var(--gw-ink)]">
                      Erst damit bist du im Lostopf
                    </strong>{" "}
                    – die Bestellung allein reicht nicht.
                  </p>
                  <a
                    href="#teilnahme"
                    data-gw-event="gewinnspiel_cta_registrieren"
                    className={GOLD_CTA}
                  >
                    Jetzt registrieren
                  </a>
                  <p className="mt-3 text-xs text-[var(--gw-ink-mute)]">
                    Registrierungsschluss:{" "}
                    <span className="whitespace-nowrap">{ENTRY_DEADLINE_LABEL}</span>
                  </p>
                </li>
              </ol>

              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-[var(--gw-ink-soft)]">
                {[
                  "Emirates Business Class",
                  "5-Sterne-Designerhotel",
                  "Suite",
                  "Exklusives Dinner",
                  "Optionales Meet & Greet mit dem Autor",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[var(--gw-gold)]"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-[var(--gw-ink-mute)]">
                {TRIP_DURATION_LABEL} Dubai · Gesamtwert {PRIZE_VALUE_LABEL} · Für dich und eine
                Begleitperson deiner Wahl
              </p>
              <p className="mt-2 text-sm text-[var(--gw-ink-mute)]">
                Außerdem verlost:{" "}
                {SECONDARY_PRIZES.map((p) => `${p.count}× ${p.valueLabel}`).join(" · ")} Wertgutscheine
                für den {SECONDARY_PRIZE_SHOP_NAME} – {SECONDARY_PRIZE_EXAMPLES_LABEL}.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 2 · Persönlicher Dank                                             */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="dank-heading"
          className="border-y gw-hairline bg-[var(--gw-bg-soft)]"
        >
          <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-14 lg:py-20">
            <div className="mx-auto hidden w-52 lg:block lg:w-full">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-4 rounded-[1.75rem] bg-[radial-gradient(closest-side,rgba(214,178,111,0.16),transparent)]"
                />
                <Image
                  src="/gewinn/autor.jpg"
                  alt="Soheil Hosseini, Autor von „Die Lizenz zum Erfolg“"
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
                id="dank-heading"
                className="text-2xl font-semibold tracking-tight text-[var(--gw-ink)] sm:text-3xl"
              >
                Danke für deine Unterstützung.
              </h2>
              <blockquote className="mt-6 space-y-4 text-lg leading-relaxed text-[var(--gw-ink-soft)]">
                <p>
                  Mit deiner Bestellung von „Die Lizenz zum Erfolg“ unterstützt du nicht nur dieses Buch,
                  sondern auch die Geschichte und die Idee dahinter. Dafür möchte ich dir persönlich
                  Danke sagen.
                </p>
                <p>
                  Dass du meinem Buch dein Vertrauen schenkst, bedeutet mir sehr viel. Die
                  Dubai-Reise ist deshalb mehr als nur ein Gewinnspiel – sie ist mein persönliches
                  Dankeschön an alle, die mich und dieses Projekt unterstützen.
                </p>
                <p>
                  Und noch etwas ist mir wichtig:{" "}
                  <strong className="font-semibold text-[var(--gw-gold-strong)]">{SPENDEN_HINWEIS}</strong>{" "}
                  Mit jeder Bestellung hilfst du also auch Kindern, die Schutz brauchen – ganz
                  unabhängig davon, ob du am Gewinnspiel teilnimmst.
                </p>
                <p>
                  Ich wünsche dir viel Glück bei der Verlosung und hoffe, dass wir uns vielleicht
                  schon bald persönlich in Dubai kennenlernen.
                </p>
              </blockquote>
              <figcaption className="mt-7 flex items-center gap-4">
                <Image
                  src="/gewinn/autor.jpg"
                  alt=""
                  width={112}
                  height={167}
                  sizes="56px"
                  className="w-14 rounded-xl ring-1 ring-white/10 lg:hidden"
                />
                <span
                  aria-hidden="true"
                  className="hidden h-px w-12 bg-[var(--gw-gold)]/60 lg:block"
                />
                <span className="text-lg font-semibold tracking-wide text-[var(--gw-gold-strong)]">
                  Soheil Hosseini
                </span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 3 · Gewinnübersicht                                               */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="gewinn-heading" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <SectionHeading
            kicker="Der Hauptgewinn"
            title="Eine exklusive Dubai-Reise für zwei Personen"
            intro={`Fünf Tage, die bleiben – von der Business Class bis zur Suite. Für dich und eine Begleitperson deiner Wahl.`}
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRIZE_ITEMS.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border gw-hairline bg-[var(--gw-surface)] p-6 transition-colors hover:border-[var(--gw-gold)]/40"
              >
                <Icon className="h-7 w-7 text-[var(--gw-gold)]" aria-hidden="true" strokeWidth={1.5} />
                <h3 className="mt-4 text-lg font-semibold text-[var(--gw-ink)]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--gw-ink-soft)]">{text}</p>
              </div>
            ))}
            <div className="flex flex-col justify-center rounded-2xl border border-[var(--gw-gold)]/45 bg-gradient-to-b from-[var(--gw-surface-2)] to-[var(--gw-surface)] p-6 text-center">
              <p className="text-sm tracking-wide text-[var(--gw-ink-soft)] uppercase">
                Gesamtwert der Reise
              </p>
              <p className="gw-gold-text mt-2 text-5xl font-semibold tracking-tight">
                {PRIZE_VALUE_LABEL}
              </p>
              <p className="mt-3 text-sm text-[var(--gw-ink-mute)]">
                Verlost wird eine Reise – für eine Gewinnerin oder einen Gewinner mit Begleitung.
              </p>
            </div>
          </div>
          {/* Weitere Gewinne: Wertgutscheine für den Wiresoft Software Shop */}
          <div className="mt-16">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold tracking-[0.25em] text-[var(--gw-gold)] uppercase">
                Weitere Gewinne
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-[var(--gw-ink)] sm:text-3xl">
                {SECONDARY_PRIZES_COUNT} Wertgutscheine für den {SECONDARY_PRIZE_SHOP_NAME}
              </h3>
              <p className="mt-4 text-[var(--gw-ink-soft)]">
                Neben der Dubai-Reise verlosen wir Gutscheine im Gesamtwert von{" "}
                {SECONDARY_PRIZES_TOTAL_LABEL} – einlösbar auf das gesamte Sortiment,{" "}
                {SECONDARY_PRIZE_EXAMPLES_LABEL}.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {SECONDARY_PRIZES.map((prize) => (
                <div
                  key={prize.valueLabel}
                  className="rounded-2xl border gw-hairline bg-[var(--gw-surface)] p-6 text-center transition-colors hover:border-[var(--gw-gold)]/40"
                >
                  <p className="gw-gold-text text-4xl font-semibold tracking-tight">
                    {prize.count}×
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--gw-ink)]">
                    {prize.valueLabel} Wertgutschein
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--gw-ink-soft)]">
                    für den {SECONDARY_PRIZE_SHOP_NAME}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-[var(--gw-ink-mute)]">
              Hauptgewinn bleibt die Dubai-Reise. Pro Person wird höchstens ein Gewinn vergeben.{" "}
              <a
                href={SECONDARY_PRIZE_SHOP_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-gw-event="gewinnspiel_wiresoft_klick"
                className="underline decoration-[var(--gw-gold)]/40 underline-offset-4 hover:text-[var(--gw-gold-strong)]"
              >
                Zum {SECONDARY_PRIZE_SHOP_NAME}
              </a>
            </p>
          </div>

        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 4 · Teilnahme in drei Schritten                                   */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="schritte-heading"
          className="border-y gw-hairline bg-[var(--gw-bg-soft)]"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
            <SectionHeading kicker="So funktioniert es" title="Teilnahme in drei Schritten" />
            <ol className="mt-12 grid gap-4 lg:grid-cols-3">
              {[
                {
                  icon: BookOpen,
                  step: "1",
                  title: "Buch bestellen",
                  text: "„Die Lizenz zum Erfolg“ bei einem teilnehmenden Händler bestellen.",
                  extra: (
                    <a
                      href={AMAZON_PRODUCT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-gw-event="gewinnspiel_amazon_klick"
                      className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg border gw-hairline bg-white/[0.04] px-4 py-2 text-sm font-medium text-[var(--gw-ink)] hover:bg-white/[0.08]"
                    >
                      Zum Buch auf Amazon
                    </a>
                  ),
                },
                {
                  icon: ClipboardList,
                  step: "2",
                  title: "Bestellung registrieren",
                  text: "Bestellnummer und persönliche Kontaktdaten auf dieser Seite eintragen.",
                },
                {
                  icon: PartyPopper,
                  step: "3",
                  title: "An der Verlosung teilnehmen",
                  text: "Nach erfolgreicher Registrierung an der Verlosung der Dubai-Reise und der Wiresoft-Gutscheine teilnehmen.",
                },
              ].map(({ icon: Icon, step, title, text, extra }) => (
                <li
                  key={step}
                  className="relative rounded-2xl border gw-hairline bg-[var(--gw-surface)] p-6"
                >
                  <span
                    aria-hidden="true"
                    className="absolute top-5 right-6 text-5xl font-semibold text-[var(--gw-gold)]/15"
                  >
                    {step}
                  </span>
                  <Icon className="h-7 w-7 text-[var(--gw-gold)]" aria-hidden="true" strokeWidth={1.5} />
                  <h3 className="mt-4 text-lg font-semibold text-[var(--gw-ink)]">
                    {step}. {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--gw-ink-soft)]">{text}</p>
                  {extra ?? null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 5 · Teilnahmeformular                                             */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="teilnahme"
          aria-labelledby="teilnahme-heading"
          className="mx-auto max-w-3xl scroll-mt-8 px-5 py-16 sm:px-8 lg:py-24"
        >
          <SectionHeading
            kicker="Teilnahme"
            title="Registriere deine Bestellung"
            intro="Trage deine Bestelldaten und Kontaktdaten ein – die Registrierung dauert weniger als zwei Minuten."
          />
          <div className="mt-10">
            {phase === "open" ? (
              <EntryForm
                formToken={formToken}
                utm={utm}
                privacyUrl={env.PRIVACY_URL ?? null}
              />
            ) : (
              <ClosedNotice phase={phase} />
            )}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 6 · FAQ                                                           */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="faq-heading"
          className="border-t gw-hairline bg-[var(--gw-bg-soft)]"
        >
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-24">
            <SectionHeading kicker="Fragen & Antworten" title="Häufige Fragen" />
            <div className="mt-10 divide-y divide-[var(--gw-border-soft)] rounded-2xl border gw-hairline bg-[var(--gw-surface)]">
              {FAQ_ITEMS.map(({ q, a }) => (
                <details key={q} className="group px-6 py-1">
                  <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-left font-medium text-[var(--gw-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-gold)] [&::-webkit-details-marker]:hidden">
                    {q}
                    <span
                      aria-hidden="true"
                      className="text-xl leading-none text-[var(--gw-gold)] transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-5 text-sm leading-relaxed text-[var(--gw-ink-soft)]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 7 · Abschließender CTA                                            */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="cta-heading" className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(55% 60% at 50% 100%, rgba(214,178,111,0.13) 0%, transparent 65%)",
            }}
          />
          <DubaiSkyline className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full opacity-60 sm:h-36" />
          <div className="relative mx-auto max-w-3xl px-5 py-20 pb-32 text-center sm:px-8 lg:py-28 lg:pb-40">
            <h2
              id="cta-heading"
              className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              Deine Chance auf <span className="gw-gold-text">Dubai</span> wartet.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--gw-ink-soft)]">
              Registriere jetzt deine Buchbestellung und nimm an der Verlosung der exklusiven
              Dubai-Reise für zwei Personen teil.
            </p>
            <a
              href="#teilnahme"
              data-gw-event="gewinnspiel_cta_registrieren"
              className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-gradient-to-b from-[var(--gw-gold-strong)] to-[var(--gw-gold-deep)] px-8 py-3.5 text-base font-semibold text-[#181207] shadow-lg shadow-black/40 outline-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--gw-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gw-bg)]"
            >
              Jetzt Bestellung registrieren
            </a>
            <p className="mt-4 text-sm text-[var(--gw-ink-mute)]">
              Gewinnerbekanntgabe am {ANNOUNCEMENT_DATETIME_LABEL}
            </p>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* 8 · Footer                                                          */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t gw-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 text-sm text-[var(--gw-ink-mute)] sm:flex-row sm:px-8">
          <p>„Die Lizenz zum Erfolg“ · Soheil Hosseini</p>
          <nav aria-label="Rechtliches" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
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
            <Link href="/gewinn/teilnahmebedingungen" className="hover:text-[var(--gw-ink)]">
              Teilnahmebedingungen
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
      </footer>
    </div>
  );
}
