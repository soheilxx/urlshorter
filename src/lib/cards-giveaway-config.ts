/**
 * ZENTRALE Konfiguration des TCG-Gewinnspiels /cards (Kampagne "cards_2026").
 *
 * Eigenständige Verlosung – fachlich und technisch getrennt vom Dubai-
 * Gewinnspiel (gewinnspiel-config.ts): eigener Lostopf, eigene Gewinne, eigene
 * Fristen, eigene Teilnahmebedingungen. Alle Mengen, Bezeichnungen, Fristen und
 * Aktionstexte liegen ausschließlich hier; Summen werden berechnet, nie getippt.
 *
 * Quelle: Kampagnenbriefing „TCG-Gewinnspiel auf lizenzzumerfolg.com/cards“
 * (18.09.2026). Nicht belegte Produktdetails (Sprachversion, regionale Ausgabe
 * des OP-17-Cases, Boxen je Case, Packs je Box, enthaltene Karten, Marktwerte)
 * sind bewusst NICHT hinterlegt und dürfen nirgends behauptet werden.
 */
import { isBookReleased } from "@/lib/buch-config";
import { formatEur, type SweepstakesPhase } from "@/lib/gewinnspiel-config";

export const CARDS_CAMPAIGN_ID = "cards_2026" as const;

/** Öffentliche, kanonische URL (Canonical/OG/Teilen – nie mit Parametern). */
export const CARDS_URL = "https://lizenzzumerfolg.com/cards";
export const CARDS_ENTRY_PATH = "/cards" as const;
export const CARDS_THANKS_PATH = "/cards/danke";
export const CARDS_TERMS_PATH = "/cards/teilnahmebedingungen";

/* ----------------------------------------------------------------------------
 * Fristen (Europe/Berlin). Teilnahmeschluss 05.10.2026, 23:59 Uhr MESZ –
 * die volle Schlussminute zählt mit; serverseitig gilt die EXKLUSIVE Grenze
 * 06.10.2026 00:00:00 MESZ = 2026-10-05T22:00:00.000Z.
 * ------------------------------------------------------------------------- */
export const CARDS_TIMEZONE = "Europe/Berlin";
export const CARDS_ENTRY_DEADLINE_EXCLUSIVE = new Date("2026-10-06T00:00:00+02:00");
export const CARDS_ENTRY_DEADLINE_LABEL = "05.10.2026, 23:59 Uhr (MESZ)";
export const CARDS_ENTRY_DEADLINE_SHORT = "05.10.2026, 23:59 Uhr";
/** Gewinnerbekanntgabe: Datum in Europe/Berlin, bewusst ohne Uhrzeit. */
export const CARDS_ANNOUNCEMENT_DATE = new Date("2026-10-12T00:00:00+02:00");
export const CARDS_ANNOUNCEMENT_LABEL = "12.10.2026";

/** Manueller Status: "auto" folgt den Fristen; alles andere erzwingt eine Phase. */
export const CARDS_MODE: "auto" | SweepstakesPhase = "auto";

/** Aktuelle Phase des Cards-Gewinnspiels (nur aus diesen Fristen abgeleitet). */
export function getCardsPhase(now: Date = new Date()): SweepstakesPhase {
  if (CARDS_MODE !== "auto") return CARDS_MODE;
  if (now >= CARDS_ANNOUNCEMENT_DATE) return "announced";
  if (now >= CARDS_ENTRY_DEADLINE_EXCLUSIVE) return "closed";
  return "open";
}

/**
 * Version der Cards-Teilnahmebedingungen (wird je Teilnahme unveränderlich
 * gespeichert). Eigene Zählung, unabhängig von den Dubai-Bedingungen.
 */
export const CARDS_TERMS_VERSION = "cards-1.0 (18.09.2026)";

/* ----------------------------------------------------------------------------
 * Gewinne – exakt laut Briefing. 17 einzelne Gewinne, kein Gesamtmarktwert.
 * ------------------------------------------------------------------------- */
export type CardsWorld = "onepiece" | "dragonball" | "yugioh" | "cardmarket";
export type CardsPrizeId =
  "op17_case" | "fusion_world_st01_box" | "magnificent_monsters_eu_case" | "cardmarket_100";

export interface CardsPrize {
  id: CardsPrizeId;
  world: CardsWorld;
  /** Hauptgewinn (höchste visuelle Priorität) */
  main: boolean;
  /** Anzahl einzelner Gewinne dieser Kategorie */
  count: number;
  /** Bezeichnung EINES Gewinns (Einheit) */
  unit: string;
  /** Kurzform für Chips/Übersichten */
  short: string;
  /** Franchise/Produktfamilie */
  franchise: string;
  /** Offizieller Produktcode, sofern belegt */
  productCode: string | null;
  /** Sichtbare Versionsangabe, sofern belegt (z. B. „EU Version“) */
  variant: string | null;
  /** Panel-Texte laut Briefing */
  headline: string;
  subline: string;
  description: string;
  /** Wert je Gewinn – nur bei Wertgutscheinen belegt */
  valueEurPerUnit: number | null;
}

export const CARDS_PRIZES: readonly CardsPrize[] = [
  {
    id: "op17_case",
    world: "onepiece",
    main: true,
    count: 1,
    unit: "One Piece OP-17 Case",
    short: "OP-17 Case",
    franchise: "ONE PIECE CARD GAME",
    productCode: "OP-17",
    variant: null,
    headline: "1 × One Piece OP-17 Case",
    subline: "Hauptgewinn für One-Piece-Fans",
    description:
      "Unser Hauptgewinn für One-Piece-Fans: ein ganzes OP-17-Case. Mit deinem Buchkauf und der anschließenden Registrierung deiner Bestellnummer bist du bei der Verlosung dabei.",
    valueEurPerUnit: null,
  },
  {
    id: "fusion_world_st01_box",
    world: "dragonball",
    main: false,
    count: 3,
    unit: "Story Booster 01 Booster Box Fusion World",
    short: "Fusion World Booster Box",
    franchise: "Dragon Ball Super Card Game Fusion World",
    productCode: "ST01",
    variant: null,
    headline: "3 × Story Booster 01 Booster Box",
    subline: "Dragon Ball Super Card Game Fusion World",
    description:
      "Drei Gewinne für Dragon-Ball-Fans – jeweils eine Booster Box für die nächste Opening-Session.",
    valueEurPerUnit: null,
  },
  {
    id: "magnificent_monsters_eu_case",
    world: "yugioh",
    main: false,
    count: 3,
    unit: "Magnificent Monsters EU Version Case",
    short: "Magnificent Monsters EU Case",
    franchise: "Yu-Gi-Oh! TRADING CARD GAME",
    productCode: null,
    variant: "EU Version",
    headline: "3 × Magnificent Monsters Case",
    subline: "EU Version",
    description: "Drei Gewinne für Yu-Gi-Oh!-Fans – jeweils ein ganzes Case der EU-Version.",
    valueEurPerUnit: null,
  },
  {
    id: "cardmarket_100",
    world: "cardmarket",
    main: false,
    count: 10,
    unit: "Cardmarket-Wertgutschein über 100 €",
    short: "100 € Cardmarket",
    franchise: "Cardmarket",
    productCode: null,
    variant: null,
    headline: "10 × 100 € Cardmarket-Wertgutschein",
    subline: "Deine Wunschkarten. Deine Entscheidung.",
    description:
      "Wir verlosen zehn Wertgutscheine über jeweils 100 €. Zusammen sind das 1.000 € für die nächsten Wünsche deiner Sammlung.",
    valueEurPerUnit: 100,
  },
] as const;

export const CARDS_MAIN_PRIZE = CARDS_PRIZES.find((p) => p.main) as CardsPrize;
export const CARDS_SECONDARY_PRIZES = CARDS_PRIZES.filter((p) => !p.main);

/** 17 einzelne Gewinne (berechnet). */
export const CARDS_PRIZE_COUNT = CARDS_PRIZES.reduce((sum, p) => sum + p.count, 0);

/** Cardmarket-Gutscheine: 10 Stück, zusammen 1.000 € (berechnet). */
const CARDMARKET = CARDS_PRIZES.find((p) => p.id === "cardmarket_100") as CardsPrize;
export const CARDS_CARDMARKET_COUNT = CARDMARKET.count;
export const CARDS_CARDMARKET_VALUE_EUR = CARDMARKET.valueEurPerUnit ?? 0;
export const CARDS_CARDMARKET_TOTAL_EUR = CARDS_CARDMARKET_COUNT * CARDS_CARDMARKET_VALUE_EUR;
export const CARDS_CARDMARKET_VALUE_LABEL = formatEur(CARDS_CARDMARKET_VALUE_EUR);
export const CARDS_CARDMARKET_TOTAL_LABEL = formatEur(CARDS_CARDMARKET_TOTAL_EUR);

/** Kompakte Gewinnübersicht (Hero/FAQ): Menge immer sichtbar vor der Einheit. */
export function cardsPrizeOverviewLabel(prize: CardsPrize): string {
  if (prize.valueEurPerUnit) {
    return `${prize.count} × ${formatEur(prize.valueEurPerUnit)} ${prize.franchise}`;
  }
  return `${prize.count} × ${prize.short}`;
}

/** Vollständige Zeile für Bedingungen/FAQ, z. B. "3 × Story Booster 01 Booster Box Fusion World (ST01)". */
export function cardsPrizeFullLabel(prize: CardsPrize): string {
  const code = prize.productCode ? ` (${prize.productCode})` : "";
  return `${prize.count} × ${prize.unit}${code}`;
}

/**
 * Bestätigte Fakten-Chips zum Hauptgewinn. Bewusst ohne Sprachversion,
 * Region, Case-Inhalt und Versiegelungszustand (nicht belegt).
 */
export const CARDS_OP17_FACTS = [
  "1 × Case als Hauptgewinn",
  "Booster-Set OP-17",
  "Ein ganzes Case – keine Booster Box, kein einzelnes Pack",
] as const;

/**
 * Kennung des Gewinnumfangs – wird je Cards-Teilnahme gespeichert (Muster
 * PRIZE_SCOPE der Dubai-Kampagne), damit später nachvollziehbar bleibt,
 * wofür eine Anmeldung erfolgte.
 */
export const CARDS_PRIZE_SCOPE = `cards: ${CARDS_PRIZES.map((p) => `${p.count}×${p.short}`).join("+")} (${CARDS_TERMS_VERSION})`;

/**
 * Offizielle Cardmarket-Hilfeseite zu Gutscheinen (Einlösung im Konto,
 * Guthaben nur für Einkäufe auf Cardmarket, nicht auszahlbar). Es gelten die
 * dort veröffentlichten Bedingungen; hier werden keine eigenen Einschränkungen
 * oder Zusagen erfunden.
 */
export const CARDMARKET_VOUCHER_HELP_URL = "https://help.cardmarket.com/de/cardmarket-coupons";

/* ----------------------------------------------------------------------------
 * Aktionstexte (Teilen, CTA-Wortlaut) – Hero-/Sektionstexte liegen in der Seite.
 * ------------------------------------------------------------------------- */
export const CARDS_SHARE_TEXT = `Ein One Piece OP-17 Case, Dragon-Ball- und Yu-Gi-Oh!-Gewinne sowie ${CARDS_CARDMARKET_COUNT} × ${CARDS_CARDMARKET_VALUE_LABEL} Cardmarket: Bei „Die Lizenz zum Erfolg“ gibt es ${CARDS_PRIZE_COUNT} Gewinne für TCG-Fans. Buch kaufen, Bestellnummer eintragen und teilnehmen. 100 % der Autoreneinnahmen gehen an den Kinderschutzbund. Alle Infos: ${CARDS_URL}`;
export const CARDS_SHARE_TEXT_CLOSED = `Das Cards-Gewinnspiel zu „Die Lizenz zum Erfolg“ ist beendet – Gewinnerbekanntgabe am ${CARDS_ANNOUNCEMENT_LABEL}. Das Buch gibt es weiterhin: ${CARDS_URL}`;
export const CARDS_SHARE_TITLE = "Die Lizenz zum Erfolg · TCG-Gewinnspiel";

/** Primärer Amazon-CTA, datumsgesteuert (Erscheinungstermin aus buch-config). */
export function cardsAmazonCtaLabel(now: Date = new Date()): string {
  return isBookReleased(now) ? "Buch bei Amazon kaufen" : "Buch bei Amazon vorbestellen";
}

/** Terminzeile (Hero, Formular, FAQ, Bedingungen, Bestätigung). */
export const CARDS_DATES_LINE = `Teilnahmeschluss: ${CARDS_ENTRY_DEADLINE_LABEL} · Gewinnerbekanntgabe: ${CARDS_ANNOUNCEMENT_LABEL}`;
