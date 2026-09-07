import { SPENDEN_HINWEIS } from "@/lib/buch-config";

export const INBOX_BOOK_PATH = "/buch-inbox";
export const INBOX_BOOK_URL = `https://lizenzzumerfolg.com${INBOX_BOOK_PATH}`;
export type InboxPortal = "gmx" | "webde" | "neutral";
type Query = Record<string, string | string[] | undefined>;

function portalValue(value: string | string[] | undefined): InboxPortal | null {
  const first = Array.isArray(value) ? value[0] : value;
  switch (first?.trim().toLowerCase()) {
    case "gmx":
    case "gmx.de":
    case "gmx.net":
      return "gmx";
    case "web":
    case "web.de":
    case "webde":
      return "webde";
    default:
      return null;
  }
}

/** Referrer ist nur ein Design-Fallback, kein verlässlicher Attributionsnachweis. */
export function resolveInboxPortal(query: Query, referrer?: string | null): InboxPortal {
  const explicit = portalValue(query.portal) ?? portalValue(query.utm_source);
  if (explicit) return explicit;
  try {
    const url = new URL(referrer ?? "");
    if (url.protocol !== "https:" && url.protocol !== "http:") return "neutral";
    const belongsTo = (domain: string) =>
      url.hostname === domain || url.hostname.endsWith(`.${domain}`);
    if (belongsTo("web.de")) return "webde";
    if (["gmx.net", "gmx.de", "gmx.com", "gmx.at", "gmx.ch"].some(belongsTo)) return "gmx";
  } catch {
    // Direktaufrufe und entfernte Referrer erhalten die gemeinsame Lesepost-Ansicht.
  }
  return "neutral";
}

export const INBOX_REASONS = [
  {
    title: "Du brauchst gerade neuen Mut.",
    text: "Ein beruflicher Wechsel. Ein Vorhaben, das du immer wieder verschiebst. Ein Rückschlag, der an dir nagt. In dieser Geschichte begegnest du einem Menschen, der ebenfalls zweifelt und Fehler macht. Das kann helfen, mit mehr Nachsicht auf den eigenen Weg zu schauen – und den nächsten Schritt wieder für möglich zu halten.",
  },
  {
    title: "Du willst eine Geschichte, bei der du mitfühlst.",
    text: "Was macht ein Mensch, wenn andere ihm wenig zutrauen? Wenn ein Plan scheitert? Wenn es plötzlich ernst wird? Begleite mich durch solche Momente. Du musst dich weder für Software noch für Unternehmensführung interessieren, um die Fragen dahinter zu kennen.",
  },
  {
    title: "Du möchtest etwas mit Bedeutung verschenken.",
    text: "Vielleicht denkst du gerade an jemanden, der vor einer Veränderung steht oder wahre Lebensgeschichten liebt. Schenk ihm ein Buch, über das ihr ins Gespräch kommen könnt. Auch aus einem verschenkten Exemplar fließen meine gesamten Autoren-Einnahmen an den Kinderschutzbund.",
  },
] as const;

export const INBOX_FAQ = [
  {
    question: "Geht es in dem Buch nur um Microsoft?",
    answer:
      "Du liest eine ganze Lebensgeschichte: vom Unterschätztwerden in der Schule über erste eigene Versuche und Rückschläge bis zum Aufbau mehrerer Unternehmen. Die Auseinandersetzung mit Microsoft beginnt, als Soheil 20 ist, und ist ein Teil dieses Weges.",
  },
  {
    question: "Ist das Buch auch etwas für mich, wenn ich kein Unternehmen gründen will?",
    answer:
      "Ja. Es geht um Menschen und Entscheidungen, um Zweifel, Rückschläge und Selbstbestimmung. Du liest eine Biografie und brauchst dafür keine Business-Vorkenntnisse. Wenn du wahre Lebensgeschichten magst oder gerade über deinen eigenen Weg nachdenkst, findest du hier Anknüpfungspunkte.",
  },
  {
    question: "Was bedeutet der Hinweis auf den Kinderschutzbund?",
    answer: SPENDEN_HINWEIS,
  },
  {
    question: "Wo bestelle ich das Buch und wann erscheint es?",
    answer:
      "Die Bestellbuttons führen dich direkt zum Buch auf Amazon. Das Taschenbuch erscheint am 6. Oktober 2026. Dort findest du die aktuelle Verfügbarkeit, den gültigen Preis und die Lieferbedingungen.",
  },
] as const;
