/**
 * Redigierte, realistische Fixtures für Amazon-Creators-API-Antworten
 * (GetItems). KEINE echten Live-Daten und keine Secrets – ausschließlich für
 * Tests (CI führt niemals echte Provider-Requests aus).
 *
 * Rangwerte entsprechen dem älteren manuell beobachteten Beispielstand
 * (Bücher 12.484, Präsentationen 16, E-Business 33, Biografien 42).
 */

export const CREATORS_GETITEMS_SUCCESS = {
  itemsResult: {
    items: [
      {
        asin: "3690662508",
        detailPageURL: "https://www.amazon.de/dp/3690662508?tag=test-tag-21",
        parentASIN: null,
        browseNodeInfo: {
          websiteSalesRank: {
            salesRank: 12484,
            displayGroupName: "Bücher",
          },
          browseNodes: [
            {
              id: "686022031",
              displayName: "Präsentationen",
              salesRank: 16,
              isRoot: false,
              ancestor: {
                displayName: "Business & Karriere",
                ancestor: { displayName: "Bücher" },
              },
            },
            {
              id: "403434031",
              displayName: "E-Business (Bücher)",
              salesRank: 33,
              isRoot: false,
              ancestor: {
                displayName: "Business & Karriere",
                ancestor: { displayName: "Bücher" },
              },
            },
            {
              id: "402846031",
              displayName: "Biografien von Geschäftsleuten",
              salesRank: 42,
              isRoot: false,
              ancestor: {
                displayName: "Biografien & Erinnerungen",
                ancestor: { displayName: "Bücher" },
              },
            },
          ],
        },
        images: {
          primary: {
            small: { url: "https://m.media-amazon.com/images/I/test-cover._SL75_.jpg", width: 53, height: 75 },
            medium: { url: "https://m.media-amazon.com/images/I/test-cover._SL160_.jpg", width: 113, height: 160 },
            large: { url: "https://m.media-amazon.com/images/I/test-cover.jpg", width: 353, height: 500 },
          },
        },
        itemInfo: {
          title: { displayValue: "Die Lizenz zum Erfolg" },
          byLineInfo: {
            contributors: [{ name: "Soheil Hosseini", role: "Autor" }],
            manufacturer: { displayValue: "Deutscher Wirtschaftsbuch Verlag" },
          },
          classifications: {
            binding: { displayValue: "Taschenbuch" },
          },
          contentInfo: {
            publicationDate: { displayValue: "2026-10-06T00:00:01Z" },
          },
          externalIds: {
            isbns: { displayValues: ["3690662508"] },
            eans: { displayValues: ["9783690662505"] },
          },
        },
        offersV2: {
          listings: [
            {
              isBuyBoxWinner: true,
              price: {
                money: { amount: 18.0, currency: "EUR" },
                displayAmount: "18,00 €",
              },
              availability: {
                type: "PRE_ORDER",
                message: "Jetzt vorbestellen",
              },
            },
          ],
        },
      },
    ],
  },
} as const;

/** Item ohne websiteSalesRank und ohne Browse-Node-Ränge. */
export const CREATORS_GETITEMS_NO_RANKS = {
  itemsResult: {
    items: [
      {
        asin: "3690662508",
        detailPageURL: "https://www.amazon.de/dp/3690662508",
        browseNodeInfo: {
          browseNodes: [
            {
              id: "686022031",
              displayName: "Präsentationen",
              // kein salesRank – Amazon liefert nicht für jeden Node einen Rang
            },
          ],
        },
        itemInfo: { title: { displayValue: "Die Lizenz zum Erfolg" } },
      },
    ],
  },
} as const;

/** Nicht zugängliches Item (Errors-Container). */
export const CREATORS_GETITEMS_ITEM_ERROR = {
  itemsResult: { items: [] },
  errors: [
    {
      code: "ItemNotAccessible",
      message: "The ItemId B000000000 is not accessible through the Creators API.",
      itemId: "B000000000",
    },
  ],
} as const;
