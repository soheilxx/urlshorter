export const REDDIT_BOOK_PATH = "/buch-reddit";
export const REDDIT_BOOK_URL = `https://lizenzzumerfolg.com${REDDIT_BOOK_PATH}`;

/** Vom Auftraggeber gewünschte gemeinsame, synthetisch gestützte öffentliche Anzeige.
 * Diese Werte sind KEINE Analytics, Rezensionen oder Kaufnachweise. */
export const ACTIVITY_DISPLAY = {
  epoch: Date.UTC(2026, 8, 5),
  baseScore: 1268,
  stepMs: 67_000,
  minimumReaders: 24,
};

export function displayedActivity(now: number, actualScore = 0) {
  const elapsed = Math.max(0, now - ACTIVITY_DISPLAY.epoch);
  const tick = Math.floor(elapsed / 29_000);
  return {
    score: Math.max(
      0,
      ACTIVITY_DISPLAY.baseScore + Math.floor(elapsed / ACTIVITY_DISPLAY.stepMs) + actualScore,
    ),
    readers: ACTIVITY_DISPLAY.minimumReaders + ((tick * 7 + Math.floor(tick / 3)) % 23),
  };
}

export const BOOK_FAQ = [
  {
    question: "Geht es im Buch nur um Microsoft?",
    answer:
      "Der jahrelange Konflikt ist ein Teil der Biografie. Im Mittelpunkt steht Soheil Hosseinis Weg: seine Kindheit, der Neuanfang in Deutschland und der Aufbau eigener Unternehmen. Die Auseinandersetzung mit Microsoft gehört in diese größere Geschichte.",
  },
  {
    question: "Ist das ein Ratgeber oder eine Biografie?",
    answer:
      "Eine Unternehmerbiografie. Du lernst einen Lebensweg und die Entscheidungen dahinter kennen. Ob und was du daraus für dich mitnimmst, entscheidest du selbst – das Buch verspricht dir keine universelle Erfolgsformel.",
  },
  {
    question: "Muss ich mich mit Business auskennen?",
    answer:
      "Du kannst dich für ungewöhnliche Lebensgeschichten interessieren, ohne selbst ein Unternehmen zu führen. Herkunft, Selbstbestimmung und der Umgang mit Widerständen sind Fragen, die weit über das Berufsleben hinausgehen.",
  },
  {
    question: "Wo kann ich das Buch bestellen?",
    answer:
      "Die Buttons führen dich zum Buch auf Amazon. Dort siehst du die aktuelle Verfügbarkeit, den gültigen Preis und die Lieferbedingungen. Das Taschenbuch erscheint am 6. Oktober 2026 und kann bestellt werden.",
  },
] as const;
