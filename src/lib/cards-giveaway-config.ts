/**
 * ZENTRALE Konfiguration des TCG-Gewinnspiels /cards (Kampagne "cards_2026").
 *
 * Eigenständige Verlosung – fachlich und technisch getrennt vom Dubai-
 * Gewinnspiel (gewinnspiel-config.ts): eigener Lostopf, eigene Gewinne, eigene
 * Fristen, eigene Teilnahmebedingungen. Alle Mengen, Bezeichnungen, Fristen und
 * Aktionstexte liegen ausschließlich hier; Summen werden berechnet, nie getippt.
 *
 * Quellen: Kampagnenbriefing „TCG-Gewinnspiel auf lizenzzumerfolg.com/cards“
 * (18.09.2026) und Präzisierung des Auftraggebers (18.09.2026): OP-17 und
 * Magnificent Monsters werden als CASE mit je 12 Boxen verlost, Dragon Ball
 * Story Booster 01 als DISPLAY (Booster Box), kein Case. Pack-/Kartenzahlen je
 * Box stehen auf den Produktverpackungen (Produktbilder) bzw. offiziellen
 * Produktseiten. Sprachversion laut Auftraggeber (18.09.2026): englische
 * Ausgaben – Magnificent Monsters ausdrücklich EU Version in englischer
 * Sprache. Marktwerte und enthaltene Karten sind nicht belegt und werden
 * nirgends behauptet.
 */
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
/** Gewinnerbekanntgabe (Vorgabe des Auftraggebers, 18.09.2026): 21.10.2026 um 12 Uhr MESZ. */
export const CARDS_ANNOUNCEMENT_DATE = new Date("2026-10-21T12:00:00+02:00");
/** Kurzform für „Gewinnerbekanntgabe: …“ */
export const CARDS_ANNOUNCEMENT_LABEL = "21.10.2026, 12 Uhr";
/** Langform für „… am …“ */
export const CARDS_ANNOUNCEMENT_DATETIME_LABEL = "21.10.2026 um 12 Uhr";

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
 * 1.1: Case-/Display-Umfang präzisiert (12 Boxen je Case, ST01 als Display).
 * 1.2: Gewinnerbekanntgabe 21.10.2026 um 12 Uhr (MESZ).
 */
export const CARDS_TERMS_VERSION = "cards-1.2 (18.09.2026)";

/* ----------------------------------------------------------------------------
 * Gewinne – exakt laut Briefing + Präzisierung. 17 einzelne Gewinne.
 * ------------------------------------------------------------------------- */
export type CardsWorld = "onepiece" | "dragonball" | "yugioh" | "cardmarket";
export type CardsPrizeId =
  "op17_case" | "fusion_world_st01_display" | "magnificent_monsters_eu_case" | "cardmarket_100";

export interface CardsPrizeImage {
  src: string;
  alt: string;
  /** Bildunterschrift – kennzeichnet, was die Abbildung zeigt (z. B. Box aus dem Case). */
  caption: string;
  /** Intrinsische Größe (Layout-Stabilität) */
  width: number;
  height: number;
}

export interface CardsPrize {
  id: CardsPrizeId;
  world: CardsWorld;
  /** Hauptgewinn (höchste visuelle Priorität) */
  main: boolean;
  /** Anzahl einzelner Gewinne dieser Kategorie */
  count: number;
  /** Produktform eines Gewinns */
  form: "case" | "display" | "voucher";
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
  /** Umfang eines Gewinns (belegt: Auftraggeber bzw. Verpackungsaufdruck) */
  contents: string | null;
  /** Kurzes Umfangs-Badge auf dem Produktbild, z. B. „1 Case = 12 Boxes“ */
  badge: string | null;
  /** Panel-Texte */
  headline: string;
  subline: string;
  description: string;
  /** Wert je Gewinn – nur bei Wertgutscheinen belegt */
  valueEurPerUnit: number | null;
  /** Echtes Produktbild (null beim Wertgutschein → gestaltete Gutscheinkarte) */
  image: CardsPrizeImage | null;
}

export const CARDS_PRIZES: readonly CardsPrize[] = [
  {
    id: "op17_case",
    world: "onepiece",
    main: true,
    count: 1,
    form: "case",
    unit: "One Piece OP-17 Case",
    short: "OP-17 Case",
    franchise: "ONE PIECE CARD GAME",
    productCode: "OP-17",
    variant: null,
    contents: "12 Booster Boxes à 24 Packs (12 Karten je Pack)",
    badge: "1 Case = 12 Boxes",
    headline: "1 × One Piece OP-17 Case",
    subline: "Ein ganzes Case – 12 Booster Boxes „The World’s Strongest Warriors“",
    description:
      "Unser Hauptgewinn für One-Piece-Fans: ein ganzes OP-17-Case mit 12 Booster Boxes. Mit deinem Buchkauf und der anschließenden Registrierung deiner Bestellnummer bist du bei der Verlosung dabei.",
    valueEurPerUnit: null,
    image: {
      src: "/cards/op17-booster-box.webp",
      alt: "ONE PIECE CARD GAME OP-17 „The World’s Strongest Warriors“ Booster Box (englische Ausgabe)",
      caption: "Abbildung: eine der 12 Booster Boxes aus dem Case (englische Ausgabe)",
      width: 690,
      height: 720,
    },
  },
  {
    id: "fusion_world_st01_display",
    world: "dragonball",
    main: false,
    count: 3,
    form: "display",
    unit: "Story Booster 01 Display Fusion World",
    short: "ST01 Display",
    franchise: "Dragon Ball Super Card Game Fusion World",
    productCode: "ST01",
    variant: null,
    contents: "1 Display (Booster Box) mit 20 Packs à 12 Karten",
    badge: "1 Display = 20 Packs",
    headline: "3 × Story Booster 01 Display",
    subline: "Dragon Ball Super Card Game Fusion World · je ein Display, kein Case",
    description:
      "Drei Gewinne für Dragon-Ball-Fans – jeweils ein Display (Booster Box mit 20 Packs) für die nächste Opening-Session.",
    valueEurPerUnit: null,
    image: {
      src: "/cards/st01-display.webp",
      alt: "Dragon Ball Super Card Game Fusion World Story Booster 01 (ST01) Display (englische Ausgabe)",
      caption: "Abbildung: Story Booster 01 Display (englische Ausgabe)",
      width: 1500,
      height: 1500,
    },
  },
  {
    id: "magnificent_monsters_eu_case",
    world: "yugioh",
    main: false,
    count: 3,
    form: "case",
    unit: "Magnificent Monsters EU Version Case",
    short: "Magnificent Monsters EU Case",
    franchise: "Yu-Gi-Oh! TRADING CARD GAME",
    productCode: null,
    variant: "EU Version",
    contents: "1 Case = 12 Boxen (EU Version, englischsprachig)",
    badge: "1 Case = 12 Boxen",
    headline: "3 × Magnificent Monsters Case",
    subline: "EU Version (englisch) · je ein ganzes Case mit 12 Boxen",
    description:
      "Drei Gewinne für Yu-Gi-Oh!-Fans – jeweils ein ganzes Case der englischsprachigen EU-Version mit 12 Boxen Magnificent Monsters.",
    valueEurPerUnit: null,
    image: {
      src: "/cards/magnificent-monsters-eu.png",
      alt: "Yu-Gi-Oh! TRADING CARD GAME Magnificent Monsters Box (EU Version, English Edition, 1st Edition)",
      caption: "Abbildung: eine der 12 Boxen aus dem Case (EU Version, English Edition)",
      width: 600,
      height: 760,
    },
  },
  {
    id: "cardmarket_100",
    world: "cardmarket",
    main: false,
    count: 10,
    form: "voucher",
    unit: "Cardmarket-Wertgutschein über 100 €",
    short: "100 € Cardmarket",
    franchise: "Cardmarket",
    productCode: null,
    variant: null,
    contents: null,
    badge: null,
    headline: "10 × 100 € Cardmarket-Wertgutschein",
    subline: "Deine Wunschkarten. Deine Entscheidung.",
    description:
      "Wir verlosen zehn Wertgutscheine über jeweils 100 €. Zusammen sind das 1.000 € für die nächsten Wünsche deiner Sammlung.",
    valueEurPerUnit: 100,
    image: null,
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
  if (prize.id === "op17_case") return `${prize.count} × OP-17 Case (12 Boxes)`;
  if (prize.id === "magnificent_monsters_eu_case")
    return `${prize.count} × Magnificent Monsters Case (EU)`;
  return `${prize.count} × ${prize.short}`;
}

/** Vollständige Zeile für Bedingungen/FAQ, z. B. "3 × Story Booster 01 Display Fusion World (ST01)". */
export function cardsPrizeFullLabel(prize: CardsPrize): string {
  const code = prize.productCode ? ` (${prize.productCode})` : "";
  return `${prize.count} × ${prize.unit}${code}`;
}

/**
 * Bestätigte Fakten-Chips zum Hauptgewinn (Auftraggeber + Verpackungsaufdruck).
 * Bewusst ohne Marktwert und ohne Zusage einzelner Karten.
 */
export const CARDS_OP17_FACTS = [
  "1 Case = 12 Booster Boxes",
  "24 Packs je Box · 12 Karten je Pack",
  "Booster-Set OP-17 „The World’s Strongest Warriors“",
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
 * Aktionstexte (Teilen, CTA-Wortlaut, Messenger-Vorschau).
 * ------------------------------------------------------------------------- */
export const CARDS_SHARE_TEXT = `Ein ganzes One Piece OP-17 Case (12 Boxes), Dragon-Ball- und Yu-Gi-Oh!-Gewinne sowie ${CARDS_CARDMARKET_COUNT} × ${CARDS_CARDMARKET_VALUE_LABEL} Cardmarket: Bei „Die Lizenz zum Erfolg“ gibt es ${CARDS_PRIZE_COUNT} Gewinne für TCG-Fans. Buch kaufen, Bestellnummer eintragen und teilnehmen. 100 % der Autoreneinnahmen gehen an den Kinderschutzbund. Alle Infos: ${CARDS_URL}`;
export const CARDS_SHARE_TEXT_CLOSED = `Das Cards-Gewinnspiel zu „Die Lizenz zum Erfolg“ ist beendet – Gewinnerbekanntgabe am ${CARDS_ANNOUNCEMENT_DATETIME_LABEL}. Das Buch gibt es weiterhin: ${CARDS_URL}`;
export const CARDS_SHARE_TITLE = "Ein ganzes One Piece OP-17 Case zu gewinnen";

/**
 * Messenger-/Social-Vorschau (WhatsApp, Telegram, Meta, X): klickstark für
 * die Zielgruppe – Gewinne statt Anleitung. Die Teilnahmemechanik steht auf
 * der Seite selbst; die Vorschau behauptet keine kostenlose Teilnahme.
 */
export const CARDS_OG_TITLE = "Ein ganzes One Piece OP-17 Case zu gewinnen 🔥 TCG-Verlosung";
export const CARDS_OG_DESCRIPTION = `1 × OP-17 Case (12 Boxes), 3 × Dragon Ball Fusion World ST01 Display, 3 × Yu-Gi-Oh! Magnificent Monsters Case (EU, englisch) und ${CARDS_CARDMARKET_COUNT} × ${CARDS_CARDMARKET_VALUE_LABEL} Cardmarket-Guthaben – ${CARDS_PRIZE_COUNT} Gewinne für One-Piece-, Dragon-Ball- und Yu-Gi-Oh!-Fans. Teilnahmeschluss ${CARDS_ENTRY_DEADLINE_SHORT}.`;

/** Primärer Amazon-CTA – Vorgabe des Auftraggebers: immer „bestellen“ (nie „vorbestellen“/„kaufen“). */
export function cardsAmazonCtaLabel(): string {
  return "Buch bei Amazon bestellen";
}

/** Terminzeile (Hero, Formular, FAQ, Bedingungen, Bestätigung). */
export const CARDS_DATES_LINE = `Teilnahmeschluss: ${CARDS_ENTRY_DEADLINE_LABEL} · Gewinnerbekanntgabe: ${CARDS_ANNOUNCEMENT_LABEL}`;
