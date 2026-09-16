import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  HeartHandshake,
  PartyPopper,
  Ticket,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ConsentBanner, ConsentSettingsButton } from "@/components/consent-banner";
import { DubaiSkyline } from "@/components/gewinn/dubai-skyline";
import { GewinnTracking } from "@/components/gewinn/gewinn-tracking";
import { Confetti } from "@/components/verlosung/confetti";
import { ParticipationHost } from "@/components/verlosung/participation-host";
import { ShareBox } from "@/components/verlosung/share-box";
import { StickyCta } from "@/components/verlosung/sticky-cta";
import { VerlosungEntry } from "@/components/verlosung/verlosung-entry";
import { createBookConversionConfig } from "@/lib/book-conversion-context";
import {
  BUCH_AUTOR,
  BUCH_ERSCHEINT_LABEL,
  BUCH_FORMAT_LABEL,
  BUCH_ISBN13,
  BUCH_PREIS_LABEL,
  BUCH_TITEL,
  BUCH_UNTERTITEL,
  BUCH_VERLAG,
  buchKaufLabels,
  SPENDEN_EMPFAENGER,
  SPENDEN_HINWEIS,
} from "@/lib/buch-config";
import { resolveConsentCookie } from "@/lib/consent";
import { getEnv } from "@/lib/env";
import {
  ANNOUNCEMENT_DATETIME_LABEL,
  CONTACT_EMAIL,
  ELIGIBLE_COUNTRIES_LABEL,
  ENTRY_DEADLINE_LABEL,
  GEWINN_URL,
  getSweepstakesPhase,
  MIN_AGE,
  ORGANIZER_ADDRESS,
  ORGANIZER_NAME,
  PRIZE_VALUE_LABEL,
  RETAILER_LINKS,
  SECONDARY_PRIZE_SHOP_NAME,
  type SweepstakesPhase,
  TOTAL_PRIZE_VALUE_LABEL,
  TRIP_DURATION_LABEL,
  TRIP_INCLUSIONS,
  VERLOSUNG_SHARE_TEXT,
  VERLOSUNG_SHARE_TEXT_CLOSED,
  VERLOSUNG_URL,
  VOUCHER_BRAND_NAMES_LABEL,
  VOUCHER_BRANDS,
  VOUCHER_TOTAL_COUNT,
  VOUCHER_TOTAL_LABEL,
  voucherBrandCount,
  voucherBrandTotalEur,
  formatEur,
} from "@/lib/gewinnspiel-config";
import { createRedditTrackingConfig } from "@/lib/reddit-context";
import { createFormToken } from "@/lib/sweepstakes-crypto";

/**
 * Kampagnen-Landingpage /verlosung (Adcloud-Mailing): Buch bei Amazon
 * bestellen und die Bestellnummer direkt hier registrieren. Conversion-Regel
 * (Soheil, 16.09.2026): KEIN CTA springt auf der Seite nach unten – jeder
 * Bestell-Button führt direkt zu Amazon (neuer Tab), jeder Teilnahme-Button
 * öffnet das Formular sofort im Dialog (ParticipationHost); dieselbe
 * Formularinstanz liegt zusätzlich inline in der Sektion #teilnehmen. Zusätzlicher
 * Einstieg in den GEMEINSAMEN Lostopf von /gewinn – gleiche Server Action,
 * gleiche Validierung, gleiche Deduplizierung. Alle Zahlen kommen aus
 * gewinnspiel-config.ts / buch-config.ts.
 *
 * Tracking: GewinnTracking im Consent-Modus "required" – Marketing-Pixel und
 * Server-Events laufen nur mit Zustimmung über das Consent-Banner der Seite.
 */

export const dynamic = "force-dynamic";

const TITLE = "Dubai-Reise & 300 Gutscheine gewinnen | Die Lizenz zum Erfolg";
const DESCRIPTION = `Buch „${BUCH_TITEL}“ bestellen, Bestellnummer registrieren und an der Verlosung teilnehmen: ${TRIP_DURATION_LABEL} Dubai für zwei (${PRIZE_VALUE_LABEL}) und ${VOUCHER_TOTAL_COUNT} Gutscheine von ${VOUCHER_BRAND_NAMES_LABEL} im Gesamtwert von ${VOUCHER_TOTAL_LABEL}.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: VERLOSUNG_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: VERLOSUNG_URL,
    siteName: BUCH_TITEL,
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: `${GEWINN_URL}/og-v2.png`,
        width: 1200,
        height: 630,
        alt: `Gewinne ${TRIP_DURATION_LABEL} Dubai für zwei – Buchaktion zu „${BUCH_TITEL}“`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${GEWINN_URL}/og-v2.png`],
  },
};

const BTN =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-6 text-center text-base leading-tight font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vl-ivory)]";
const BTN_YELLOW = `${BTN} bg-[var(--vl-yellow)] text-[var(--vl-ink)] shadow-[0_16px_40px_-18px_rgba(7,62,67,0.6)] hover:brightness-105`;
const BTN_OUTLINE = `${BTN} border-2 border-[var(--vl-petrol)] bg-transparent text-[var(--vl-petrol)] hover:bg-[var(--vl-petrol-soft)]`;
const BTN_PETROL = `${BTN} bg-[var(--vl-petrol)] text-white hover:brightness-110`;
const TEXT_LINK =
  "font-medium text-[var(--vl-petrol)] underline decoration-[var(--vl-petrol)]/40 underline-offset-4 hover:decoration-[var(--vl-petrol)]";
const NAV_LINK =
  "inline-flex min-h-[44px] items-center rounded-lg px-2.5 text-sm font-medium text-[var(--vl-ink-soft)] outline-none hover:text-[var(--vl-petrol)] focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)] sm:px-3";

function SectionHeading({
  kicker,
  title,
  intro,
  tone = "light",
  id,
}: {
  kicker?: string;
  title: string;
  intro?: React.ReactNode;
  tone?: "light" | "dark";
  id: string;
}) {
  const dark = tone === "dark";
  return (
    <div className="mx-auto max-w-2xl text-center">
      {kicker ? (
        <p
          className={`text-xs font-semibold tracking-[0.22em] uppercase ${
            dark ? "text-[var(--vl-yellow)]" : "text-[var(--vl-petrol)]"
          }`}
        >
          {kicker}
        </p>
      ) : null}
      <h2
        id={id}
        lang="de"
        className={`mt-3 text-3xl font-semibold tracking-tight text-balance hyphens-auto sm:text-4xl ${
          dark ? "text-[var(--vl-ivory)]" : "text-[var(--vl-petrol)]"
        }`}
      >
        {title}
      </h2>
      {intro ? (
        <p className={`mt-4 text-lg ${dark ? "text-[var(--vl-ivory)]/85" : "text-[var(--vl-ink-soft)]"}`}>
          {intro}
        </p>
      ) : null}
    </div>
  );
}

function ClosedNotice({ phase }: { phase: SweepstakesPhase }) {
  return (
    <div
      role="status"
      className="rounded-2xl border gw-hairline bg-[var(--vl-surface)] p-8 text-center sm:p-12"
    >
      <PartyPopper className="mx-auto h-10 w-10 text-[var(--vl-petrol)]" aria-hidden="true" strokeWidth={1.5} />
      {phase === "scheduled" ? (
        <>
          <h3 className="mt-5 text-2xl font-semibold text-[var(--vl-ink)]">
            Die Teilnahme startet in Kürze.
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-[var(--vl-ink-soft)]">
            Die Registrierung ist noch nicht geöffnet. Die Gewinnerbekanntgabe erfolgt am{" "}
            {ANNOUNCEMENT_DATETIME_LABEL}.
          </p>
        </>
      ) : phase === "announced" ? (
        <>
          <h3 className="mt-5 text-2xl font-semibold text-[var(--vl-ink)]">
            Die Verlosung ist abgeschlossen.
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-[var(--vl-ink-soft)]">
            Vielen Dank an alle Teilnehmenden. Die Gewinnerinnen und Gewinner wurden am{" "}
            {ANNOUNCEMENT_DATETIME_LABEL} per E-Mail benachrichtigt. Das Buch gibt es weiterhin bei
            allen Händlern – eine neue Teilnahme ist nicht mehr möglich.
          </p>
        </>
      ) : (
        <>
          <h3 className="mt-5 text-2xl font-semibold text-[var(--vl-ink)]">
            Die Teilnahme ist beendet.
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-[var(--vl-ink-soft)]">
            Registrierungsschluss war der {ENTRY_DEADLINE_LABEL}. Die Gewinnerbekanntgabe erfolgt am{" "}
            {ANNOUNCEMENT_DATETIME_LABEL}. Das Buch gibt es weiterhin – eine neue Teilnahme ist nicht
            mehr möglich.
          </p>
        </>
      )}
    </div>
  );
}

export default async function VerlosungPage({
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

  const now = new Date();
  const phase = getSweepstakesPhase(now);
  const open = phase === "open";
  const kauf = buchKaufLabels(now);
  const formToken = createFormToken();
  const env = getEnv();
  const consentCookie = resolveConsentCookie(env);
  const shareText = open ? VERLOSUNG_SHARE_TEXT : VERLOSUNG_SHARE_TEXT_CLOSED;
  const amazon = RETAILER_LINKS.find((r) => r.primary) ?? RETAILER_LINKS[0]!;
  const otherRetailers = RETAILER_LINKS.filter((r) => !r.primary);

  const FAQ: Array<{ q: string; a: React.ReactNode }> = [
    {
      q: "Wie nehme ich teil?",
      a: `Bestelle „${BUCH_TITEL}“ bei Amazon oder einem anderen Buchhändler und trage danach hier deine Bestellnummer sowie deine Kontaktdaten in das Teilnahmeformular ein. Erst mit dem Absenden des Formulars bist du im Lostopf – die Bestellung allein oder ein Klick zum Händler reicht nicht.`,
    },
    {
      q: "Gilt auch eine Vorbestellung?",
      a: `Ja. Das Taschenbuch erscheint am ${BUCH_ERSCHEINT_LABEL}. Eine Vorbestellung hat bereits eine gültige Bestellnummer, die du sofort registrieren kannst.`,
    },
    {
      q: "Wo finde ich meine Bestellnummer?",
      a: "In der Bestellbestätigung deines Buchhändlers (E-Mail oder Kundenkonto) – bei Amazon zum Beispiel eine Nummer im Format 306-1234567-1234567. Trage sie genau so ein, wie sie dort steht, inklusive Bindestrichen oder führender Nullen.",
    },
    {
      q: "Bei welchen Händlern kann ich bestellen?",
      a: `Bei ${RETAILER_LINKS.map((r) => r.label).join(", ")} sowie bei jedem anderen Händler, der das Buch führt – wähle im Formular dann „Anderer Händler“ und trage den Namen ein.`,
    },
    {
      q: "Ich habe bereits bestellt – kann ich mich noch anmelden?",
      a: `Ja, solange deine Registrierung bis zum ${ENTRY_DEADLINE_LABEL} eingeht. Auch Bestellungen von vor dem Start dieser Aktion kannst du registrieren. Hast du deine Bestellnummer schon auf lizenzzumerfolg.com/gewinn eingetragen, ist sie bereits im gemeinsamen Lostopf – bitte nicht erneut anmelden.`,
    },
    {
      q: "Kann ich mit mehreren Bestellungen meine Gewinnchance erhöhen?",
      a: "Ja. Jede gültige, einzeln registrierte Bestellnummer zählt als ein Los. Wenn du mehrere gültige Bestellungen aufgibst und jede Bestellnummer separat anmeldest, kannst du deine Gewinnchance erhöhen. Dieselbe Bestellnummer kann nur einmal teilnehmen. Mehrere Bücher unter einer Bestellnummer ergeben keine zusätzlichen Lose. Pro Person wird höchstens ein Gewinn vergeben.",
    },
    {
      q: "Welche Gewinne werden verlost und für welche bin ich angemeldet?",
      a: `Verlost werden ${TRIP_DURATION_LABEL} Dubai für zwei Personen im Wert von ${PRIZE_VALUE_LABEL} sowie ${VOUCHER_TOTAL_COUNT} Gutscheine von ${VOUCHER_BRAND_NAMES_LABEL} im Gesamtwert von ${VOUCHER_TOTAL_LABEL}. Jede gültige Teilnahme nimmt automatisch an der Verlosung aller Gewinne teil – du musst nichts auswählen. Die Gutscheine werden verlost, sie sind kein Rabatt und kein garantierter Bonus. Pro Person wird höchstens ein Gewinn vergeben.`,
    },
    {
      q: "Bis wann kann ich teilnehmen und wann werden Gewinner bekannt gegeben?",
      a: `Registrierungsschluss ist der ${ENTRY_DEADLINE_LABEL} (MESZ). Die Gewinnerbekanntgabe erfolgt am ${ANNOUNCEMENT_DATETIME_LABEL}; Gewinnerinnen und Gewinner werden über die angegebene E-Mail-Adresse und gegebenenfalls telefonisch benachrichtigt.`,
    },
    {
      q: "Welche Einlösebedingungen haben die Gutscheine?",
      a: `Die Wiresoft-Gutscheine sind auf das gesamte Sortiment des ${SECONDARY_PRIZE_SHOP_NAME}s einlösbar. Für alle Gutscheine gilt: Gültigkeitsdauer und weitere Einlösebedingungen werden den Gewinnerinnen und Gewinnern zusammen mit dem Gutschein mitgeteilt; eine Barauszahlung ist ausgeschlossen. Details stehen in den Teilnahmebedingungen.`,
    },
    {
      q: `Wie funktioniert die Spende an den ${SPENDEN_EMPFAENGER}?`,
      a: `${SPENDEN_HINWEIS} Gemeint sind die Autoreneinnahmen, nicht der gesamte Verkaufspreis. Du selbst tätigst mit deiner Bestellung keine eigene Spende und erhältst keine Spendenbescheinigung. Der ${SPENDEN_EMPFAENGER} ist nicht an der Verlosung beteiligt.`,
    },
    {
      q: "Wer darf teilnehmen?",
      a: `Personen ab ${MIN_AGE} Jahren mit Wohnsitz in ${ELIGIBLE_COUNTRIES_LABEL}. Alle Details regeln die Teilnahmebedingungen.`,
    },
  ];

  return (
    <div id="top" className="verlosung-theme min-h-screen pb-24 md:pb-0">
      <GewinnTracking
        gtmContainerId={env.GTM_CONTAINER_ID ?? null}
        ga4MeasurementId={env.GA4_MEASUREMENT_ID ?? null}
        metaPixelId={env.META_PIXEL_ID ?? null}
        tiktokPixelId={env.TIKTOK_PIXEL_ID ?? null}
        redditPixelId={env.REDDIT_PIXEL_ID ?? null}
        redditTracking={createRedditTrackingConfig("/verlosung", "required")}
        bookConversion={await createBookConversionConfig("/verlosung", "required")}
        linkedInPartnerId={env.LINKEDIN_PARTNER_ID ?? null}
        consentMode="required"
        consentCookieName={consentCookie.name}
        consentAcceptedValue={consentCookie.acceptedValue}
        pageEventName="verlosung_seite"
      />

      <a
        href="#teilnehmen"
        data-no-dialog=""
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[var(--vl-yellow)] focus:px-4 focus:py-2 focus:text-[var(--vl-ink)]"
      >
        Zum Teilnahmeformular springen
      </a>

      {/* ------------------------------------------------------------------ */}
      {/* A · Header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-30 border-b border-[var(--vl-border-soft)] bg-[var(--vl-ivory)]/92 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-8">
          <a
            href="#top"
            className="min-w-0 truncate text-sm font-semibold tracking-tight text-[var(--vl-petrol)] sm:text-base"
          >
            <span className="hidden sm:inline">{BUCH_TITEL}</span>
            <span className="sm:hidden">Lizenz zum Erfolg</span>
          </a>
          <nav aria-label="Seitenbereiche">
            <ul className="flex items-center gap-0.5 sm:gap-1">
              <li className="hidden min-[400px]:block">
                <a href="#gewinne" className={NAV_LINK}>
                  Gewinne
                </a>
              </li>
              <li>
                <a href="#so-gehts" className={NAV_LINK}>
                  So geht’s
                </a>
              </li>
              <li>
                <a
                  href="#teilnehmen"
                  data-gw-event="verlosung_cta_teilnehmen_header"
                  className={`${NAV_LINK} rounded-lg bg-[var(--vl-petrol)] text-white hover:text-white hover:brightness-110`}
                >
                  Teilnehmen
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main>
        {/* ---------------------------------------------------------------- */}
        {/* B · Hero                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section id="hero" aria-labelledby="hero-heading" className="relative overflow-hidden">
          <Confetti className="hidden opacity-70 sm:block" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-7 pb-14 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:pt-16 lg:pb-20">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.22em] text-[var(--vl-petrol)] uppercase">
                Die große Buch- und Gewinnaktion
              </p>
              <h1
                id="hero-heading"
                className="mt-4 text-4xl font-semibold tracking-tight text-balance text-[var(--vl-petrol)] sm:text-5xl"
              >
                Dubai für zwei.
                <br />
                Und <span className="vl-mark">{VOUCHER_TOTAL_COUNT} Gutscheine</span> zu gewinnen.
              </h1>
              <p className="mt-5 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-[var(--vl-yellow)] px-4 py-2 text-sm font-semibold text-[var(--vl-ink)]">
                <PartyPopper className="h-4 w-4" aria-hidden="true" />
                Gewinne im Gesamtwert von {TOTAL_PRIZE_VALUE_LABEL}
              </p>
              <p className="mt-2 hidden text-sm text-[var(--vl-ink-mute)] sm:block">
                {TRIP_DURATION_LABEL} Dubai für zwei ({PRIZE_VALUE_LABEL}) + {VOUCHER_TOTAL_COUNT} Gutscheine (
                {VOUCHER_TOTAL_LABEL})
              </p>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--vl-ink-soft)]">
                Sichere dir „{BUCH_TITEL}“ von {BUCH_AUTOR}. Trage danach hier deine Bestellnummer ein
                und nimm an der Verlosung teil.
              </p>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--vl-ink)]">
                <strong className="font-semibold">
                  {VOUCHER_TOTAL_COUNT} Gutscheine von {VOUCHER_BRAND_NAMES_LABEL} im Gesamtwert von{" "}
                  {VOUCHER_TOTAL_LABEL}
                </strong>{" "}
                – zusätzlich zur Dubai-Reise.
              </p>

              {/* Mobil: Buch + Preis sofort sichtbar (Desktop: in der Bildfläche rechts) */}
              <div className="mt-6 flex items-center gap-4 rounded-2xl border gw-hairline bg-white p-3 lg:hidden">
                <Image
                  src="/gewinn/buchcover.jpg"
                  alt={`Buchcover: ${BUCH_TITEL} von ${BUCH_AUTOR}`}
                  width={700}
                  height={1115}
                  priority
                  sizes="64px"
                  className="w-16 shrink-0 rounded-md shadow-md"
                />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-[var(--vl-ink)]">{BUCH_TITEL}</p>
                  <p className="text-[var(--vl-ink-soft)]">{BUCH_AUTOR}</p>
                  <p className="mt-1 text-[var(--vl-ink-soft)]">
                    <span className="font-semibold text-[var(--vl-ink)]">{BUCH_PREIS_LABEL}</span> ·{" "}
                    {BUCH_FORMAT_LABEL} · {kauf.availability}
                  </p>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={amazon.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cta-id="hero_amazon"
                  data-gw-event="verlosung_amazon_klick"
                  className={`${BTN_YELLOW} sm:whitespace-nowrap`}
                >
                  {kauf.primaryCta}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">(öffnet in neuem Tab)</span>
                </a>
                <a
                  href="#teilnehmen"
                  data-gw-event="verlosung_cta_teilnehmen_hero"
                  className={`${BTN_OUTLINE} sm:whitespace-nowrap`}
                >
                  Schon bestellt? Bestellnummer eintragen
                </a>
              </div>
              <p className="mt-3 text-sm text-[var(--vl-ink-mute)]">
                Erst das Buch bestellen, dann die Bestellnummer eintragen. Die Teilnahme erfolgt nicht
                automatisch. Amazon öffnet in einem neuen Tab – diese Seite bleibt für dich offen.
              </p>
              <p className="mt-5 inline-flex items-start gap-2 text-sm text-[var(--vl-ink-soft)]">
                <HeartHandshake
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--vl-petrol)]"
                  aria-hidden="true"
                />
                <span>{SPENDEN_HINWEIS}</span>
              </p>
            </div>

            {/* Bildfläche: Dubai-Licht + Skyline + unverändertes Originalcover */}
            <div className="relative">
              <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_90%_at_80%_0%,#0f6b73_0%,#073e43_55%,#052d31_100%)] shadow-[0_30px_80px_-30px_rgba(7,62,67,0.7)]">
                <div
                  aria-hidden="true"
                  className="absolute -top-10 right-8 h-40 w-40 rounded-full bg-[var(--vl-yellow)] opacity-90 blur-2xl sm:h-52 sm:w-52"
                />
                <div
                  aria-hidden="true"
                  className="absolute top-6 right-14 h-20 w-20 rounded-full bg-[var(--vl-yellow)] sm:top-8 sm:h-24 sm:w-24"
                />
                <Confetti variant="spread" className="opacity-80" count={7} />
                <DubaiSkyline className="absolute inset-x-0 bottom-0 h-40 w-full sm:h-52" />
                {/* Preisschild-Tag: Gutscheine als zweiter Blickfang */}
                <p className="absolute top-5 left-5 z-10 rotate-[-4deg] rounded-lg bg-[var(--vl-yellow)] px-3 py-1.5 text-sm font-bold text-[var(--vl-ink)] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] sm:text-base">
                  + {VOUCHER_TOTAL_COUNT} Gutscheine · {VOUCHER_TOTAL_LABEL}
                </p>
                <div className="relative grid min-h-[300px] grid-cols-[auto_minmax(0,1fr)] items-end gap-5 p-6 sm:min-h-[420px] sm:p-8 lg:min-h-[520px]">
                  <div className="w-32 rotate-[-4deg] sm:w-44 lg:w-52">
                    <Image
                      src="/gewinn/buchcover.jpg"
                      alt=""
                      width={700}
                      height={1115}
                      priority
                      sizes="(min-width: 1024px) 208px, (min-width: 640px) 176px, 128px"
                      className="rounded-md shadow-[0_30px_50px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/20"
                    />
                  </div>
                  <div className="pb-1 text-[var(--vl-ivory)]">
                    <p className="text-xs font-semibold tracking-[0.2em] text-[var(--vl-yellow)] uppercase">
                      Hauptgewinn
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                      {TRIP_DURATION_LABEL} Dubai
                      <br />
                      für zwei
                    </p>
                    <p className="mt-1 text-sm text-[var(--vl-ivory)]/85">
                      Reisewert {PRIZE_VALUE_LABEL} · Emirates Business Class
                    </p>
                    <p className="mt-4 hidden text-sm text-[var(--vl-ivory)]/85 lg:block">
                      <span className="font-semibold text-[var(--vl-ivory)]">{BUCH_PREIS_LABEL}</span> ·{" "}
                      {BUCH_FORMAT_LABEL} · {kauf.availability}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* C · Drei Schritte + Los-Regel                                      */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="so-gehts"
          aria-labelledby="schritte-heading"
          className="scroll-mt-16 border-y gw-hairline bg-white"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 lg:py-20">
            <SectionHeading id="schritte-heading" kicker="In drei Schritten" title="So bist du dabei" />
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: BookOpen,
                  title: "Buch bestellen",
                  text: `Bestelle „${BUCH_TITEL}“ bei Amazon oder einem anderen teilnehmenden Buchhändler.`,
                },
                {
                  icon: ClipboardList,
                  title: "Bestellnummer eintragen",
                  text: "Trage deine Bestellnummer hier auf der Seite ein – jeder Button „Bestellnummer eintragen“ öffnet das Formular sofort.",
                },
                {
                  icon: PartyPopper,
                  title: "An der Verlosung teilnehmen",
                  text: "Nach erfolgreicher Anmeldung wird deine Teilnahme gemäß den Teilnahmebedingungen berücksichtigt.",
                },
              ].map(({ icon: Icon, title, text }, i) => (
                <li
                  key={title}
                  className="relative rounded-2xl border gw-hairline bg-[var(--vl-ivory)] p-6"
                >
                  <span
                    aria-hidden="true"
                    className="absolute top-4 right-5 text-5xl font-semibold text-[var(--vl-petrol)]/10"
                  >
                    {i + 1}
                  </span>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vl-petrol)] text-[var(--vl-yellow)]">
                    <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--vl-ink)]">
                    {i + 1}. {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--vl-ink-soft)]">{text}</p>
                </li>
              ))}
            </ol>

            <div className="mt-6 grid gap-4 rounded-2xl border-2 border-[var(--vl-petrol)]/25 bg-[var(--vl-yellow-soft)] p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:p-7">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--vl-yellow)] text-[var(--vl-ink)]">
                <Ticket className="h-6 w-6" aria-hidden="true" strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="text-xl font-semibold text-[var(--vl-petrol)]">
                  Jede Bestellnummer zählt als ein Los.
                </h3>
                <p className="mt-2 leading-relaxed text-[var(--vl-ink)]">
                  Jede gültige, einzeln registrierte Bestellnummer gibt dir eine Gewinnchance. Mehrere
                  gültige Bestellungen können deine Gewinnchance erhöhen – registriere dafür jede
                  Bestellnummer einzeln.
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--vl-ink-soft)]">
                  Pro Bestellnummer ist eine Teilnahme möglich. Pro Person wird höchstens ein Gewinn
                  vergeben.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* D · Dubai-Hauptgewinn                                              */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="gewinne"
          aria-labelledby="dubai-heading"
          className="relative scroll-mt-16 overflow-hidden bg-[var(--vl-petrol)] text-[var(--vl-ivory)]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 50% at 85% 0%, rgba(255,216,61,0.22) 0%, transparent 60%), radial-gradient(50% 40% at 0% 100%, rgba(143,211,232,0.12) 0%, transparent 60%)",
            }}
          />
          <DubaiSkyline className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full opacity-70 sm:h-44" />
          <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-40 sm:px-8 sm:pb-52 lg:pt-20">
            <SectionHeading
              id="dubai-heading"
              tone="dark"
              kicker="Der Hauptgewinn"
              title="Vielleicht geht deine nächste Reise nach Dubai."
              intro="Eine Reise für zwei, auf die ihr euch gemeinsam freuen könnt: Emirates Business Class, ein 5-Sterne-Hotel und ein besonderes Dinner."
            />
            <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <ul className="grid gap-3 sm:grid-cols-2">
                {TRIP_INCLUSIONS.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/5 p-4 text-sm leading-relaxed"
                  >
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-[var(--vl-yellow)]"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col justify-center rounded-2xl bg-[var(--vl-yellow)] p-6 text-center text-[var(--vl-ink)]">
                <p className="text-xs font-semibold tracking-[0.2em] uppercase">Reisewert</p>
                <p className="mt-2 text-5xl font-semibold tracking-tight">{PRIZE_VALUE_LABEL}</p>
                <p className="mt-2 text-sm font-medium">
                  {TRIP_DURATION_LABEL} · für zwei Personen · eine Reise wird verlost
                </p>
              </div>
            </div>
            <details className="group mt-6 rounded-2xl border border-white/15 bg-white/5">
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--vl-yellow)] [&::-webkit-details-marker]:hidden">
                Reisedetails und Bedingungen
                <span
                  aria-hidden="true"
                  className="text-2xl leading-none text-[var(--vl-yellow)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="space-y-3 px-5 pb-5 text-sm leading-relaxed text-[var(--vl-ivory)]/85">
                <p>
                  Reisezeitraum und konkrete Termine werden nach der Gewinnbenachrichtigung gemeinsam
                  mit der Gewinnerin bzw. dem Gewinner abgestimmt; Flug- und Hotelverfügbarkeiten
                  bleiben vorbehalten. Kosten, die nicht ausdrücklich als Bestandteil des Gewinns
                  genannt sind (z. B. An- und Abreise zum Abflughafen, weitere Verpflegung, Visa- und
                  Reisedokumente, Reiseversicherungen), tragen die Reisenden selbst.
                </p>
                <p>
                  Die Begleitperson wählst du frei. Eine Barauszahlung ist ausgeschlossen. Alle
                  Einzelheiten:{" "}
                  <Link
                    href="/gewinn/teilnahmebedingungen"
                    className="font-medium text-[var(--vl-yellow)] underline underline-offset-4"
                  >
                    Teilnahmebedingungen
                  </Link>
                  .
                </p>
              </div>
            </details>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* E · 300 Gutscheine                                                 */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="gutscheine-heading" className="mx-auto max-w-6xl px-4 py-14 sm:px-8 lg:py-20">
          <SectionHeading
            id="gutscheine-heading"
            kicker="Weitere Gewinne"
            title={`${VOUCHER_TOTAL_COUNT} Gutscheine. Drei Marken. Viele Wünsche.`}
            intro={`Zusätzlich zur Dubai-Reise verlosen wir Gutscheine im Gesamtwert von ${VOUCHER_TOTAL_LABEL}.`}
          />
          <ul className="mt-10 grid gap-5 md:grid-cols-3" aria-label="Gutschein-Gewinne nach Marke">
            {VOUCHER_BRANDS.map((brand) => (
              <li
                key={brand.id}
                data-testid={`voucher-card-${brand.id}`}
                className="vl-ticket flex flex-col rounded-2xl border gw-hairline bg-white shadow-[0_24px_50px_-30px_rgba(7,62,67,0.45)]"
              >
                {/* Markenkopf (Ticket-Kopf) */}
                <div className="flex min-h-24 items-center justify-between gap-3 rounded-t-2xl bg-[var(--vl-petrol)] px-6 py-4 text-white">
                  <div className="min-w-0">
                    <p className="text-2xl font-semibold tracking-tight">{brand.name}</p>
                    <p className="mt-0.5 text-sm text-white/80">{brand.purpose}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--vl-yellow)] px-3 py-1 text-xs font-bold tracking-wide text-[var(--vl-ink)] uppercase">
                    Gutschein
                  </span>
                </div>
                <div className="vl-ticket-divider" aria-hidden="true" />
                {/* Staffeln */}
                <ul className="divide-y divide-[var(--vl-border-soft)] px-6">
                  {brand.tiers.map((t) => (
                    <li
                      key={t.valueEur}
                      className="flex items-baseline justify-between py-3 text-[var(--vl-ink)]"
                    >
                      <span className="text-sm font-medium">
                        <span className="text-lg font-semibold">{t.count}</span> × Gutschein
                      </span>
                      <span className="text-2xl font-bold tracking-tight">
                        <span className="vl-mark">{t.valueLabel}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {/* Summe als Wert-Badge */}
                <div className="mt-auto px-6 pt-4 pb-6">
                  <p className="inline-flex w-full items-center justify-center rounded-full bg-[var(--vl-yellow)] px-4 py-2.5 text-center text-sm font-bold text-[var(--vl-ink)]">
                    {voucherBrandCount(brand)} Gutscheine · Gesamtwert {formatEur(voucherBrandTotalEur(brand))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-center text-sm text-[var(--vl-ink-mute)]">
            Die Gutscheine werden verlost – sie sind kein Rabatt auf das Buch und kein Guthaben für
            jede Teilnahme. Pro Person wird höchstens ein Gewinn vergeben. Einlösebedingungen: siehe FAQ
            und Teilnahmebedingungen.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href={amazon.url}
              target="_blank"
              rel="noopener noreferrer"
              data-cta-id="gutscheine_amazon"
              data-gw-event="verlosung_amazon_klick"
              className={BTN_YELLOW}
            >
              {kauf.primaryCta}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(öffnet in neuem Tab)</span>
            </a>
            <a
              href="#teilnehmen"
              data-gw-event="verlosung_cta_teilnehmen_gewinne"
              className={`${TEXT_LINK} inline-flex min-h-[44px] items-center`}
            >
              Schon bestellt? Bestellnummer eintragen
            </a>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* I · Teilen                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="teilen"
          aria-labelledby="teilen-heading"
          className="border-y gw-hairline bg-white"
        >
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-8 lg:py-16">
            <SectionHeading
              id="teilen-heading"
              kicker="Weitersagen"
              title="Das könnte auch deinen Freunden gefallen."
              intro={`Teile dieses Angebot mit deinen Freunden: Eine Dubai-Reise für zwei und ${VOUCHER_TOTAL_COUNT} Gutscheine warten auf ihre Gewinner. Einfach den Link kopieren und weiterschicken!`}
            />
            <ShareBox
              className="mt-8"
              shareText={shareText}
              heading="Link zur Aktion"
              intro="Für deine Freunde gelten dieselben Bestell- und Registrierungsbedingungen – Teilen allein ist keine Teilnahme."
            />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* F · Buch und Händler                                               */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="buch-kaufen"
          aria-labelledby="buch-heading"
          className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14 sm:px-8 lg:py-20"
        >
          <div className="grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-14">
            <div className="mx-auto w-56 sm:w-64 lg:w-full">
              <Image
                src="/gewinn/buchcover.jpg"
                alt={`Buchcover: ${BUCH_TITEL} von ${BUCH_AUTOR}`}
                width={700}
                height={1115}
                sizes="(min-width: 1024px) 300px, 256px"
                className="rounded-lg shadow-[0_30px_60px_-28px_rgba(7,62,67,0.6)]"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.22em] text-[var(--vl-petrol)] uppercase">
                Das Buch
              </p>
              <h2
                id="buch-heading"
                lang="de"
                className="mt-3 text-3xl font-semibold tracking-tight text-balance hyphens-auto text-[var(--vl-petrol)] sm:text-4xl"
              >
                Eine Unternehmergeschichte ohne Guru-Versprechen.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-[var(--vl-ink-soft)]">
                In „{BUCH_TITEL}“ erzählt {BUCH_AUTOR} von seinem Weg als Unternehmer: von
                Entscheidungen, Rückschlägen und dem Mut, weiterzumachen. Eine persönliche Geschichte
                mit echten Erfahrungen – und ohne garantierte Erfolgsformel.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                {[
                  ["Autor", BUCH_AUTOR],
                  ["Untertitel", BUCH_UNTERTITEL],
                  ["Verlag", BUCH_VERLAG],
                  ["Format", BUCH_FORMAT_LABEL],
                  ["Preis", BUCH_PREIS_LABEL],
                  [kauf.released ? "Erschienen" : "Erscheint", BUCH_ERSCHEINT_LABEL],
                  ["ISBN", BUCH_ISBN13],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[var(--vl-ink-mute)]">{k}</dt>
                    <dd className="font-medium break-words text-[var(--vl-ink)]">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-8">
                <a
                  href={amazon.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cta-id="book_amazon"
                  data-gw-event="verlosung_amazon_klick"
                  className={`${BTN_YELLOW} w-full sm:w-auto`}
                >
                  {kauf.amazonCta}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">(öffnet in neuem Tab)</span>
                </a>
                <ul className="mt-3 flex flex-wrap gap-2" aria-label="Weitere Shops">
                  {otherRetailers.map((r) => (
                    <li key={r.id}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-cta-id={`book_${r.id}`}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--vl-border)] bg-white px-4 text-sm font-medium text-[var(--vl-ink)] outline-none hover:border-[var(--vl-petrol)] focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)]"
                      >
                        {r.label}
                        <ExternalLink className="h-3.5 w-3.5 text-[var(--vl-ink-mute)]" aria-hidden="true" />
                        <span className="sr-only">(öffnet in neuem Tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-[var(--vl-ink-mute)]">
                  Händlerlinks öffnen in einem neuen Tab – diese Seite bleibt für deine Teilnahme
                  geöffnet.
                </p>
              </div>

              <div className="mt-6 rounded-2xl border gw-hairline bg-white p-5 text-sm leading-relaxed text-[var(--vl-ink)]">
                <p>
                  <strong className="font-semibold">Bestellbestätigung aufbewahren.</strong> Mit deiner
                  Bestellnummer kannst du dich anschließend direkt hier zur Verlosung anmelden.
                </p>
                <p className="mt-2 text-[var(--vl-ink-soft)]">
                  Mehrere gültige Bestellungen? Registriere jede Bestellnummer einzeln und erhöhe damit
                  deine Chance auf einen Gewinn.
                </p>
                <a
                  href="#teilnehmen"
                  data-gw-event="verlosung_cta_teilnehmen_buch"
                  className={`${TEXT_LINK} mt-3 inline-flex min-h-[44px] items-center`}
                >
                  Schon bestellt? Bestellnummer eintragen
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* G · Spende                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="spende-heading"
          className="border-y gw-hairline bg-white"
        >
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center lg:py-16">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.22em] text-[var(--vl-petrol)] uppercase">
                Guter Zweck
              </p>
              <h2
                id="spende-heading"
                lang="de"
                className="mt-3 text-3xl font-semibold tracking-tight text-balance hyphens-auto text-[var(--vl-petrol)] sm:text-4xl"
              >
                Eine Geschichte lesen. Kinder unterstützen.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-[var(--vl-ink-soft)]">
                {SPENDEN_HINWEIS} Mit deiner Bestellung unterstützt du diese Spendenaktion –
                unabhängig davon, ob du bei der Verlosung gewinnst.
              </p>
              <p className="mt-3 text-sm text-[var(--vl-ink-mute)]">
                Gemeint sind die Einnahmen des Autors, nicht der gesamte Verkaufspreis. Der{" "}
                {SPENDEN_EMPFAENGER} ist Spendenempfänger und nicht an der Verlosung beteiligt.
              </p>
            </div>
            {/* Unverändertes Original-Logo auf weißem Grund (siehe public/inbox/README.md) */}
            <figure className="mx-auto flex w-full max-w-[260px] flex-col items-center rounded-2xl border gw-hairline bg-white p-6">
              <Image
                src="/inbox/kinderschutzbund.svg"
                alt="Der Kinderschutzbund"
                width={202}
                height={57}
                unoptimized
              />
              <figcaption className="mt-3 text-center text-xs text-[var(--vl-ink-mute)]">
                Spendenempfänger der Autoreneinnahmen
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* H · Teilnahmeformular                                              */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="teilnehmen"
          aria-labelledby="teilnehmen-heading"
          className="mx-auto max-w-3xl scroll-mt-16 px-4 py-14 sm:px-8 lg:py-20"
        >
          <SectionHeading
            id="teilnehmen-heading"
            kicker="Teilnehmen"
            title="Buch bestellt? Jetzt bist du dran."
            intro="Trage deine Bestellnummer und deine Angaben ein, um an der Verlosung teilzunehmen. Deine Bestellnummer findest du in der Bestellbestätigung deines Buchhändlers."
          />
          <div className="mt-8 flex items-start gap-3 rounded-2xl border-2 border-[var(--vl-petrol)]/25 bg-[var(--vl-yellow-soft)] p-4 text-sm leading-relaxed text-[var(--vl-ink)] sm:p-5">
            <Ticket className="mt-0.5 h-5 w-5 shrink-0 text-[var(--vl-petrol)]" aria-hidden="true" />
            <p>
              Jede gültige Bestellnummer zählt einmal. Wenn du mehrere gültige Bestellungen aufgegeben
              hast, kannst du jede Bestellnummer separat anmelden und so deine Gewinnchance erhöhen.
            </p>
          </div>
          <div className="mt-6">
            <ParticipationHost
              enabled={open}
              dialogTitle="Bestellnummer eintragen"
              inlineLabelId="teilnehmen-heading"
              form={
                open ? (
                  <VerlosungEntry
                    initialFormToken={formToken}
                    utm={utm}
                    privacyUrl={env.PRIVACY_URL ?? null}
                    shareText={shareText}
                  />
                ) : (
                  <ClosedNotice phase={phase} />
                )
              }
            />
          </div>
          <p className="mt-4 text-center text-xs text-[var(--vl-ink-mute)]">
            Registrierungsschluss: {ENTRY_DEADLINE_LABEL} (MESZ) · Teilnahme ab {MIN_AGE} Jahren mit
            Wohnsitz in {ELIGIBLE_COUNTRIES_LABEL}. Deine Formulardaten werden ausschließlich für das
            Gewinnspiel verwendet und nie an Werbenetzwerke übermittelt.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* J · FAQ                                                            */}
        {/* ---------------------------------------------------------------- */}
        <section id="faq" aria-labelledby="faq-heading" className="border-t gw-hairline bg-white">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-8 lg:py-20">
            <SectionHeading id="faq-heading" kicker="Fragen & Antworten" title="Häufige Fragen" />
            <div className="mt-8 divide-y divide-[var(--vl-border-soft)] rounded-2xl border gw-hairline bg-[var(--vl-ivory)]">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group px-5 py-1">
                  <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-left font-medium text-[var(--vl-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--vl-petrol)] [&::-webkit-details-marker]:hidden">
                    {q}
                    <span
                      aria-hidden="true"
                      className="text-2xl leading-none text-[var(--vl-petrol)] transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-5 text-sm leading-relaxed text-[var(--vl-ink-soft)]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* K · Abschluss-CTA                                                  */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="abschluss-heading" className="relative overflow-hidden">
          <Confetti className="hidden opacity-60 sm:block" />
          <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-8 lg:py-20">
            <h2
              id="abschluss-heading"
              lang="de"
              className="text-3xl font-semibold tracking-tight text-balance hyphens-auto text-[var(--vl-petrol)] sm:text-4xl"
            >
              Buch sichern, Bestellnummer eintragen, mitfiebern.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--vl-ink-soft)]">
              {TRIP_DURATION_LABEL} Dubai für zwei und {VOUCHER_TOTAL_COUNT} Gutscheine warten auf ihre
              Gewinnerinnen und Gewinner. Gewinnerbekanntgabe am {ANNOUNCEMENT_DATETIME_LABEL}.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={amazon.url}
                target="_blank"
                rel="noopener noreferrer"
                data-cta-id="abschluss_amazon"
                data-gw-event="verlosung_amazon_klick"
                className={BTN_YELLOW}
              >
                {kauf.primaryCta}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">(öffnet in neuem Tab)</span>
              </a>
              <a href="#teilnehmen" data-gw-event="verlosung_cta_teilnehmen_footer" className={BTN_PETROL}>
                Schon bestellt? Bestellnummer eintragen
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t gw-hairline bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-[var(--vl-ink-mute)] sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-md">
              <p className="font-semibold text-[var(--vl-ink)]">
                „{BUCH_TITEL}“ · {BUCH_AUTOR}
              </p>
              <p className="mt-2">
                Veranstalter des Gewinnspiels: {ORGANIZER_NAME}, {ORGANIZER_ADDRESS}. Kontakt:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-[var(--vl-petrol)]">
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p className="mt-2 text-xs">
                Wiresoft, Bikinilista und Amazon sind Marken der jeweiligen Inhaber; die Nennung
                bezeichnet die verlosten Gutscheine und bedeutet keine Sponsoring-Partnerschaft.
              </p>
            </div>
            <nav aria-label="Rechtliches">
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <li>
                  <Link
                    href="/gewinn/teilnahmebedingungen"
                    className="inline-flex min-h-[44px] items-center hover:text-[var(--vl-petrol)]"
                  >
                    Teilnahmebedingungen
                  </Link>
                </li>
                {env.PRIVACY_URL ? (
                  <li>
                    <a
                      href={env.PRIVACY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center hover:text-[var(--vl-petrol)]"
                    >
                      Datenschutz
                    </a>
                  </li>
                ) : null}
                {env.IMPRINT_URL ? (
                  <li>
                    <a
                      href={env.IMPRINT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center hover:text-[var(--vl-petrol)]"
                    >
                      Impressum
                    </a>
                  </li>
                ) : null}
                <li>
                  <ConsentSettingsButton className="inline-flex min-h-[44px] items-center hover:text-[var(--vl-petrol)]" />
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </footer>

      {/* Consent-Banner am Ende der Tab-Reihenfolge (Skip-Link und Inhalt zuerst) */}
      <ConsentBanner
        cookieName={consentCookie.name}
        acceptedValue={consentCookie.acceptedValue}
        privacyUrl={env.PRIVACY_URL ?? null}
      />
      <StickyCta
        heroId="hero"
        formId="teilnehmen"
        primary={{
          label: kauf.primaryCta,
          href: amazon.url,
          event: "verlosung_amazon_klick",
          external: true,
          ctaId: "sticky_amazon",
        }}
        secondary={{ label: "Bestellnummer eintragen", href: "#teilnehmen", event: "verlosung_sticky_teilnehmen" }}
      />
    </div>
  );
}
