import type { Metadata, Viewport } from "next";
import Image from "next/image";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Compass,
  HelpCircle,
  Home,
  Plus,
  UserRound,
} from "lucide-react";
import { getEnv } from "@/lib/env";
import { createRedditTrackingConfig } from "@/lib/reddit-context";
import { AMAZON_PRODUCT_URL } from "@/lib/gewinnspiel-config";
import {
  BUCH_AUTOR,
  BUCH_TITEL,
  BUCH_UNTERTITEL,
  BUCH_VERLAG,
  BUCH_ISBN13,
  BUCH_PREIS_LABEL,
  BUCH_ERSCHEINT_ISO,
  BUCH_PREIS_SCHEMA,
} from "@/lib/buch-config";
import {
  BOOK_FAQ,
  displayedActivity,
  REDDIT_BOOK_PATH,
  REDDIT_BOOK_URL,
} from "@/lib/reddit-book-config";
import {
  MobileBookCta,
  PostActions,
  ReadingProgress,
  SavedReadingNote,
} from "@/components/reddit-book/interactions";
import { RedditTracking } from "@/components/reddit-tracking";
import styles from "@/components/reddit-book/reddit-book.module.css";

export const dynamic = "force-dynamic";
const description =
  "Ein Unternehmer gegen Microsoft. Und eine Lebensgeschichte, die viel früher beginnt. Entdecke Die Lizenz zum Erfolg von Soheil Hosseini.";
export const metadata: Metadata = {
  title: {
    absolute: "Ein Unternehmer gegen Microsoft. Die Geschichte dahinter. | Die Lizenz zum Erfolg",
  },
  description,
  alternates: { canonical: REDDIT_BOOK_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Ein Unternehmer gegen Microsoft. Die Geschichte dahinter.",
    description,
    url: REDDIT_BOOK_URL,
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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1113" },
  ],
  colorScheme: "light dark",
};

function AmazonButton({
  id,
  placement,
  children,
}: {
  id?: string;
  placement: string;
  children: React.ReactNode;
}) {
  return (
    <a
      id={id}
      className={styles.primaryButton}
      href={AMAZON_PRODUCT_URL}
      target="_blank"
      rel="noopener noreferrer sponsored"
      data-reddit-event="amazon"
      data-cta-id={placement}
    >
      {children}
      <ArrowUpRight size={18} aria-hidden="true" />
    </a>
  );
}

export default function RedditBookPage() {
  const env = getEnv();
  const preorder = Date.now() < Date.parse(BUCH_ERSCHEINT_ISO);
  const cta = "Bei Amazon bestellen";
  const tracking = createRedditTrackingConfig(REDDIT_BOOK_PATH, "not-required");
  const privacyUrl = env.PRIVACY_URL ?? "https://soheil-hosseini.de/datenschutz";
  const imprintUrl = env.IMPRINT_URL ?? "https://soheil-hosseini.de/impressum";
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
      url: AMAZON_PRODUCT_URL,
      price: BUCH_PREIS_SCHEMA,
      priceCurrency: "EUR",
      availability: preorder ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
    },
  };
  return (
    <div className={styles.shell} data-testid="reddit-book">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <a href="#beitrag" className={styles.skipLink}>
        Zum Beitrag springen
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a
            href="#beitrag"
            className={styles.brand}
            aria-label="Die Lizenz zum Erfolg – zum Beitrag"
          >
            <span className={styles.brandIcon}>
              <BookOpen size={24} strokeWidth={2.3} aria-hidden="true" />
            </span>
            <span>
              die lizenz
              <br />
              <strong>zum erfolg.</strong>
            </span>
          </a>
          <div className={styles.headerTopic}>
            <BookOpen size={18} aria-hidden="true" />
            <span>Eine ungewöhnliche Lebensgeschichte</span>
          </div>
          <div className={styles.headerLinks}>
            <a href="#buch" className={styles.headerBook}>
              Das Buch entdecken
            </a>
            <a href="#autor" aria-label="Über Soheil Hosseini">
              <Image
                className={styles.avatar}
                src="/gewinn/autor.jpg"
                alt=""
                width={38}
                height={38}
                sizes="38px"
              />
            </a>
          </div>
        </div>
        <ReadingProgress />
      </header>
      <div className={styles.layout}>
        <aside className={styles.leftSidebar}>
          <nav aria-label="Auf dieser Seite">
            <span className={styles.navLabel}>DIE GESCHICHTE DAHINTER</span>
            <a href="#beitrag" className={styles.navSelected}>
              <Home size={20} aria-hidden="true" /> Der Beitrag
            </a>
            <a href="#geschichte">
              <Compass size={20} aria-hidden="true" /> Die Geschichte
            </a>
            <a href="#buch">
              <BookOpen size={20} aria-hidden="true" /> Das Buch
            </a>
            <a href="#autor">
              <UserRound size={20} aria-hidden="true" /> Der Autor
            </a>
            <a href="#fragen">
              <HelpCircle size={20} aria-hidden="true" /> Fragen & Antworten
            </a>
          </nav>
          <div className={styles.sidebarNote}>
            <span>
              ANDERE WEGE.
              <br />
              EIGENE ENTSCHEIDUNGEN.
            </span>
            <p>Eine Biografie über Herkunft, Unternehmertum und Selbstbestimmung.</p>
          </div>
        </aside>
        <main id="beitrag" className={styles.main}>
          <div className={styles.breadcrumb}>
            <BookOpen size={15} aria-hidden="true" /> Bücher{" "}
            <ChevronRight size={13} aria-hidden="true" /> Biografien
          </div>
          <article className={styles.post}>
            <div className={styles.postMeta}>
              <Image
                className={styles.avatar}
                src="/gewinn/autor.jpg"
                alt=""
                width={38}
                height={38}
                sizes="38px"
              />
              <div>
                <a href="#autor">
                  Soheil Hosseini <span className={styles.authorBadge}>Autor</span>
                </a>
                <span>Die Lizenz zum Erfolg · 5 Min. Lesezeit</span>
              </div>
              <span className={styles.adLabel}>Werbung</span>
            </div>
            <h1>
              Er legt sich mit Microsoft an.
              <br />
              <span>Aber seine Geschichte beginnt viel früher.</span>
            </h1>
            <div className={styles.intro}>
              <p>
                Auf der einen Seite: ein Weltkonzern. Auf der anderen: ein Unternehmer, der seinen
                eigenen Weg geht. Die Auseinandersetzung dauert Jahre.
              </p>
              <p>
                Das klingt nach David gegen Goliath. Interessant wird es bei der Frage:{" "}
                <strong>Wer ist der Mensch, der sich darauf einlässt?</strong>
              </p>
            </div>
            <div className={styles.tldr}>
              <span>TL;DR</span>
              <p>
                Mit sechs Jahren aus dem Iran nach Deutschland. Später eigene Unternehmen. Dann der
                Konflikt mit Microsoft. <strong>Die Lizenz zum Erfolg</strong> erzählt den Lebensweg
                hinter der Schlagzeile.
              </p>
            </div>
            <div className={styles.heroBook}>
              <Image
                className={styles.smallCover}
                src="/gewinn/buchcover.jpg"
                alt="Buchcover: Die Lizenz zum Erfolg von Soheil Hosseini"
                width={96}
                height={153}
                sizes="96px"
                priority
              />
              <div>
                <span className={styles.eyebrow}>DIE UNTERNEHMERBIOGRAFIE</span>
                <h2>{BUCH_TITEL}</h2>
                <p>
                  {BUCH_PREIS_LABEL} · Taschenbuch ·{" "}
                  {preorder ? "Ab 6. Oktober 2026" : "Erschienen am 6. Oktober 2026"}
                </p>
                <AmazonButton id="first-book-cta" placement="hero">
                  {cta}
                </AmazonButton>
              </div>
            </div>
            <PostActions initial={{ ...displayedActivity(Date.now()), vote: 0 }} />
            <div className={styles.story} id="geschichte">
              <section>
                <span className={styles.sectionKicker}>01 / DIE SCHLAGZEILE</span>
                <h2>
                  Ein ungleicher Gegner.
                  <br />
                  Und eine ziemlich menschliche Frage.
                </h2>
                <p>
                  Microsoft kennt jeder. Soheil Hosseini wahrscheinlich noch nicht. Schon darin
                  steckt das Spannungsverhältnis dieser Geschichte: Ein Name ist allgegenwärtig. Den
                  anderen musst du erst kennenlernen.
                </p>
                <p>
                  Ein jahrelanger Konflikt mit einem Weltkonzern weckt Neugier. Aber die Größe des
                  Gegners allein macht noch keinen Menschen interessant. Dafür braucht es den Blick
                  auf das, was davor liegt. Auf Herkunft, Entscheidungen und das Leben neben der
                  Auseinandersetzung.
                </p>
                <p>
                  <strong>Genau dort beginnt diese Biografie.</strong>
                </p>
              </section>
              <section>
                <span className={styles.sectionKicker}>02 / VOR DEM UNTERNEHMER</span>
                <h2>
                  Bevor es Unternehmen gab,
                  <br />
                  gab es einen Neuanfang.
                </h2>
                <p>
                  Soheil kommt mit sechs Jahren aus dem Iran nach Deutschland. Seine Mutter zieht
                  ihn unter schwierigen Bedingungen allein groß. Lange bevor von Unternehmen und
                  einem Konflikt mit Microsoft die Rede ist, steht ein Kind vor einem ganz anderen
                  Anfang.
                </p>
                <p>
                  Wer heute auf einen Unternehmer schaut, sieht leicht zuerst das Ergebnis. Eine
                  Biografie dreht die Perspektive um: Sie setzt früher an. Bei den Umständen, die
                  sich ein Mensch nicht aussucht. Und bei dem Weg, der daraus entsteht.
                </p>
                <p>
                  Aus dem Kind wird ein Unternehmer, der Firmen in Software, Finanzen und Mode
                  aufbaut. Der Abstand zwischen diesen beiden Lebensphasen ist der Raum, den eine
                  Schlagzeile nicht erzählen kann. Ein Buch schon.
                </p>
              </section>
              <section>
                <span className={styles.sectionKicker}>03 / MEHR ALS EIN KONFLIKT</span>
                <h2>Drei Gründe, weiterzulesen.</h2>
                <p>
                  Der Streit mit Microsoft ist ein Einstieg. Die größere Geschichte berührt Fragen,
                  für die du weder Unternehmer sein noch dich mit Softwarelizenzen auskennen musst.
                </p>
                <div className={styles.themes}>
                  <div>
                    <span>01</span>
                    <div>
                      <h3>Herkunft. Was bringt ein Mensch mit?</h3>
                      <p>
                        Eine Kindheit zwischen zwei Ländern. Ein Neuanfang in Deutschland. Die
                        Frage, wie viel eines Lebenswegs schon beginnt, bevor jemand seine erste
                        eigene Entscheidung trifft.
                      </p>
                    </div>
                  </div>
                  <div>
                    <span>02</span>
                    <div>
                      <h3>Aufbau. Wie entsteht etwas Eigenes?</h3>
                      <p>
                        Vom persönlichen Anfang zu Unternehmen in unterschiedlichen Branchen.
                        Interessant ist der Weg dazwischen – gerade für Leser, die hinter
                        Berufsbezeichnungen und fertige Lebensläufe schauen wollen.
                      </p>
                    </div>
                  </div>
                  <div>
                    <span>03</span>
                    <div>
                      <h3>Selbstbestimmung. Was heißt ein eigener Weg?</h3>
                      <p>
                        Wo kommen die eigenen Maßstäbe her? Wofür lohnt sich Widerstand? Eine fremde
                        Lebensgeschichte gibt diesen Fragen ein Gesicht und lässt Raum für die
                        eigene Haltung.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
              <section className={styles.readerSection}>
                <BookOpen size={25} aria-hidden="true" />
                <h2>
                  Du musst ihn nicht schon feiern.
                  <br />
                  Du kannst ihn erst einmal lesen.
                </h2>
                <p>
                  Gute Biografien leben davon, dass man sich auf einen Menschen einlässt. Man kann
                  seine Entscheidungen spannend finden, sie hinterfragen und an ganz anderen Stellen
                  hängen bleiben als erwartet.
                </p>
                <p>
                  Wenn du Bücher magst, die aus einem unbekannten Namen einen Menschen machen, ist
                  das hier eine Einladung: Geh über die Schlagzeile hinaus. Bild dir dein eigenes
                  Urteil.
                </p>
                <a href="#buch" className={styles.inlineLink}>
                  Das Buch kennenlernen <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </section>
            </div>
            <section id="autor" className={styles.authorSection}>
              <Image
                src="/gewinn/autor.jpg"
                alt="Soheil Hosseini, Autor von Die Lizenz zum Erfolg"
                width={148}
                height={196}
                sizes="(max-width: 600px) 108px, 148px"
                className={styles.authorPortrait}
              />
              <div>
                <span className={styles.sectionKicker}>DER MENSCH HINTER DEM BUCH</span>
                <h2>{BUCH_AUTOR}</h2>
                <p>
                  Unternehmer und Autor. Als Kind aus dem Iran nach Deutschland gekommen, später
                  Gründer von Unternehmen in mehreren Branchen. In <em>{BUCH_TITEL}</em> steht sein
                  persönlicher Lebensweg im Mittelpunkt.
                </p>
              </div>
            </section>
            <section id="buch" className={styles.bookDetails}>
              <span className={styles.sectionKicker}>FÜR DEINEN LESESTAPEL</span>
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
                  <dd>Taschenbuch · Deutsch</dd>
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
              <AmazonButton placement="book-details">{cta}</AmazonButton>
              <SavedReadingNote />
            </section>
            <section id="fragen" className={styles.faq}>
              <span className={styles.sectionKicker}>NOCH ETWAS OFFEN?</span>
              <h2>Fragen zum Buch</h2>
              {BOOK_FAQ.map((item, i) => (
                <details key={item.question}>
                  <summary>
                    {item.question}
                    <Plus size={19} aria-hidden="true" />
                  </summary>
                  <p>
                    {i === 3
                      ? `Die Buttons führen dich zum Buch auf Amazon. Dort siehst du die aktuelle Verfügbarkeit, den gültigen Preis und die Lieferbedingungen. ${preorder ? "Das Taschenbuch erscheint am 6. Oktober 2026 und kann bestellt werden." : "Das Erscheinungsdatum des Taschenbuchs ist der 6. Oktober 2026."}`
                      : item.answer}
                  </p>
                </details>
              ))}
            </section>
            <section className={styles.finalCta}>
              <span className={styles.sectionKicker}>DIE SCHLAGZEILE WAR DER ANFANG.</span>
              <h2>
                Die ganze Geschichte
                <br />
                steht im Buch.
              </h2>
              <p>
                Herkunft. Eigene Unternehmen. Ein Weltkonzern als Gegner.
                <br className={styles.desktopBreak} /> Und ein Mensch, den du erst noch kennenlernen
                kannst.
              </p>
              <p className={styles.communityNote}>
                Mit deiner Bestellung unterstützt du einen Autor aus unserer Reddit-Community.
              </p>
              <AmazonButton placement="final">{cta}</AmazonButton>
              <span className={styles.smallNote}>
                {BUCH_PREIS_LABEL} · Taschenbuch{preorder ? " · Erscheint am 6. Oktober" : ""}
              </span>
            </section>
          </article>
          <footer id="book-footer" className={styles.footer}>
            <div>
              <BookOpen size={18} aria-hidden="true" />
              <strong>{BUCH_TITEL}</strong>
            </div>
            <p>Die Buchseite von Soheil Hosseini.</p>
            <nav aria-label="Rechtliche Informationen">
              <a href={imprintUrl} target="_blank" rel="noopener noreferrer">
                Impressum
              </a>
              <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
                Datenschutz
              </a>
            </nav>
            <span>© {new Date().getFullYear()} Soheil Hosseini</span>
          </footer>
        </main>
        <aside className={styles.rightSidebar} aria-label="Das Buch auf einen Blick">
          <div className={styles.bookCard}>
            <div className={styles.bookCardCover}>
              <span className={styles.coverTag}>EINE LEBENSGESCHICHTE.</span>
              <Image
                src="/gewinn/buchcover.jpg"
                alt="Cover des Taschenbuchs Die Lizenz zum Erfolg"
                width={176}
                height={280}
                sizes="176px"
                priority
              />
            </div>
            <div className={styles.bookCardContent}>
              <span className={styles.eyebrow}>VON SOHEIL HOSSEINI</span>
              <h2>{BUCH_TITEL}</h2>
              <p>{BUCH_UNTERTITEL}</p>
              <div className={styles.cardPrice}>
                <strong>{BUCH_PREIS_LABEL}</strong>
                <span>Taschenbuch · Deutsch</span>
              </div>
              <AmazonButton placement="sidebar">{cta}</AmazonButton>
              <span className={styles.cardDate}>
                {preorder ? "Erscheint am" : "Erschienen am"} 6. Oktober 2026
              </span>
            </div>
          </div>
          <p className={styles.sidebarFootnote}>
            Für alle, die Biografien lesen,
            <br />
            um Menschen zu verstehen.
          </p>
        </aside>
      </div>
      <MobileBookCta label={cta} />
      {tracking && <RedditTracking config={tracking} />}
    </div>
  );
}
