import {
  CARDS_ANNOUNCEMENT_LABEL,
  CARDS_CAMPAIGN_ID,
  CARDS_ENTRY_DEADLINE_LABEL,
  CARDS_ENTRY_PATH,
  CARDS_PRIZE_SCOPE,
  CARDS_PRIZES,
  CARDS_TERMS_PATH,
  CARDS_TERMS_VERSION,
  cardsPrizeFullLabel,
  getCardsPhase,
} from "@/lib/cards-giveaway-config";
import {
  ANNOUNCEMENT_DATETIME_LABEL,
  DUBAI_ENTRY_PATHS,
  ENTRY_DEADLINE_LABEL,
  type EntryPath,
  formatEur,
  getSweepstakesPhase,
  PRIZE_SCOPE,
  type SweepstakesPhase,
  TERMS_VERSION,
  VOUCHER_BRANDS,
} from "@/lib/gewinnspiel-config";

/**
 * Kampagnenregister der Buch-Gewinnspiele. Die Kampagne ist Bestandteil jeder
 * Teilnahme (SweepstakesEntry.campaignId) und bestimmt Lostopf, Fristen,
 * Bedingungsversion, Gewinnumfang und Gewinnkatalog. Zwei Kampagnen sind
 * bewusst getrennt: Dubai (/gewinn, /verlosung) und Cards (/cards).
 *
 * Kein Fallback: Wer eine Teilnahme speichert, muss die Kampagne ausdrücklich
 * angeben (siehe submitSweepstakesEntry). Der DB-Default "dubai_2026" existiert
 * nur für den Rollout alter Instanzen, die ausschließlich Dubai-Wege bedienen.
 */

export const CAMPAIGN_IDS = ["dubai_2026", "cards_2026"] as const;
export type CampaignId = (typeof CAMPAIGN_IDS)[number];
export const DUBAI_CAMPAIGN_ID = "dubai_2026" as const satisfies CampaignId;

export function isCampaignId(value: unknown): value is CampaignId {
  return typeof value === "string" && (CAMPAIGN_IDS as readonly string[]).includes(value);
}

export interface CampaignPrize {
  id: string;
  label: string;
}

export interface SweepstakesCampaign {
  id: CampaignId;
  /** Kurzkennung für Dateinamen und Exporte */
  slug: "dubai" | "cards";
  label: string;
  shortLabel: string;
  /** Teilnahmewege, die in diese Kampagne speichern dürfen */
  entryPaths: readonly EntryPath[];
  termsVersion: string;
  termsPath: string;
  prizeScope: string;
  deadlineLabel: string;
  announcementLabel: string;
  getPhase: (now: Date) => SweepstakesPhase;
  /** Duplikatmeldung ohne Fremddaten (kampagnenbezogen) */
  duplicateMessage: string;
  /** Gewinnkatalog für die Gewinnerzuordnung im Admin (nur Preise DIESER Kampagne) */
  prizes: readonly CampaignPrize[];
}

const DUBAI_PRIZES: readonly CampaignPrize[] = [
  { id: "dubai_reise", label: "Hauptgewinn: Dubai-Reise für zwei" },
  ...VOUCHER_BRANDS.flatMap((brand) =>
    brand.tiers.map((tier) => ({
      id: `voucher_${brand.id}_${tier.valueEur}`,
      label: `Wertgutschein ${brand.name} ${formatEur(tier.valueEur)}`,
    })),
  ),
];

const CARDS_CAMPAIGN_PRIZES: readonly CampaignPrize[] = CARDS_PRIZES.map((p) => ({
  id: p.id,
  label: cardsPrizeFullLabel(p),
}));

export const SWEEPSTAKES_CAMPAIGNS: Record<CampaignId, SweepstakesCampaign> = {
  dubai_2026: {
    id: "dubai_2026",
    slug: "dubai",
    label: "Dubai-Reise & 300 Gutscheine",
    shortLabel: "Dubai",
    entryPaths: DUBAI_ENTRY_PATHS,
    termsVersion: TERMS_VERSION,
    termsPath: "/gewinn/teilnahmebedingungen",
    prizeScope: PRIZE_SCOPE,
    deadlineLabel: ENTRY_DEADLINE_LABEL,
    announcementLabel: ANNOUNCEMENT_DATETIME_LABEL,
    getPhase: getSweepstakesPhase,
    duplicateMessage:
      "Diese Bestellnummer wurde bereits für das Gewinnspiel registriert. Falls du glaubst, dass es sich um einen Fehler handelt, kontaktiere bitte den Support.",
    prizes: DUBAI_PRIZES,
  },
  cards_2026: {
    id: CARDS_CAMPAIGN_ID,
    slug: "cards",
    label: "Cards – TCG-Gewinnspiel (OP-17 Case, Fusion World, Yu-Gi-Oh!, Cardmarket)",
    shortLabel: "Cards",
    entryPaths: [CARDS_ENTRY_PATH],
    termsVersion: CARDS_TERMS_VERSION,
    termsPath: CARDS_TERMS_PATH,
    prizeScope: CARDS_PRIZE_SCOPE,
    deadlineLabel: CARDS_ENTRY_DEADLINE_LABEL,
    announcementLabel: CARDS_ANNOUNCEMENT_LABEL,
    getPhase: getCardsPhase,
    duplicateMessage:
      "Diese Bestellnummer wurde bereits für das Cards-Gewinnspiel registriert. Falls du glaubst, dass es sich um einen Fehler handelt, kontaktiere bitte den Support.",
    prizes: CARDS_CAMPAIGN_PRIZES,
  },
};

export const CAMPAIGN_LIST: readonly SweepstakesCampaign[] = CAMPAIGN_IDS.map(
  (id) => SWEEPSTAKES_CAMPAIGNS[id],
);

export function getCampaign(id: CampaignId): SweepstakesCampaign {
  return SWEEPSTAKES_CAMPAIGNS[id];
}

/** Kampagne eines Teilnahmewegs – null für unbekannte Pfade (kein Fallback). */
export function campaignForEntryPath(path: unknown): SweepstakesCampaign | null {
  if (typeof path !== "string") return null;
  return CAMPAIGN_LIST.find((c) => (c.entryPaths as readonly string[]).includes(path)) ?? null;
}

/** Anzeige-Label einer gespeicherten Kampagnenkennung (unbekannte Werte roh). */
export function campaignLabel(id: string): string {
  return isCampaignId(id) ? SWEEPSTAKES_CAMPAIGNS[id].shortLabel : id;
}

/** Gewinn aus dem Katalog GENAU dieser Kampagne – null, wenn kampagnenfremd/unbekannt. */
export function campaignPrize(campaignId: string, prizeId: unknown): CampaignPrize | null {
  if (!isCampaignId(campaignId) || typeof prizeId !== "string") return null;
  return SWEEPSTAKES_CAMPAIGNS[campaignId].prizes.find((p) => p.id === prizeId) ?? null;
}
