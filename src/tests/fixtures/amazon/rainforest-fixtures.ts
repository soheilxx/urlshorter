/**
 * Redigierte, realistische Fixtures für Rainforest-API-Antworten.
 * KEINE echten Live-Daten, keine Secrets. Der api_key-Parameter in URLs ist
 * absichtlich enthalten, um die Redaktion zu testen (Wert ist ein Platzhalter).
 *
 * Rangwerte entsprechen dem NEUEREN manuell beobachteten Beispielstand
 * (Bücher 9.350, Präsentationen 14, E-Business 22, Biografien 23).
 */

export const RAINFOREST_PRODUCT_SUCCESS = {
  request_info: { success: true, credits_used: 118, credits_remaining: 14882 },
  request_metadata: {
    id: "test-request-id",
    created_at: "2026-08-29T10:00:00.000Z",
    processed_at: "2026-08-29T10:00:04.000Z",
    amazon_url: "https://www.amazon.de/dp/3690662508?api_key=TESTKEY_SHOULD_BE_REDACTED",
  },
  product: {
    asin: "3690662508",
    parent_asin: null,
    title: "Die Lizenz zum Erfolg",
    authors: [{ name: "Soheil Hosseini" }],
    link: "https://www.amazon.de/dp/3690662508",
    image: "https://m.media-amazon.com/images/I/test-cover.jpg",
    images: [{ link: "https://m.media-amazon.com/images/I/test-cover.jpg" }],
    rating: 4.8,
    ratings_total: 12,
    bestsellers_rank: [
      { category: "Bücher", rank: 9350, link: "https://www.amazon.de/gp/bestsellers/books" },
      {
        category: "Bücher › Business & Karriere › Präsentationen",
        rank: 14,
        link: "https://www.amazon.de/gp/bestsellers/books/686022031",
      },
      {
        category: "Bücher › Business & Karriere › E-Business (Bücher)",
        rank: 22,
        link: "https://www.amazon.de/gp/bestsellers/books/403434031",
      },
      {
        category: "Bücher › Biografien & Erinnerungen › Biografien von Geschäftsleuten",
        rank: 23,
        link: "https://www.amazon.de/gp/bestsellers/books/402846031",
      },
    ],
    buybox_winner: {
      is_preorder: true,
      price: { symbol: "€", value: 18.0, currency: "EUR", raw: "18,00 €" },
      availability: { type: "preorder", raw: "Jetzt vorbestellen. Erscheint am 6. Oktober 2026." },
    },
    specifications: [
      { name: "ISBN-10", value: "3690662508" },
      { name: "ISBN-13", value: "978-3690662505" },
      { name: "Verlag", value: "Deutscher Wirtschaftsbuch Verlag" },
      { name: "Erscheinungstermin", value: "6. Oktober 2026" },
      { name: "Taschenbuch", value: "208 Seiten" },
    ],
  },
} as const;

/** Produkt ohne bestsellers_rank (fehlender Rang ist keine 0!). */
export const RAINFOREST_PRODUCT_NO_RANK = {
  request_info: { success: true, credits_used: 119, credits_remaining: 14881 },
  product: {
    asin: "3690662508",
    title: "Die Lizenz zum Erfolg",
    link: "https://www.amazon.de/dp/3690662508",
  },
} as const;

function bestsellerEntry(rank: number, asin: string, title: string) {
  return {
    rank,
    position: rank,
    asin,
    title,
    sub_title: { text: `Testautor ${rank}`, link: "https://www.amazon.de/author" },
    link: `https://www.amazon.de/dp/${asin}`,
    image: `https://m.media-amazon.com/images/I/test-${rank}.jpg`,
    rating: 4.0 + (rank % 10) / 10,
    ratings_total: 100 + rank,
    price: { symbol: "€", value: 10 + rank, currency: "EUR", raw: `${10 + rank},00 €` },
  };
}

/** Vollständige Top-25-Liste inkl. eines Duplikats (Position 26 = ASIN von Platz 3). */
export const RAINFOREST_BESTSELLERS_SUCCESS = {
  request_info: { success: true, credits_used: 120, credits_remaining: 14880 },
  request_metadata: {
    created_at: "2026-08-29T11:00:00.000Z",
    processed_at: "2026-08-29T11:00:05.000Z",
  },
  bestsellers_info: {
    current_category: { id: "sachbuecher_test", name: "Sachbücher" },
  },
  bestsellers: [
    ...Array.from({ length: 25 }, (_, i) =>
      bestsellerEntry(i + 1, i === 19 ? "3690662508" : `B0TEST${String(i + 1).padStart(4, "0")}`, i === 19 ? "Die Lizenz zum Erfolg" : `Testbuch Nummer ${i + 1}`),
    ),
    // Duplikat: gleiche ASIN wie Platz 3 – muss ohne Umsortierung entfernt werden
    bestsellerEntry(26, "B0TEST0003", "Testbuch Nummer 3 (Duplikat)"),
  ],
  pagination: { current_page: 1, total_pages: 2 },
} as const;

/** Partielle Liste (nur 18 Einträge). */
export const RAINFOREST_BESTSELLERS_PARTIAL = {
  request_info: { success: true, credits_used: 121, credits_remaining: 14879 },
  bestsellers: Array.from({ length: 18 }, (_, i) =>
    bestsellerEntry(i + 1, `B0PART${String(i + 1).padStart(4, "0")}`, `Teilliste Buch ${i + 1}`),
  ),
} as const;

export const RAINFOREST_CATEGORIES_SACHBUECHER = {
  request_info: { success: true },
  categories: [
    {
      id: "sachbuecher_test",
      name: "Sachbücher",
      type: "bestsellers",
      domain: "amazon.de",
      path: "Bücher > Sachbücher",
      parent_id: "buecher_test",
      has_children: true,
      is_root: false,
      link: "https://www.amazon.de/gp/bestsellers/books/sachbuecher",
    },
    {
      id: "sachbuecher_kindle_test",
      name: "Sachbücher",
      type: "bestsellers",
      domain: "amazon.de",
      path: "Kindle-Shop > Kindle eBooks > Sachbücher",
      parent_id: "kindle_test",
      has_children: true,
      is_root: false,
      link: "https://www.amazon.de/gp/bestsellers/digital-text/sachbuecher",
    },
  ],
} as const;

export const RAINFOREST_ACCOUNT_SUCCESS = {
  request_info: { success: true },
  account_info: {
    api_key: "TESTKEY_SHOULD_NEVER_BE_STORED",
    name: "Test Account",
    email: "test@example.com",
    plan: "starter",
    timezone: "(utc+01:00) berlin",
    credits_used: 120,
    credits_limit: 15000,
    credits_remaining: 14880,
    credits_reset_at: "2026-09-15T00:00:00.000Z",
    overage_allowed: false,
    status: [{ component: "api", status: "operational" }],
    usage_history: [
      { month: "august", year: 2026, month_number: 8, is_current_month: true, credits_total_for_month: 120 },
    ],
  },
} as const;

/** Fehlerantwort: Credits erschöpft (HTTP 200 mit success=false). */
export const RAINFOREST_ERROR_NO_CREDITS = {
  request_info: {
    success: false,
    message: "You have run out of credits. Please top up or upgrade your plan.",
  },
} as const;
