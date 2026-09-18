import {
  BookOpen,
  ClipboardList,
  ExternalLink,
  HeartHandshake,
  Sparkles,
  Ticket,
  Trophy,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CardsEntry } from "@/components/cards/cards-entry";
import { CardsShareBox, CardsShareButton } from "@/components/cards/cards-share";
import { ProductShowcase } from "@/components/cards/product-showcase";
import { VoucherCard } from "@/components/cards/voucher-card";
import { GewinnTracking } from "@/components/gewinn/gewinn-tracking";
import { ParticipationHost } from "@/components/verlosung/participation-host";
import { StickyCta } from "@/components/verlosung/sticky-cta";
import { createBookConversionConfig } from "@/lib/book-conversion-context";
import {
  BUCH_AUTOR,
  BUCH_FORMAT_LABEL,
  BUCH_ISBN13,
  BUCH_PREIS_LABEL,
  BUCH_TITEL,
  BUCH_UNTERTITEL,
  BUCH_VERLAG,
  buchKaufLabels,
  SPENDEN_EMPFAENGER,
} from "@/lib/buch-config";
import {
  CARDS_ANNOUNCEMENT_LABEL,
  CARDS_CAMPAIGN_ID,
  CARDS_CARDMARKET_COUNT,
  CARDS_CARDMARKET_TOTAL_LABEL,
  CARDS_CARDMARKET_VALUE_LABEL,
  CARDS_DATES_LINE,
  CARDS_ENTRY_DEADLINE_LABEL,
  CARDS_ENTRY_PATH,
  CARDS_OG_DESCRIPTION,
  CARDS_OG_TITLE,
  CARDS_OP17_FACTS,
  CARDS_PRIZE_COUNT,
  CARDS_PRIZES,
  CARDS_SHARE_TEXT,
  CARDS_SHARE_TEXT_CLOSED,
  CARDS_TERMS_PATH,
  CARDS_URL,
  cardsAmazonCtaLabel,
  cardsPrizeFullLabel,
  cardsPrizeOverviewLabel,
  getCardsPhase,
  type CardsPrize,
} from "@/lib/cards-giveaway-config";
import { getEnv } from "@/lib/env";
import {
  CONTACT_EMAIL,
  ELIGIBLE_COUNTRIES_LABEL,
  MIN_AGE,
  ORGANIZER_ADDRESS,
  ORGANIZER_NAME,
  RETAILER_LINKS,
  type SweepstakesPhase,
} from "@/lib/gewinnspiel-config";
import { createRedditTrackingConfig } from "@/lib/reddit-context";
import { createFormToken } from "@/lib/sweepstakes-crypto";

/**
 * TCG-Gewinnspiel /cards – „Deine Sammlung. Dein nächster großer Moment.“
 *
 * Eigenständige Kampagne (cards_2026) mit eigenem Lostopf: Buch bei Amazon
 * bestellen, Bestellnummer registrieren, an der Verlosung von 17 Gewinnen
 * teilnehmen. Alle Mengen, Fristen, Bilder und Texte kommen aus
 * cards-giveaway-config.ts bzw. buch-config.ts. Vorgaben des Auftraggebers
 * (18.09.2026): echte Produktbilder, Case = 12 Boxen (OP-17, Magnificent
 * Monsters EU/englisch), Dragon Ball ST01 als Display; CTA-Wortlaut immer
 * „bestellen“; ausschließlich Amazon als beworbener Bestellweg; keine
 * Dubai-Nennung in den FAQ. Jeder Bestell-CTA führt direkt zu Amazon (neuer
 * Tab) und wird als Amazon-Outbound / AddToCart-Proxy erfasst; jeder
 * Teilnahme-Button öffnet dasselbe Formular im Dialog (ParticipationHost).
 *
 * Tracking: Entscheidung des Betreibers (Wiresoft Portal Ltd., 17./18.09.2026):
 * Alle Events feuern ohne Consent-Gate ("not-required") – wie auf /gewinn und
 * /verlosung (siehe docs/cards-kampagne.md).
 */

export const dynamic = "force-dynamic";

const TITLE = "One Piece OP-17 Case gewinnen – TCG-Gewinnspiel | Die Lizenz zum Erfolg";
const DESCRIPTION = `Buch „${BUCH_TITEL}“ bei Amazon bestellen, Bestellnummer registrieren und ${CARDS_PRIZE_COUNT} Gewinne für deine Sammlung gewinnen: 1 × One Piece OP-17 Case (12 Boxes), 3 × Fusion World ST01 Display, 3 × Magnificent Monsters Case (EU, englisch) und ${CARDS_CARDMARKET_COUNT} × ${CARDS_CARDMARKET_VALUE_LABEL} Cardmarket-Wertgutschein. 100 % der Autoreneinnahmen gehen an den Kinderschutzbund.`;
const OG_IMAGE = `${CARDS_URL}/og.jpg`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: CARDS_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: CARDS_OG_TITLE,
    description: CARDS_OG_DESCRIPTION,
    url: CARDS_URL,
    siteName: BUCH_TITEL,
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "Ein ganzes One Piece OP-17 Case, Dragon Ball Fusion World ST01 Display, Yu-Gi-Oh! Magnificent Monsters Case und Cardmarket-Guthaben zu gewinnen",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: CARDS_OG_TITLE,
    description: CARDS_OG_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const BTN =
  "inline-flex min-h-[52px] items-center justify-center gap-2 px-6 text-center text-base leading-tight font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--cd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cd-bg)]";
const BTN_GOLD = `${BTN} cd-btn-gold`;
const BTN_OUTLINE = `${BTN} cd-btn-outline`;
const NAV_LINK =
  "inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[var(--cd-ink-soft)] outline-none hover:text-[var(--cd-ink)] focus-visible:ring-2 focus-visible:ring-[var(--cd-gold)] sm:px-3";
const AMAZON_EVENT = "cards_amazon_klick";
const TRACKING_PARAMS = { giveaway_campaign: CARDS_CAMPAIGN_ID, landing_path: CARDS_ENTRY_PATH };

/** Einziger beworbener Bestellweg (Vorgabe des Auftraggebers): der geprüfte Amazon-Link. */
const AMAZON = RETAILER_LINKS.find((r) => r.primary) ?? RETAILER_LINKS[0]!;

const WORLD_DOT: Record<CardsPrize["world"], string> = {
  onepiece: "var(--cd-gold)",
  dragonball: "var(--cd-orange)",
  yugioh: "var(--cd-violet)",
  cardmarket: "var(--cd-cm-blue)",
};

function delay(ms: number): React.CSSProperties {
  return { "--cd-delay": `${ms}ms` } as React.CSSProperties;
}

/** Amazon-CTA: echter Link zum geprüften Produktlink; Klick = AddToCart-Proxy (book-conversion-tracking). */
function AmazonLink({
  ctaId,
  className,
  children,
}: {
  ctaId: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={AMAZON.url}
      target="_blank"
      rel="noopener noreferrer"
      data-cta-id={ctaId}
      data-gw-event={AMAZON_EVENT}
      className={className}
    >
      {children}
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">(öffnet in neuem Tab)</span>
    </a>
  );
}

function SectionHeading({
  kicker,
  title,
  intro,
  id,
  align = "center",
  tone = "dark",
}: {
  kicker?: string;
  title: string;
  intro?: React.ReactNode;
  id: string;
  align?: "center" | "left";
  tone?: "dark" | "light";
}) {
  const light = tone === "light";
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {kicker ? (
        <p
          className={`text-xs font-semibold tracking-[0.24em] uppercase ${
            light ? "text-[#7a5a12]" : "text-[var(--cd-gold)]"
          }`}
        >
          {kicker}
        </p>
      ) : null}
      <h2
        id={id}
        lang="de"
        className={`cd-display mt-3 text-3xl font-semibold text-balance hyphens-auto sm:text-4xl ${
          light ? "text-[var(--cd-ivory-ink)]" : "text-[var(--cd-ink)]"
        }`}
      >
        {title}
      </h2>
      {intro ? (
        <p className={`mt-4 text-lg ${light ? "text-[#4a4335]" : "text-[var(--cd-ink-soft)]"}`}>
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
      data-testid="cards-closed"
      className="cd-holo rounded-2xl bg-[var(--cd-surface)] p-8 text-center sm:p-12"
    >
      <Trophy
        className="mx-auto h-10 w-10 text-[var(--cd-gold)]"
        aria-hidden="true"
        strokeWidth={1.5}
      />
      {phase === "announced" ? (
        <>
          <h3 className="cd-display mt-5 text-2xl font-semibold text-[var(--cd-ink)]">
            Teilnahme beendet · Gewinnerbekanntgabe: {CARDS_ANNOUNCEMENT_LABEL}
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-[var(--cd-ink-soft)]">
            Die Gewinnerinnen und Gewinner werden über die angegebene E-Mail-Adresse und
            gegebenenfalls telefonisch benachrichtigt. Das Buch gibt es weiterhin – eine neue
            Teilnahme ist nicht mehr möglich.
          </p>
        </>
      ) : (
        <>
          <h3 className="cd-display mt-5 text-2xl font-semibold text-[var(--cd-ink)]">
            Die Teilnahme am Cards-Gewinnspiel ist beendet.
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-[var(--cd-ink-soft)]">
            Die Gewinner werden am{" "}
            <strong className="font-semibold text-[var(--cd-ink)]">
              {CARDS_ANNOUNCEMENT_LABEL}
            </strong>{" "}
            bekannt gegeben. Das Buch gibt es weiterhin – eine neue Teilnahme ist nicht mehr
            möglich.
          </p>
        </>
      )}
    </div>
  );
}

/** Kleine Funkel-Sterne um den Hauptgewinn (rein dekorativ). */
function SparkleField() {
  const stars: Array<[number, number, number, number]> = [
    [4, 12, 14, 0],
    [90, 8, 10, 500],
    [95, 44, 8, 900],
    [2, 60, 9, 1300],
    [82, 86, 12, 300],
    [12, 88, 7, 1700],
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {stars.map(([x, y, s, d]) => (
        <span
          key={`${x}-${y}`}
          className="cd-sparkle"
          style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, ...delay(d) }}
        />
      ))}
    </div>
  );
}

export default async function CardsPage({
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
  const phase = getCardsPhase(now);
  const open = phase === "open";
  const kauf = buchKaufLabels(now);
  const amazonLabel = cardsAmazonCtaLabel();
  const formToken = createFormToken();
  const env = getEnv();
  const shareText = open ? CARDS_SHARE_TEXT : CARDS_SHARE_TEXT_CLOSED;
  const [op17, dragonBall, yugioh, cardmarket] = CARDS_PRIZES as readonly [
    CardsPrize,
    CardsPrize,
    CardsPrize,
    CardsPrize,
  ];

  const FAQ: Array<{ q: string; a: string }> = [
    {
      q: "Wie nehme ich teil?",
      a: `Bestelle „${BUCH_TITEL}“ bei Amazon über den Button auf dieser Seite und registriere danach deine Bestellnummer hier auf lizenzzumerfolg.com/cards im Teilnahmeformular. Der Kauf allein ist keine Anmeldung – erst mit der gespeicherten Registrierung bist du im Cards-Lostopf.`,
    },
    {
      q: "Was kann ich gewinnen?",
      a: `Genau ${CARDS_PRIZE_COUNT} Gewinne: ${cardsPrizeFullLabel(op17)} als Hauptgewinn – ein ganzes Case mit ${op17.contents}; ${cardsPrizeFullLabel(dragonBall)} – jeweils ein Display (Booster Box mit 20 Packs), kein Case; ${cardsPrizeFullLabel(yugioh)} – jeweils ein ganzes Case mit 12 Boxen der englischsprachigen EU-Version; und ${cardsPrizeFullLabel(cardmarket)} (zusammen ${CARDS_CARDMARKET_TOTAL_LABEL}).`,
    },
    {
      q: "Erhöhen mehrere Bestellnummern meine Chance?",
      a: "Ja. Jede weitere gültige, separat registrierte Bestellnummer gibt dir ein weiteres Los. Dieselbe Bestellnummer zählt in dieser Aktion nur einmal. Pro Person wird innerhalb des Cards-Gewinnspiels höchstens ein Gewinn vergeben.",
    },
    {
      q: "Zählen mehrere Bücher aus einer Bestellung mehrfach?",
      a: "Nein. Es zählt die gültige Bestellnummer, nicht die Anzahl der Bücher darin. Mehrere Bücher unter einer Bestellnummer ergeben ein Los.",
    },
    {
      q: "Wo bestelle ich das Buch?",
      a: `Bei Amazon – direkt über den Bestell-Button auf dieser Seite. Nach der Bestellung findest du deine Bestellnummer in der Amazon-Bestellbestätigung (Format z. B. 306-1234567-1234567) und trägst sie hier im Formular ein.`,
    },
    {
      q: "Was wird gespendet?",
      a: `100 % der Autoreneinnahmen aus diesem Buch gehen an den ${SPENDEN_EMPFAENGER}. Gemeint sind die Autoreneinnahmen, nicht der gesamte Kaufpreis. Du tätigst mit deiner Bestellung keine eigene Spende und erhältst keine Spendenbescheinigung; der ${SPENDEN_EMPFAENGER} ist an der Verlosung nicht beteiligt.`,
    },
    {
      q: "Bis wann kann ich teilnehmen?",
      a: `Bis zum ${CARDS_ENTRY_DEADLINE_LABEL} – also 05.10.2026 um 23:59 Uhr deutscher Zeit. Deine Registrierung muss bis dahin beim Server eingegangen sein und anschließend erfolgreich gespeichert werden.`,
    },
    {
      q: "Wann werden die Gewinner bekannt gegeben?",
      a: `Am ${CARDS_ANNOUNCEMENT_LABEL}. Gewinnerinnen und Gewinner werden über die angegebene E-Mail-Adresse und gegebenenfalls telefonisch benachrichtigt.`,
    },
    {
      q: "Muss ich das Gewinnspiel teilen?",
      a: "Nein. Teilen ist freiwillig und bringt keine zusätzlichen Lose – wir freuen uns aber, wenn deine Community davon erfährt.",
    },
  ];

  return (
    <div id="top" className="cards-theme min-h-screen pb-24 md:pb-0">
      <GewinnTracking
        gtmContainerId={env.GTM_CONTAINER_ID ?? null}
        ga4MeasurementId={env.GA4_MEASUREMENT_ID ?? null}
        metaPixelId={env.META_PIXEL_ID ?? null}
        tiktokPixelId={env.TIKTOK_PIXEL_ID ?? null}
        redditPixelId={env.REDDIT_PIXEL_ID ?? null}
        redditTracking={createRedditTrackingConfig("/cards", "not-required")}
        bookConversion={await createBookConversionConfig("/cards", "not-required", {
          eventParams: { giveaway_campaign: CARDS_CAMPAIGN_ID },
        })}
        linkedInPartnerId={env.LINKEDIN_PARTNER_ID ?? null}
        consentMode="not-required"
        consentCookieName={env.CONSENT_COOKIE_NAME ?? null}
        consentAcceptedValue={env.CONSENT_COOKIE_ACCEPTED_VALUE ?? null}
        pageEventName="cards_seite"
        eventParams={TRACKING_PARAMS}
      />

      <a
        href="#teilnehmen"
        data-no-dialog=""
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[var(--cd-gold)] focus:px-4 focus:py-2 focus:text-[var(--cd-gold-ink)]"
      >
        Zum Teilnahmeformular springen
      </a>

      {/* ------------------------------------------------------------------ */}
      {/* A · Header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-30 border-b border-[var(--cd-border)] bg-[rgba(8,12,24,0.9)] shadow-[0_1px_0_rgba(255,213,106,0.12),0_10px_30px_-20px_rgba(0,0,0,0.9)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-2 px-4 sm:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-2.5">
            <span className="cd-display truncate text-sm font-semibold text-[var(--cd-ink)] sm:text-base">
              <span className="hidden sm:inline">{BUCH_TITEL}</span>
              <span className="hidden min-[430px]:inline sm:hidden">Lizenz zum Erfolg</span>
            </span>
            <span className="shrink-0 rounded-md border border-[var(--cd-border)] px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-[var(--cd-gold)] uppercase">
              TCG-Gewinnspiel
            </span>
          </a>
          <nav aria-label="Seitenbereiche">
            <ul className="flex items-center gap-0.5 sm:gap-1">
              <li className="hidden min-[420px]:block">
                <a href="#gewinne" className={NAV_LINK}>
                  Gewinne
                </a>
              </li>
              <li className="hidden sm:block">
                <a href="#so-gehts" className={NAV_LINK}>
                  So geht’s
                </a>
              </li>
              {open ? (
                <li>
                  <a
                    href="#teilnehmen"
                    data-gw-event="cards_cta_teilnehmen_header"
                    data-cta-id="header"
                    className={`${NAV_LINK} cd-btn-gold px-3.5 text-[var(--cd-gold-ink)] hover:text-[var(--cd-gold-ink)]`}
                  >
                    Teilnehmen
                  </a>
                </li>
              ) : null}
              <li>
                <CardsShareButton shareText={shareText} className={NAV_LINK} />
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
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(55% 50% at 74% 42%, rgba(255,213,106,0.16) 0%, transparent 60%), radial-gradient(40% 40% at 6% 92%, rgba(81,217,237,0.12) 0%, transparent 60%), radial-gradient(30% 30% at 96% 96%, rgba(168,139,255,0.14) 0%, transparent 60%), linear-gradient(180deg, #0a1020 0%, var(--cd-bg) 70%)",
            }}
          />
          <div
            className="cd-dots pointer-events-none absolute inset-y-0 left-0 hidden w-28 opacity-50 lg:block"
            aria-hidden="true"
          />
          <div
            className="cd-dots pointer-events-none absolute inset-y-0 right-0 hidden w-28 opacity-50 lg:block"
            aria-hidden="true"
          />

          <div className="relative mx-auto grid max-w-[1320px] grid-cols-1 gap-x-10 gap-y-7 px-4 pt-8 pb-10 sm:px-8 lg:grid-cols-[45fr_55fr] lg:grid-rows-[auto_auto] lg:items-center lg:pt-14 lg:pb-16">
            {/* Text oben (mobil zuerst) */}
            <div className="lg:col-start-1 lg:row-start-1">
              <p
                className="cd-rise text-[11px] font-semibold tracking-[0.24em] text-[var(--cd-cyan)] uppercase sm:text-xs"
                style={delay(0)}
              >
                Für One-Piece-, Dragon-Ball- und Yu-Gi-Oh!-Fans
              </p>
              <h1
                id="hero-heading"
                className="cd-display cd-rise mt-4 text-[2.5rem] leading-[1.0] font-bold text-balance text-[var(--cd-ink)] sm:text-5xl lg:text-[4.1rem]"
                style={delay(60)}
              >
                Ein ganzes OP-17 Case.
                <br />
                <span className="cd-foil-text">Vielleicht bald deins.</span>
              </h1>
              <p
                className="cd-rise mt-5 inline-flex max-w-full items-center gap-2 rounded-md border border-[var(--cd-gold)]/60 bg-[rgba(255,213,106,0.08)] px-3 py-1.5 text-[11px] font-bold tracking-[0.16em] text-[var(--cd-gold)] uppercase sm:text-xs"
                data-testid="hero-badge"
                style={delay(120)}
              >
                <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Hauptgewinn · 1 × One Piece OP-17 Case
              </p>
            </div>

            {/* Produktbühne: mobil gestapelt (OP-17 groß, dann Display/Case, dann Gutschein), Desktop als Szene */}
            <div
              className="relative grid grid-cols-2 gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block lg:h-[640px]"
              data-testid="hero-stage"
            >
              <div
                className="cd-speedlines pointer-events-none absolute inset-0 opacity-70"
                aria-hidden="true"
              />
              <div
                className="cd-burst pointer-events-none absolute top-[38%] left-1/2 hidden h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 opacity-80 lg:block"
                aria-hidden="true"
              />
              <div
                className="cd-glow-gold pointer-events-none absolute top-[40%] left-1/2 h-[70%] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                aria-hidden="true"
              />

              <div
                className="cd-rise relative col-span-2 mx-auto w-full max-w-[380px] lg:absolute lg:top-0 lg:left-[19%] lg:w-[58%] lg:max-w-none"
                style={delay(180)}
              >
                <SparkleField />
                <ProductShowcase prize={op17} size="hero" priority showCaption={false} />
              </div>
              <div
                className="cd-rise relative lg:absolute lg:bottom-[12%] lg:left-0 lg:w-[27%] lg:-rotate-3"
                style={delay(320)}
              >
                <ProductShowcase prize={dragonBall} size="mini" showCaption={false} />
              </div>
              <div
                className="cd-rise relative lg:absolute lg:right-0 lg:bottom-[26%] lg:w-[24%] lg:rotate-3"
                style={delay(400)}
              >
                <ProductShowcase prize={yugioh} size="mini" showCaption={false} />
              </div>
              <div
                className="cd-rise relative col-span-2 lg:absolute lg:right-[1%] lg:bottom-0 lg:w-[46%]"
                style={delay(480)}
              >
                <VoucherCard
                  count={CARDS_CARDMARKET_COUNT}
                  valueLabel={CARDS_CARDMARKET_VALUE_LABEL}
                  totalLabel={CARDS_CARDMARKET_TOTAL_LABEL}
                />
              </div>
              <p className="col-span-2 text-center text-[11px] text-[var(--cd-ink-mute)] lg:absolute lg:right-0 lg:-bottom-7 lg:text-right">
                Abbildungen: je eine Box bzw. ein Display der Produkte (englische Ausgaben) ·
                Gutschein als Gestaltung
              </p>
            </div>

            {/* Text unten: Erklärung, CTAs, Teilen, Microcopy, Spende, Termine */}
            <div className="lg:col-start-1 lg:row-start-2">
              <p
                className="cd-rise text-lg text-[var(--cd-ink-soft)] sm:text-xl"
                style={delay(160)}
              >
                Hol dir „{BUCH_TITEL}“ von {BUCH_AUTOR} bei Amazon. Trage danach deine Bestellnummer
                ein und nimm an der Verlosung von {CARDS_PRIZE_COUNT} Gewinnen für deine Sammlung
                teil.
              </p>
              <div
                className="cd-rise mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
                style={delay(240)}
              >
                <AmazonLink ctaId="hero_amazon" className={BTN_GOLD}>
                  {amazonLabel}
                </AmazonLink>
                {open ? (
                  <a
                    href="#teilnehmen"
                    data-gw-event="cards_cta_teilnehmen_hero"
                    data-cta-id="hero"
                    className={BTN_OUTLINE}
                  >
                    Buch schon gekauft? Jetzt eintragen
                  </a>
                ) : (
                  <span className="inline-flex min-h-[52px] items-center rounded-xl border border-[var(--cd-border-soft)] px-4 text-sm text-[var(--cd-ink-soft)]">
                    Teilnahme beendet · Gewinnerbekanntgabe: {CARDS_ANNOUNCEMENT_LABEL}
                  </span>
                )}
                <span data-testid="hero-share" className="inline-flex">
                  <CardsShareButton
                    shareText={shareText}
                    showLabel
                    position="hero"
                    className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--cd-border)] px-5 text-sm font-semibold text-[var(--cd-ink)] outline-none hover:bg-[var(--cd-surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--cd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cd-bg)] sm:w-auto"
                  />
                </span>
              </div>
              <p className="cd-rise mt-4 text-sm text-[var(--cd-ink-soft)]" style={delay(300)}>
                Buchkauf + Registrierung der Bestellnummer erforderlich. Die Teilnahme erfolgt nicht
                automatisch.
              </p>
              <p
                className="cd-rise mt-3 flex items-start gap-2 text-base font-semibold"
                style={delay(340)}
                data-testid="hero-donation"
              >
                <HeartHandshake
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cd-gold)]"
                  aria-hidden="true"
                />
                <span className="cd-shine">
                  100 % der Autoreneinnahmen gehen an den {SPENDEN_EMPFAENGER}.
                </span>
              </p>
              <p
                className="cd-rise mt-3 text-sm text-[var(--cd-ink-soft)]"
                style={delay(380)}
                data-testid="hero-dates"
              >
                {CARDS_DATES_LINE}
              </p>
              <div
                className="cd-rise mt-6 flex items-center gap-3 rounded-xl border border-[var(--cd-border-soft)] bg-[rgba(18,26,44,0.7)] p-3"
                style={delay(420)}
              >
                <AmazonLink
                  ctaId="hero_cover_amazon"
                  className="shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--cd-gold)]"
                >
                  <Image
                    src="/gewinn/buchcover.jpg"
                    alt={`Buchcover „${BUCH_TITEL}“`}
                    width={56}
                    height={89}
                    priority
                    className="h-[89px] w-[56px] rounded-sm object-cover shadow-[0_10px_24px_-10px_rgba(0,0,0,0.9)]"
                  />
                </AmazonLink>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-[var(--cd-ink)]">
                    „{BUCH_TITEL}“ · {BUCH_AUTOR}
                  </p>
                  <p className="text-[var(--cd-ink-soft)]">
                    {BUCH_FORMAT_LABEL} · {BUCH_PREIS_LABEL} · {kauf.availability}
                  </p>
                  <p className="text-xs text-[var(--cd-ink-mute)]">
                    Der Buchkauf ist die Teilnahmevoraussetzung – die Bestellnummer trägst du danach
                    hier ein.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Kompakte Gewinnübersicht */}
          <div className="relative mx-auto max-w-[1320px] px-4 pb-10 sm:px-8">
            <ul
              className="flex flex-wrap items-center gap-2"
              aria-label="Gewinnübersicht"
              data-testid="prize-overview"
            >
              {CARDS_PRIZES.map((prize, i) => (
                <li
                  key={prize.id}
                  data-testid={`prize-chip-${prize.id}`}
                  className={`cd-rise inline-flex min-h-[40px] items-center gap-2 rounded-lg border px-3 text-sm font-medium text-[var(--cd-ink)] ${
                    prize.main
                      ? "border-[var(--cd-gold)]/60 bg-[rgba(255,213,106,0.1)]"
                      : "border-[var(--cd-border-soft)] bg-[rgba(18,26,44,0.8)]"
                  }`}
                  style={delay(520 + i * 60)}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    aria-hidden="true"
                    style={{ background: WORLD_DOT[prize.world] }}
                  />
                  {cardsPrizeOverviewLabel(prize)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* C · Hauptgewinn                                                   */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="gewinne"
          aria-labelledby="gewinne-heading"
          className="relative scroll-mt-16 border-t border-[var(--cd-border-soft)]"
        >
          <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-8 lg:py-20">
            <div className="cd-panel cd-world-onepiece cd-corners relative overflow-hidden p-6 sm:p-10 lg:p-14">
              <div
                className="cd-speedlines pointer-events-none absolute inset-0 opacity-50"
                aria-hidden="true"
              />
              <div className="relative grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
                <div>
                  <p className="text-xs font-semibold tracking-[0.24em] text-[var(--cd-gold)] uppercase">
                    Hauptgewinn · Case = 12 Booster Boxes
                  </p>
                  <h2
                    id="gewinne-heading"
                    lang="de"
                    className="cd-display mt-3 text-3xl font-semibold text-balance hyphens-auto text-[var(--cd-ink)] sm:text-4xl lg:text-5xl"
                  >
                    Ein ganzes Case. Ein großer Moment für deine Sammlung.
                  </h2>
                  <p
                    className="cd-display mt-5 text-xl font-semibold text-[var(--cd-gold)]"
                    data-testid="main-prize-name"
                  >
                    {op17.headline}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--cd-cyan)]">{op17.subline}</p>
                  <p className="mt-3 text-lg text-[var(--cd-ink-soft)]">{op17.description}</p>
                  <p className="mt-3 text-[var(--cd-ink-soft)]">
                    Dein nächster großer Fund könnte ein ganzes OP-17-Case sein.
                  </p>
                  <ul className="mt-5 flex flex-wrap gap-2" aria-label="Fakten zum Hauptgewinn">
                    {CARDS_OP17_FACTS.map((fact) => (
                      <li
                        key={fact}
                        className="inline-flex min-h-[36px] items-center rounded-md border border-[var(--cd-gold)]/40 bg-[rgba(255,213,106,0.08)] px-3 text-sm text-[var(--cd-ink)]"
                      >
                        {fact}
                      </li>
                    ))}
                  </ul>
                  <details className="mt-4 text-sm text-[var(--cd-ink-soft)]">
                    <summary className="cursor-pointer font-medium text-[var(--cd-cyan)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cd-cyan)]">
                      Details zu Ausgabe und Umfang
                    </summary>
                    <p className="mt-2">
                      Verlost wird ein ganzes Case des Booster-Sets OP-17 „The World’s Strongest
                      Warriors“ (ONE PIECE CARD GAME): {op17.contents}. Abgebildet ist eine der
                      Booster Boxes (englische Ausgabe). Einzelne Karten, ein bestimmter Inhalt oder
                      ein Marktwert werden nicht zugesagt. Details stehen in den{" "}
                      <Link
                        href={CARDS_TERMS_PATH}
                        className="underline decoration-[var(--cd-gold)]/50 underline-offset-2 hover:text-[var(--cd-gold)]"
                      >
                        Teilnahmebedingungen
                      </Link>
                      .
                    </p>
                  </details>
                  <div className="mt-8">
                    <AmazonLink ctaId="gewinne_amazon" className={BTN_GOLD}>
                      {open ? "Buch holen & Teilnahme sichern" : amazonLabel}
                    </AmazonLink>
                    {open ? (
                      <p className="mt-3 text-sm text-[var(--cd-ink-soft)]">
                        Nach dem Kauf Bestellnummer{" "}
                        <a
                          href="#teilnehmen"
                          data-gw-event="cards_cta_teilnehmen_gewinne"
                          data-cta-id="gewinne"
                          className="font-medium text-[var(--cd-cyan)] underline decoration-[var(--cd-cyan)]/50 underline-offset-2 hover:decoration-[var(--cd-cyan)]"
                        >
                          hier registrieren
                        </a>
                        .
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="relative mx-auto w-full max-w-[460px]">
                  <SparkleField />
                  <ProductShowcase prize={op17} size="hero" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* D · Weitere Gewinne                                               */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="weitere-heading" className="relative">
          <div className="mx-auto max-w-[1320px] px-4 pb-14 sm:px-8 lg:pb-20">
            <SectionHeading
              id="weitere-heading"
              kicker="Weitere Gewinne"
              title="Noch mehr für deine Sammlung."
            />
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <article
                data-testid={`prize-panel-${dragonBall.id}`}
                className="cd-panel cd-world-dragonball cd-corners relative overflow-hidden p-6 sm:p-8"
                style={{ "--cd-corner": "var(--cd-orange)" } as React.CSSProperties}
              >
                <div className="cd-rays pointer-events-none absolute inset-0" aria-hidden="true" />
                <div className="relative grid gap-6 sm:grid-cols-[1fr_220px] sm:items-center">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.24em] text-[var(--cd-orange)] uppercase">
                      Dragon Ball · {dragonBall.productCode} · Display
                    </p>
                    <h3 className="cd-display mt-3 text-2xl font-semibold text-[var(--cd-ink)] sm:text-3xl">
                      {dragonBall.headline}
                    </h3>
                    <p className="mt-1 font-medium text-[var(--cd-blue)]">{dragonBall.subline}</p>
                    <p className="mt-3 text-[var(--cd-ink-soft)]">{dragonBall.description}</p>
                    <p className="mt-2 text-xs text-[var(--cd-ink-mute)]">{dragonBall.contents}</p>
                  </div>
                  <div className="mx-auto w-full max-w-[280px] sm:max-w-none">
                    <ProductShowcase prize={dragonBall} size="panel" />
                  </div>
                </div>
              </article>

              <article
                data-testid={`prize-panel-${yugioh.id}`}
                className="cd-panel cd-world-yugioh cd-corners relative overflow-hidden p-6 sm:p-8"
                style={{ "--cd-corner": "var(--cd-violet)" } as React.CSSProperties}
              >
                <div
                  className="cd-geo pointer-events-none absolute inset-0 opacity-70"
                  aria-hidden="true"
                />
                <div className="relative grid gap-6 sm:grid-cols-[1fr_220px] sm:items-center">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.24em] text-[var(--cd-violet)] uppercase">
                      Yu-Gi-Oh! · {yugioh.variant} · Case
                    </p>
                    <h3 className="cd-display mt-3 text-2xl font-semibold text-[var(--cd-ink)] sm:text-3xl">
                      {yugioh.headline}
                    </h3>
                    <p
                      className="mt-1 font-medium text-[var(--cd-gold)]"
                      data-testid="yugioh-variant"
                    >
                      {yugioh.variant}
                    </p>
                    <p className="mt-1 text-sm text-[var(--cd-ink-soft)]">{yugioh.subline}</p>
                    <p className="mt-3 text-[var(--cd-ink-soft)]">{yugioh.description}</p>
                  </div>
                  <div className="mx-auto w-full max-w-[280px] sm:max-w-none">
                    <ProductShowcase prize={yugioh} size="panel" />
                  </div>
                </div>
              </article>

              <article
                data-testid={`prize-panel-${cardmarket.id}`}
                className="cd-panel cd-world-cardmarket cd-corners relative overflow-hidden p-6 sm:p-8 lg:col-span-2"
                style={{ "--cd-corner": "var(--cd-cm-blue)" } as React.CSSProperties}
              >
                <div className="relative grid gap-6 lg:grid-cols-[1fr_400px] lg:items-center">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.24em] text-[var(--cd-cm-blue)] uppercase">
                      Cardmarket · 10 Gewinne
                    </p>
                    <h3 className="cd-display mt-3 text-2xl font-semibold text-[var(--cd-ink)] sm:text-3xl">
                      {cardmarket.headline}
                    </h3>
                    <p className="mt-1 font-medium text-[var(--cd-cm-blue)]">
                      {cardmarket.subline}
                    </p>
                    <p className="mt-3 max-w-2xl text-[var(--cd-ink-soft)]">
                      {cardmarket.description}
                    </p>
                    <p className="mt-2 text-xs text-[var(--cd-ink-mute)]">
                      Es gelten die offiziellen Einlösebedingungen von Cardmarket (siehe
                      Teilnahmebedingungen). Gestaltete Darstellung – kein einlösbarer Code.
                    </p>
                  </div>
                  <div className="mx-auto w-full max-w-[400px]">
                    <VoucherCard
                      count={CARDS_CARDMARKET_COUNT}
                      valueLabel={CARDS_CARDMARKET_VALUE_LABEL}
                      totalLabel={CARDS_CARDMARKET_TOTAL_LABEL}
                    />
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* E · Ablauf                                                        */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="so-gehts"
          aria-labelledby="so-gehts-heading"
          className="scroll-mt-16 border-t border-[var(--cd-border-soft)] bg-[var(--cd-bg-deep)]"
        >
          <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-8 lg:py-20">
            <SectionHeading
              id="so-gehts-heading"
              kicker="So geht’s"
              title="Dein Weg in den Lostopf."
            />
            <ol
              className="mt-10 grid gap-4 md:grid-cols-3"
              aria-label="Drei Schritte zur Teilnahme"
            >
              {[
                {
                  icon: BookOpen,
                  title: "Buch bei Amazon bestellen.",
                  text: `Bestelle „${BUCH_TITEL}“ direkt über den Amazon-Button auf dieser Seite.`,
                },
                {
                  icon: ClipboardList,
                  title: "Bestellnummer eintragen.",
                  text: "Komm auf diese Seite zurück und registriere deinen Kauf über das Formular.",
                },
                {
                  icon: Sparkles,
                  title: "An der Verlosung teilnehmen.",
                  text: "Deine gültige Anmeldung wird im eigenständigen Cards-Gewinnspiel berücksichtigt.",
                },
              ].map((step, i) => (
                <li
                  key={step.title}
                  className="cd-holo relative rounded-2xl bg-[var(--cd-surface)] p-6"
                >
                  <div className="flex items-center gap-3">
                    <span className="cd-display flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--cd-gold)] text-lg font-bold text-[var(--cd-gold-ink)]">
                      {i + 1}
                    </span>
                    <step.icon className="h-5 w-5 text-[var(--cd-cyan)]" aria-hidden="true" />
                  </div>
                  <h3 className="cd-display mt-4 text-xl font-semibold text-[var(--cd-ink)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[var(--cd-ink-soft)]">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--cd-gold)]/40 bg-[rgba(255,213,106,0.07)] p-5 sm:p-6">
              <Ticket
                className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cd-gold)]"
                aria-hidden="true"
              />
              <div>
                <h3 className="cd-display text-xl font-semibold text-[var(--cd-ink)]">
                  Jede gültige Bestellnummer zählt als ein Los.
                </h3>
                <p className="mt-2 text-[var(--cd-ink-soft)]">
                  Mit jeder weiteren gültigen Bestellung und der Registrierung ihrer eigenen
                  Bestellnummer erhältst du ein zusätzliches Los und erhöhst deine Gewinnchance.
                  Dieselbe Bestellnummer kann im Cards-Gewinnspiel nur einmal teilnehmen.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* F · Buch und Kinderschutz (ruhige helle Fläche)                   */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="buch"
          aria-labelledby="buch-heading"
          className="scroll-mt-16 bg-[var(--cd-ivory)] text-[var(--cd-ivory-ink)]"
        >
          <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-14 sm:px-8 lg:grid-cols-[300px_1fr] lg:items-start lg:py-20">
            <figure className="mx-auto w-full max-w-[240px] lg:max-w-none">
              <AmazonLink
                ctaId="buch_cover_amazon"
                className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#7a5a12]"
              >
                <Image
                  src="/gewinn/buchcover.jpg"
                  alt={`Buchcover „${BUCH_TITEL}“ von ${BUCH_AUTOR}`}
                  width={700}
                  height={1115}
                  sizes="(min-width: 1024px) 300px, 240px"
                  className="h-auto w-full rounded-md object-contain shadow-[0_30px_60px_-24px_rgba(0,0,0,0.6)]"
                />
              </AmazonLink>
              <figcaption className="mt-3 text-center text-xs text-[#6b6455]">
                Originalcover · {BUCH_FORMAT_LABEL} · {BUCH_VERLAG} · ISBN {BUCH_ISBN13}
              </figcaption>
            </figure>
            <div>
              <SectionHeading
                id="buch-heading"
                kicker="Das Buch"
                title="Eine Geschichte für dich. Unterstützung für Kinder."
                align="left"
                tone="light"
              />
              <p className="mt-5 text-lg text-[#4a4335]">
                „{BUCH_TITEL}“ erzählt {BUCH_AUTOR}s Unternehmergeschichte – mit Entscheidungen,
                Umwegen und Fehlern. Eine persönliche Geschichte aus dem echten Leben.{" "}
                <span className="text-[#6b6455]">{BUCH_UNTERTITEL}.</span>
              </p>
              <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-[#e2d9c4] bg-white p-5 sm:flex-row sm:items-center sm:p-6">
                <div className="flex shrink-0 items-center justify-center rounded-xl bg-white p-2">
                  {/* Unverändertes Original-Logo auf Weiß (public/inbox/README.md) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/inbox/kinderschutzbund.svg"
                    alt="Logo des Kinderschutzbundes"
                    width={140}
                    height={60}
                    loading="lazy"
                    className="h-auto w-[140px]"
                  />
                </div>
                <div>
                  <p
                    className="cd-display text-xl font-semibold text-[var(--cd-ivory-ink)]"
                    data-testid="donation-promise"
                  >
                    {BUCH_AUTOR} spendet 100 % seiner Einnahmen aus diesem Buch an den{" "}
                    {SPENDEN_EMPFAENGER}.
                  </p>
                  <p className="mt-2 text-[#4a4335]">
                    Mit deinem Buchkauf unterstützt du damit zugleich den Schutz von Kindern. Nach
                    der Registrierung deiner Bestellnummer kannst du außerdem am Cards-Gewinnspiel
                    teilnehmen.
                  </p>
                  <p className="mt-2 text-sm text-[#6b6455]">
                    Gespendet werden die Autoreneinnahmen aus dem Buchverkauf. Spendenempfänger der
                    Autoreneinnahmen – keine Beteiligung am Gewinnspiel.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#4a4335]">
                <span className="font-semibold text-[var(--cd-ivory-ink)]">{BUCH_PREIS_LABEL}</span>
                <span>{BUCH_FORMAT_LABEL}</span>
                <span>{kauf.availability}</span>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <AmazonLink
                  ctaId="buch_amazon"
                  className={`${BTN} cd-btn-gold focus-visible:ring-offset-[var(--cd-ivory)]`}
                >
                  {amazonLabel}
                </AmazonLink>
              </div>
              <p className="mt-4 text-sm text-[#6b6455]">
                Nach der Bestellung findest du deine Bestellnummer in der Amazon-Bestellbestätigung
                – trag sie danach hier auf der Seite ein.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* G · Teilnahmeformular                                             */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="teilnehmen"
          aria-labelledby="teilnehmen-heading"
          className="mx-auto max-w-3xl scroll-mt-16 px-4 py-14 sm:px-8 lg:py-20"
        >
          <SectionHeading
            id="teilnehmen-heading"
            kicker="Teilnehmen"
            title="Buch bestellt? Trag dich jetzt ein."
            intro="Registriere deine Bestellnummer für das Cards-Gewinnspiel. Jede weitere gültige Bestellnummer gibt dir ein zusätzliches Los."
          />
          <p
            className="mt-6 rounded-xl border border-[var(--cd-border-soft)] bg-[var(--cd-surface)] px-4 py-3 text-center text-sm text-[var(--cd-ink)]"
            data-testid="form-dates"
          >
            Bis zum {CARDS_ENTRY_DEADLINE_LABEL} teilnehmen. Die Gewinner werden am{" "}
            {CARDS_ANNOUNCEMENT_LABEL} bekannt gegeben.
          </p>
          <p
            className="mt-3 text-center text-xs text-[var(--cd-ink-mute)]"
            data-testid="campaign-note"
          >
            Diese Anmeldung gilt ausschließlich für das Cards-Gewinnspiel.
          </p>
          <div className="mt-6">
            <ParticipationHost
              variant="cards"
              enabled={open}
              dialogTitle="Bestellnummer für das Cards-Gewinnspiel eintragen"
              inlineLabelId="teilnehmen-heading"
              form={
                open ? (
                  <CardsEntry
                    formToken={formToken}
                    utm={utm}
                    privacyUrl={env.PRIVACY_URL ?? null}
                  />
                ) : (
                  <ClosedNotice phase={phase} />
                )
              }
            />
          </div>
          <p className="mt-4 text-center text-xs text-[var(--cd-ink-mute)]">
            Teilnahme ab {MIN_AGE} Jahren mit Wohnsitz in {ELIGIBLE_COUNTRIES_LABEL}. Deine
            Formulardaten werden ausschließlich für das Gewinnspiel verwendet und nie an
            Werbenetzwerke übermittelt.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* H · Teilen                                                        */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="teilen"
          aria-labelledby="teilen-heading"
          className="scroll-mt-16 border-t border-[var(--cd-border-soft)] bg-[var(--cd-bg-deep)]"
        >
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-8 lg:py-20">
            <p className="text-center text-xs font-semibold tracking-[0.24em] text-[var(--cd-cyan)] uppercase">
              Die Verlosung des Jahres für deine TCG-Community
            </p>
            <h2 id="teilen-heading" className="sr-only">
              Teilen
            </h2>
            <CardsShareBox
              className="mt-6"
              shareText={shareText}
              heading="Deine Community sollte das sehen."
              intro="One Piece, Dragon Ball, Yu-Gi-Oh! und Cardmarket: Teile die Verlosung mit deinen Freunden, deiner TCG-Gruppe oder deiner Community."
            />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* I · FAQ                                                           */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="border-t border-[var(--cd-border-soft)]"
        >
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-8 lg:py-20">
            <SectionHeading id="faq-heading" kicker="Fragen & Antworten" title="Häufige Fragen" />
            <div className="mt-8 divide-y divide-[var(--cd-border-soft)] rounded-2xl border border-[var(--cd-border-soft)] bg-[var(--cd-surface)]">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group px-5 py-1">
                  <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-left font-medium text-[var(--cd-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cd-gold)] [&::-webkit-details-marker]:hidden">
                    {q}
                    <span
                      aria-hidden="true"
                      className="text-2xl leading-none text-[var(--cd-gold)] transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-5 text-sm leading-relaxed text-[var(--cd-ink-soft)]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* K · Abschluss                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="abschluss-heading"
          className="relative overflow-hidden border-t border-[var(--cd-border-soft)]"
        >
          <div
            className="cd-glow-gold pointer-events-none absolute top-1/2 left-1/2 h-[120%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60"
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-8 lg:py-20">
            <h2
              id="abschluss-heading"
              lang="de"
              className="cd-display text-3xl font-semibold text-balance hyphens-auto text-[var(--cd-ink)] sm:text-4xl"
            >
              {open
                ? "Buch sichern, Bestellnummer eintragen, mitfiebern."
                : "Das Buch gibt es weiterhin – die Verlosung ist beendet."}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--cd-ink-soft)]">
              {open
                ? `${CARDS_PRIZE_COUNT} Gewinne für deine Sammlung – vom OP-17-Case bis zu ${CARDS_CARDMARKET_COUNT} × ${CARDS_CARDMARKET_VALUE_LABEL} Cardmarket. Gewinnerbekanntgabe am ${CARDS_ANNOUNCEMENT_LABEL}.`
                : `Teilnahme beendet · Gewinnerbekanntgabe: ${CARDS_ANNOUNCEMENT_LABEL}.`}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <AmazonLink ctaId="abschluss_amazon" className={BTN_GOLD}>
                {amazonLabel}
              </AmazonLink>
              {open ? (
                <a
                  href="#teilnehmen"
                  data-gw-event="cards_cta_teilnehmen_footer"
                  data-cta-id="abschluss"
                  className={BTN_OUTLINE}
                >
                  Schon gekauft? Bestellnummer eintragen
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* J · Footer                                                           */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-[var(--cd-border-soft)] bg-[var(--cd-bg-deep)]">
        <div className="mx-auto max-w-[1320px] px-4 py-10 text-sm text-[var(--cd-ink-mute)] sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-md">
              <p className="font-semibold text-[var(--cd-ink)]">
                „{BUCH_TITEL}“ · {BUCH_AUTOR} · TCG-Gewinnspiel
              </p>
              <p className="mt-2">
                Veranstalter des Gewinnspiels: {ORGANIZER_NAME}, {ORGANIZER_ADDRESS}. Kontakt:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-[var(--cd-ink)]">
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p className="mt-2 text-xs">
                ONE PIECE CARD GAME, Dragon Ball Super Card Game Fusion World, Yu-Gi-Oh!, Cardmarket
                und Amazon sind Marken bzw. Angebote der jeweiligen Inhaber; die Nennung bezeichnet
                die verlosten Produkte und Gutscheine und bedeutet keine Sponsoring- oder
                Kooperationspartnerschaft. Produktabbildungen zeigen jeweils eine Box bzw. ein
                Display des Produkts.
              </p>
            </div>
            <nav aria-label="Rechtliches">
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <li>
                  <Link
                    href={CARDS_TERMS_PATH}
                    className="inline-flex min-h-[44px] items-center hover:text-[var(--cd-ink)]"
                  >
                    Teilnahmebedingungen Cards
                  </Link>
                </li>
                {env.PRIVACY_URL ? (
                  <li>
                    <a
                      href={env.PRIVACY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center hover:text-[var(--cd-ink)]"
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
                      className="inline-flex min-h-[44px] items-center hover:text-[var(--cd-ink)]"
                    >
                      Impressum
                    </a>
                  </li>
                ) : null}
              </ul>
            </nav>
          </div>
        </div>
      </footer>

      {open ? (
        <StickyCta
          variant="cards"
          heroId="hero"
          formId="teilnehmen"
          primary={{
            label: "Buch bestellen",
            href: AMAZON.url,
            event: AMAZON_EVENT,
            external: true,
            ctaId: "sticky_amazon",
          }}
          secondary={{
            label: "Bestellnummer eintragen",
            href: "#teilnehmen",
            event: "cards_sticky_teilnehmen",
          }}
        />
      ) : null}
    </div>
  );
}
