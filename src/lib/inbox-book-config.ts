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
    title: "Du willst den nächsten Schritt wagen.",
    text: "Ein eigenes Projekt, ein beruflicher Neustart oder der Schritt in die Selbstständigkeit: In meiner Geschichte lernst du die Entscheidungen hinter meinen Unternehmen kennen. Einblicke, aus denen du Impulse für deine eigenen Vorhaben mitnehmen kannst.",
  },
  {
    title: "Du willst dir treu bleiben. Auch bei Gegenwind.",
    text: "Du kennst Situationen, in denen dein Gegenüber größer oder einflussreicher wirkt? Mein jahrelanger Konflikt mit Microsoft gibt der Frage einen persönlichen Bezug: Wofür stehe ich ein – und wie gehe ich mit Widerstand um?",
  },
  {
    title: "Du willst Erfolg nach deinen Maßstäben.",
    text: "Freiheit, Anerkennung, etwas Eigenes schaffen: Was zählt für dich? Eine Lebensgeschichte kann den Blick auf die eigenen Prioritäten verändern. Dieses Buch lädt dich ein, über deinen Weg nachzudenken – auch wenn du selbst kein Unternehmen gründen möchtest.",
  },
] as const;

export const INBOX_FAQ = [
  {
    question: "Geht es in dem Buch nur um Microsoft?",
    answer:
      "Der jahrelange Konflikt ist ein Teil der Biografie. Die Lizenz zum Erfolg erzählt Soheil Hosseinis persönlichen Weg, seine Entscheidungen und den Aufbau eigener Unternehmen. Im Mittelpunkt steht die ganze Lebensgeschichte.",
  },
  {
    question: "Ist das Buch auch etwas für mich ohne Business-Vorkenntnisse?",
    answer:
      "Ja. Es ist eine Unternehmerbiografie für Menschen, die sich für Lebensgeschichten, Selbstbestimmung und persönliche Entscheidungen interessieren. Du brauchst dafür keine Kenntnisse über Softwarelizenzen oder Unternehmensführung.",
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
