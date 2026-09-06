import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  HeartHandshake,
  HelpCircle,
  Inbox,
  Mail,
  Menu,
  Plus,
  UserRound,
} from "lucide-react";
import { GewinnTracking } from "@/components/gewinn/gewinn-tracking";
import { InboxStickyCta, InboxTools } from "@/components/inbox-book/interactions";
import styles from "@/components/inbox-book/inbox-book.module.css";
import { createBookConversionConfig } from "@/lib/book-conversion-context";
import { createRedditTrackingConfig } from "@/lib/reddit-context";
import { getEnv } from "@/lib/env";
import { AMAZON_PRODUCT_URL } from "@/lib/gewinnspiel-config";
import {
  BUCH_AUTOR,
  BUCH_ERSCHEINT_ISO,
  BUCH_FORMAT_LABEL,
  BUCH_ISBN13,
  BUCH_PREIS_LABEL,
  BUCH_PREIS_SCHEMA,
  BUCH_TITEL,
  BUCH_UNTERTITEL,
  BUCH_VERLAG,
  SPENDEN_HINWEIS,
} from "@/lib/buch-config";
import {
  INBOX_BOOK_PATH,
  INBOX_BOOK_URL,
  INBOX_FAQ,
  INBOX_REASONS,
  resolveInboxPortal,
} from "@/lib/inbox-book-config";

export const dynamic = "force-dynamic";
const description =
  "Mit 20 stand Soheil Hosseini Microsoft gegenüber. Eine persönliche Einladung zu seiner Biografie Die Lizenz zum Erfolg – über Entscheidungen und den eigenen Weg.";
export const metadata: Metadata = {
  title: { absolute: "Mit 20 stand ich Microsoft gegenüber. | Die Lizenz zum Erfolg" },
  description,
  alternates: { canonical: INBOX_BOOK_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Mit 20 stand ich Microsoft gegenüber.",
    description,
    url: INBOX_BOOK_URL,
    siteName: BUCH_TITEL,
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: "https://lizenzzumerfolg.com/das-buch/og.png",
        width: 1200,
        height: 630,
        alt: `${BUCH_TITEL} von ${BUCH_AUTOR}`,
      },
    ],
  },
  twitter: { card: "summary_large_image", images: ["https://lizenzzumerfolg.com/das-buch/og.png"] },
};
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f3f7" },
    { media: "(prefers-color-scheme: dark)", color: "#111821" },
  ],
  colorScheme: "light dark",
};

function OrderButton({ placement, id }: { placement: string; id?: string }) {
  return (
    <a
      id={id}
      className={styles.primaryButton}
      href={AMAZON_PRODUCT_URL}
      target="_blank"
      rel="noopener noreferrer sponsored"
      data-gw-event="buch_amazon_klick"
      data-cta-id={placement}
    >
      Bei Amazon bestellen
      <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  );
}

function Contents({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav aria-label={mobile ? "Inhalt auf Mobilgeräten" : "In dieser Nachricht"}>
      <a href="#nachricht">
        <Inbox size={18} aria-hidden="true" />
        Die Nachricht<span className={styles.count}>1</span>
      </a>
      <a href="#geschichte">
        <Mail size={18} aria-hidden="true" />
        Meine Geschichte
      </a>
      <a href="#lesegruende">
        <BookOpen size={18} aria-hidden="true" />
        Dein Lesestapel
      </a>
      <a href="#autor">
        <UserRound size={18} aria-hidden="true" />
        Über den Autor
      </a>
      <a href="#fragen">
        <HelpCircle size={18} aria-hidden="true" />
        Fragen zum Buch
      </a>
    </nav>
  );
}

export default async function InboxBookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, requestHeaders] = await Promise.all([searchParams, headers()]);
  const portal = resolveInboxPortal(query, requestHeaders.get("referer"));
  const env = getEnv();
  const bookConversion = await createBookConversionConfig(INBOX_BOOK_PATH, "not-required");
  const forthcoming = Date.now() < Date.parse(BUCH_ERSCHEINT_ISO);
  const publication = forthcoming
    ? "Erscheint am 6. Oktober 2026"
    : "Erschienen am 6. Oktober 2026";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: BUCH_TITEL,
    alternativeHeadline: BUCH_UNTERTITEL,
    author: { "@type": "Person", name: BUCH_AUTOR },
    publisher: { "@type": "Organization", name: BUCH_VERLAG },
    isbn: BUCH_ISBN13,
    datePublished: BUCH_ERSCHEINT_ISO,
    inLanguage: "de",
    bookFormat: "https://schema.org/Paperback",
    image: "https://lizenzzumerfolg.com/gewinn/buchcover.jpg",
    offers: {
      "@type": "Offer",
      price: BUCH_PREIS_SCHEMA,
      priceCurrency: "EUR",
      url: AMAZON_PRODUCT_URL,
      availability: forthcoming ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
    },
  };
  return (
    <div className={styles.shell} data-portal={portal} data-testid="inbox-book">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <a href="#nachricht" className={styles.skipLink}>
        Zur Nachricht springen
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a
            className={styles.brand}
            href="#nachricht"
            aria-label="Lesepost – Die Lizenz zum Erfolg"
          >
            <span className={styles.brandIcon}>
              <Mail size={25} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span>
              <strong>Lesepost</strong>
              <small>Die Lizenz zum Erfolg</small>
            </span>
          </a>
          <div className={styles.headerNote}>Eine Nachricht. Eine Lebensgeschichte.</div>
          <a className={styles.headerBook} href="#buch">
            <BookOpen size={17} aria-hidden="true" />
            <span>Zum Buch</span>
          </a>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.folders}>
          <a className={styles.folderBuy} href="#buch">
            <BookOpen size={18} aria-hidden="true" />
            Buch entdecken
          </a>
          <p className={styles.folderLabel}>DEINE LESEPOST</p>
          <div className={styles.inboxFolder}>
            <Inbox size={19} aria-hidden="true" />
            Posteingang<span>1</span>
          </div>
          <p className={styles.contentsLabel}>IN DIESER NACHRICHT</p>
          <Contents />
          <div className={styles.sideDonation}>
            <HeartHandshake size={23} aria-hidden="true" />
            <p>
              Eine Bestellung.
              <br />
              <strong>Eine gute Sache.</strong>
            </p>
            <span>{SPENDEN_HINWEIS}</span>
          </div>
        </aside>

        <main className={styles.mailPanel} id="nachricht">
          <div className={styles.toolbar}>
            <div className={styles.breadcrumb}>
              <Inbox size={17} aria-hidden="true" />
              <span>Posteingang</span>
              <ChevronRight size={14} aria-hidden="true" />
              <span className={styles.breadcrumbDetail}>Buchvorstellung</span>
            </div>
            <div className={styles.toolbarRight}>
              <InboxTools portal={portal} />
              <details className={styles.mobileMenu}>
                <summary aria-label="Inhalt öffnen">
                  <Menu size={20} aria-hidden="true" />
                </summary>
                <Contents mobile />
              </details>
            </div>
          </div>

          <div className={styles.mailHeader}>
            <a
              href="#autor"
              className={styles.senderPortrait}
              aria-label="Mehr über Soheil Hosseini"
            >
              <Image src="/gewinn/autor.jpg" alt="" width={44} height={44} sizes="44px" priority />
            </a>
            <div className={styles.sender}>
              <a href="#autor">{BUCH_AUTOR}</a>
              <span>Autor von „Die Lizenz zum Erfolg“</span>
            </div>
            <span className={styles.adLabel}>
              Buchvorstellung<span>Anzeige</span>
            </span>
          </div>

          <div className={styles.readingLayout}>
            <article className={styles.letter}>
              <span className={styles.subjectLabel}>BETREFF</span>
              <h1>
                Mit 20 stand ich
                <br />
                <span>Microsoft gegenüber.</span>
              </h1>
              <p className={styles.greeting}>Hallo, ich bin Soheil.</p>
              <p className={styles.lead}>
                Ich bin gerade einmal 20, als meine erste Auseinandersetzung mit Microsoft beginnt.
                Ein Konflikt, der mich über Jahre begleitet.
              </p>

              <div className={styles.earlyBook}>
                <Image
                  src="/gewinn/buchcover.jpg"
                  alt="Buchcover: Die Lizenz zum Erfolg"
                  width={60}
                  height={96}
                  sizes="60px"
                  priority
                />
                <div>
                  <span className={styles.eyebrow}>DAS BUCH ZUR GESCHICHTE</span>
                  <h2>{BUCH_TITEL}</h2>
                  <p>
                    {BUCH_PREIS_LABEL} · {BUCH_FORMAT_LABEL}
                  </p>
                  <OrderButton id="inbox-first-cta" placement="inbox-hero" />
                </div>
              </div>
              <p className={styles.donation}>
                <HeartHandshake size={21} aria-hidden="true" />
                <span>{SPENDEN_HINWEIS}</span>
              </p>

              <section className={styles.storySection} id="geschichte">
                <span className={styles.sectionLabel}>EIN PERSÖNLICHER EINBLICK</span>
                <h2>
                  Hinter diesem Konflikt
                  <br />
                  steht ein ganzer Lebensweg.
                </h2>
                <p>
                  Vielleicht hat dich die Geschichte mit Microsoft neugierig gemacht. In meinem Buch
                  nehme ich dich auch mit zu den Entscheidungen davor und danach: zu meinem Weg als
                  Unternehmer in Software, Finanzen und Mode – und zu der Frage, was
                  Selbstbestimmung für mich bedeutet.
                </p>
                <p>
                  <em>Die Lizenz zum Erfolg</em> ist meine Biografie. Eine Einladung, einen Menschen
                  und seine Entscheidungen näher kennenzulernen. Und dabei eigene Gedanken
                  mitzunehmen.
                </p>
                <a className={styles.readOn} href="#lesegruende">
                  Was du für dich mitnehmen kannst
                  <ArrowDown size={16} aria-hidden="true" />
                </a>
              </section>

              <section className={styles.reasons} id="lesegruende">
                <span className={styles.sectionLabel}>FÜR DEINEN NÄCHSTEN LESEABEND</span>
                <h2>
                  Drei Gründe, warum dich
                  <br />
                  dieses Buch begleiten könnte.
                </h2>
                <p className={styles.sectionIntro}>
                  Du musst kein Unternehmer sein, um dich in diesen Fragen wiederzufinden.
                </p>
                {INBOX_REASONS.map((reason, index) => (
                  <div className={styles.reason} key={reason.title}>
                    <span className={styles.reasonNumber}>0{index + 1}</span>
                    <div>
                      <h3>{reason.title}</h3>
                      <p>{reason.text}</p>
                    </div>
                  </div>
                ))}
              </section>

              <section className={styles.bookDetails} id="buch">
                <div className={styles.bookHeading}>
                  <BookOpen size={23} aria-hidden="true" />
                  <span className={styles.sectionLabel}>DEIN NÄCHSTES BUCH</span>
                </div>
                <h2>{BUCH_TITEL}</h2>
                <p className={styles.subtitle}>{BUCH_UNTERTITEL}</p>
                <dl>
                  <div>
                    <dt>Autor</dt>
                    <dd>{BUCH_AUTOR}</dd>
                  </div>
                  <div>
                    <dt>Verlag</dt>
                    <dd>{BUCH_VERLAG}</dd>
                  </div>
                  <div>
                    <dt>Ausgabe</dt>
                    <dd>{BUCH_FORMAT_LABEL} · Deutsch</dd>
                  </div>
                  <div>
                    <dt>Erscheinung</dt>
                    <dd>6. Oktober 2026</dd>
                  </div>
                  <div>
                    <dt>ISBN</dt>
                    <dd>{BUCH_ISBN13}</dd>
                  </div>
                  <div>
                    <dt>Preis</dt>
                    <dd>{BUCH_PREIS_LABEL}</dd>
                  </div>
                </dl>
                <OrderButton placement="inbox-book-details" />
                <span className={styles.smallNote}>Bestellung und Lieferung über Amazon</span>
              </section>

              <section className={styles.author} id="autor">
                <Image
                  src="/gewinn/autor.jpg"
                  alt="Soheil Hosseini, Autor von Die Lizenz zum Erfolg"
                  width={112}
                  height={150}
                  sizes="(max-width: 600px) 86px, 112px"
                />
                <div>
                  <span className={styles.sectionLabel}>DER ABSENDER DIESER GESCHICHTE</span>
                  <h2>{BUCH_AUTOR}</h2>
                  <p>
                    Mit sechs Jahren aus dem Iran nach Deutschland gekommen, von seiner Mutter
                    allein großgezogen. Später Gründer von Unternehmen in mehreren Branchen. In
                    diesem Buch erzählt Soheil seinen persönlichen Weg.
                  </p>
                </div>
              </section>

              <div className={styles.invitation}>
                <p>
                  Wenn du Biografien gern liest, weil dich Menschen und ihre Entscheidungen
                  interessieren, freue ich mich, wenn du meine Geschichte kennenlernst.
                </p>
                <p className={styles.signature}>
                  Herzlich,
                  <br />
                  <strong>Soheil</strong>
                </p>
                <span className={styles.signatureName}>Soheil Hosseini · Autor</span>
              </div>

              <section className={styles.faq} id="fragen">
                <span className={styles.sectionLabel}>BEVOR DU BESTELLST</span>
                <h2>Noch eine Frage?</h2>
                {INBOX_FAQ.map((item) => (
                  <details key={item.question}>
                    <summary>
                      {item.question}
                      <Plus size={18} aria-hidden="true" />
                    </summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </section>

              <section className={styles.finalCta}>
                <Mail size={25} aria-hidden="true" />
                <h2>
                  Die Nachricht endet hier.
                  <br />
                  Die Geschichte geht weiter.
                </h2>
                <p>
                  In „Die Lizenz zum Erfolg“. Für deinen Lesestapel – und deine eigenen Gedanken.
                </p>
                <OrderButton placement="inbox-final" />
                <span className={styles.smallNote}>
                  {BUCH_PREIS_LABEL} · {BUCH_FORMAT_LABEL} · {publication}
                </span>
                <p className={styles.finalDonation}>{SPENDEN_HINWEIS}</p>
              </section>
            </article>

            <aside className={styles.bookAside} aria-label="Das Buch auf einen Blick">
              <div className={styles.coverStage}>
                <span>MEINE GESCHICHTE. DEIN LESESTAPEL.</span>
                <Image
                  src="/gewinn/buchcover.jpg"
                  alt="Die Lizenz zum Erfolg von Soheil Hosseini"
                  width={158}
                  height={252}
                  sizes="158px"
                  priority
                />
              </div>
              <div className={styles.asideDetails}>
                <span className={styles.eyebrow}>VON {BUCH_AUTOR.toUpperCase()}</span>
                <h2>{BUCH_TITEL}</h2>
                <p>{BUCH_UNTERTITEL}</p>
                <div className={styles.price}>
                  {BUCH_PREIS_LABEL}
                  <span>{BUCH_FORMAT_LABEL} · Deutsch</span>
                </div>
                <OrderButton placement="inbox-sidebar" />
                <span className={styles.smallNote}>{publication}</span>
              </div>
              <a className={styles.asideMore} href="#buch">
                Alle Angaben zum Buch
                <ChevronRight size={15} aria-hidden="true" />
              </a>
            </aside>
          </div>

          <footer className={styles.footer} id="inbox-footer">
            <div>
              <BookOpen size={16} aria-hidden="true" />
              <strong>{BUCH_TITEL}</strong>
              <span>Eine Buchvorstellung von {BUCH_AUTOR}</span>
            </div>
            <nav aria-label="Rechtliche Informationen">
              <a href={env.IMPRINT_URL ?? "https://soheil-hosseini.de/impressum"}>Impressum</a>
              <a href={env.PRIVACY_URL ?? "https://soheil-hosseini.de/datenschutz"}>Datenschutz</a>
            </nav>
          </footer>
        </main>
      </div>
      <InboxStickyCta />
      <GewinnTracking
        gtmContainerId={env.GTM_CONTAINER_ID ?? null}
        ga4MeasurementId={env.GA4_MEASUREMENT_ID ?? null}
        metaPixelId={env.META_PIXEL_ID ?? null}
        tiktokPixelId={env.TIKTOK_PIXEL_ID ?? null}
        redditPixelId={env.REDDIT_PIXEL_ID ?? null}
        redditTracking={createRedditTrackingConfig(INBOX_BOOK_PATH, "not-required")}
        bookConversion={bookConversion}
        linkedInPartnerId={env.LINKEDIN_PARTNER_ID ?? null}
        consentMode="not-required"
        consentCookieName={env.CONSENT_COOKIE_NAME ?? null}
        consentAcceptedValue={env.CONSENT_COOKIE_ACCEPTED_VALUE ?? null}
        pageEventName="inbox_buch_seite"
      />
    </div>
  );
}
