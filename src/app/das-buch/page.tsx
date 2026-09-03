import type { Metadata } from "next";
import { BuchLandingPage, parseUtmParams } from "@/components/buch/buch-landing-page";
import {
  AMAZON_PRODUCT_URL,
} from "@/lib/gewinnspiel-config";
import {
  BUCH_AUTOR,
  BUCH_ERSCHEINT_ISO,
  BUCH_ISBN13,
  BUCH_PREIS_SCHEMA,
  BUCH_TITEL,
  BUCH_UNTERTITEL,
  BUCH_URL,
  BUCH_VERLAG,
} from "@/lib/buch-config";

export const dynamic = "force-dynamic";

/**
 * Landingpage für Display-Ads (web.de / gmx.de): Buch + Autor + Musikvideo
 * + Song, Gewinnspiel als sekundärer Hinweis. Rendering: BuchLandingPage.
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

export default async function DasBuchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const utm = parseUtmParams(await searchParams);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BOOK_JSON_LD) }}
      />
      <BuchLandingPage variant="ads" utm={utm} />
    </>
  );
}
