import type { Metadata } from "next";
import { BuchLandingPage, parseUtmParams } from "@/components/buch/buch-landing-page";
import { countAvailableVouchers } from "@/lib/gutschein";
import {
  GUTSCHEIN_RABATT_LABEL,
  GUTSCHEIN_SHOP_NAME,
  GUTSCHEIN_URL,
} from "@/lib/gutschein-config";
import { createFormToken } from "@/lib/sweepstakes-crypto";

export const dynamic = "force-dynamic";

/**
 * Zielseite des Newsletters: die Buch-Landingpage plus Gutschein-Aktion
 * (jede registrierte Buchbestellung erhält sofort einen Wiresoft-Shop-Code).
 * Bewusst noindex – die Gutscheine sind für Newsletter-Leser gedacht.
 */

export const metadata: Metadata = {
  title: { absolute: `Die Lizenz zum Erfolg – ${GUTSCHEIN_RABATT_LABEL} Gutschein für Leser` },
  description: `Das Buch von Soheil Hosseini bestellen, Bestellnummer eintragen und sofort einen ${GUTSCHEIN_RABATT_LABEL}-Gutschein für den ${GUTSCHEIN_SHOP_NAME} erhalten.`,
  alternates: { canonical: GUTSCHEIN_URL },
  robots: { index: false, follow: false },
  openGraph: {
    title: `Die Lizenz zum Erfolg – ${GUTSCHEIN_RABATT_LABEL} Gutschein für Leser`,
    description: `Buch bestellen, Bestellnummer eintragen, ${GUTSCHEIN_RABATT_LABEL} Gutschein für den ${GUTSCHEIN_SHOP_NAME} sofort erhalten.`,
    url: GUTSCHEIN_URL,
    siteName: "Die Lizenz zum Erfolg",
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: "https://lizenzzumerfolg.com/das-buch/og.png",
        width: 1200,
        height: 630,
        alt: "Die Lizenz zum Erfolg – das Buch von Soheil Hosseini",
      },
    ],
  },
};

export default async function GutscheinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [utm, vouchersAvailable] = [parseUtmParams(await searchParams), await countAvailableVouchers()];
  return (
    <BuchLandingPage
      variant="gutschein"
      utm={utm}
      formToken={createFormToken()}
      vouchersAvailable={vouchersAvailable}
    />
  );
}
