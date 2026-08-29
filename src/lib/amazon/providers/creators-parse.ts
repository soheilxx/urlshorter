import type {
  NormalizedCategoryRank,
  NormalizedProductMetadata,
  NormalizedProductRanks,
} from "@/lib/amazon/provider-types";

/**
 * Reine Parser für Amazon-Creators-API-Antworten (GetItems, lowerCamelCase).
 * Defensive Verarbeitung: kein Feld wird als vorhanden vorausgesetzt,
 * Zuordnung erfolgt ausschließlich über die ASIN – nie über Array-Positionen.
 */

type Json = Record<string, unknown>;

function obj(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Positiver Ganzzahl-Rang; alles andere (auch 0) → null. */
function rank(value: unknown): number | null {
  const n = num(value);
  return n !== null && Number.isInteger(n) && n > 0 ? n : null;
}

/** displayValue-Felder der itemInfo-Struktur. */
function displayValue(value: unknown): string | null {
  const o = obj(value);
  if (!o) return null;
  return str(o.displayValue) ?? null;
}

/** Ancestor-Kette eines Browse Nodes zu einem Pfad auflösen (Wurzel zuerst). */
function browseNodePath(node: Json): string | null {
  const names: string[] = [];
  let cursor: Json | null = obj(node.ancestor);
  while (cursor) {
    const name = str(cursor.displayName) ?? str(cursor.contextFreeName);
    if (name) names.unshift(name);
    cursor = obj(cursor.ancestor);
  }
  const own = str(node.displayName) ?? str(node.contextFreeName);
  if (own) names.push(own);
  return names.length > 0 ? names.join(" › ") : null;
}

export interface CreatorsItemError {
  asin: string | null;
  code: string | null;
  message: string | null;
}

export interface CreatorsParseResult {
  ranks: NormalizedProductRanks[];
  metadata: NormalizedProductMetadata[];
  errors: CreatorsItemError[];
}

/** Vorbestellstatus aus offersV2-Verfügbarkeit ableiten. */
function detectPreorder(availability: Json | null): boolean | null {
  if (!availability) return null;
  const type = str(availability.type);
  const message = str(availability.message);
  if (type && /pre.?order/i.test(type)) return true;
  if (message && /vorbestell|pre.?order/i.test(message)) return true;
  if (type) return false;
  return null;
}

/**
 * Parst eine GetItems-Antwort. Erwartete Struktur (Creators API):
 * { itemsResult: { items: [...] }, errors: [...] }
 * (defensiv auch itemResults/ItemsResult toleriert).
 */
export function parseCreatorsGetItems(payload: unknown): CreatorsParseResult {
  const root = obj(payload) ?? {};
  const itemsResult = obj(root.itemsResult) ?? obj(root.itemResults) ?? obj(root.ItemsResult) ?? {};
  const items = arr(itemsResult.items ?? (itemsResult as Json).Items);

  const ranks: NormalizedProductRanks[] = [];
  const metadata: NormalizedProductMetadata[] = [];

  for (const rawItem of items) {
    const item = obj(rawItem);
    if (!item) continue;
    const asin = str(item.asin) ?? str(item.ASIN);
    if (!asin) continue;

    // --- Ränge -------------------------------------------------------------
    const browseNodeInfo = obj(item.browseNodeInfo) ?? {};
    const websiteSalesRankObj = obj(browseNodeInfo.websiteSalesRank);
    const categoryRanks: NormalizedCategoryRank[] = [];
    for (const rawNode of arr(browseNodeInfo.browseNodes)) {
      const node = obj(rawNode);
      if (!node) continue;
      const nodeRank = rank(node.salesRank);
      const nodeId = str(node.id);
      const nodeName = str(node.displayName) ?? str(node.contextFreeName);
      if (nodeRank === null || !nodeId || !nodeName) continue;
      categoryRanks.push({
        providerCategoryId: nodeId,
        categoryName: nodeName,
        categoryPath: browseNodePath(node),
        rank: nodeRank,
        isRoot: node.isRoot === true,
        bestsellerUrl: null,
      });
    }
    ranks.push({
      asin,
      websiteSalesRank: rank(websiteSalesRankObj?.salesRank),
      websiteDisplayGroup:
        str(websiteSalesRankObj?.displayGroupName) ?? str(websiteSalesRankObj?.contextFreeName),
      categoryRanks,
      providerUpdatedAt: null, // Creators liefert keinen Rang-Zeitstempel
      partial: false,
    });

    // --- Metadaten ---------------------------------------------------------
    const itemInfo = obj(item.itemInfo) ?? {};
    const byLine = obj(itemInfo.byLineInfo) ?? {};
    const contributors = arr(byLine.contributors)
      .map((c) => str(obj(c)?.name))
      .filter((n): n is string => n !== null);
    const externalIds = obj(itemInfo.externalIds) ?? {};
    const isbns = arr(obj(externalIds.isbNs ?? externalIds.isbns)?.displayValues).map(String);
    const eans = arr(obj(externalIds.eaNs ?? externalIds.eans)?.displayValues).map(String);
    const classifications = obj(itemInfo.classifications) ?? {};
    const contentInfo = obj(itemInfo.contentInfo) ?? {};
    const pubDate = obj(contentInfo.publicationDate);

    const images = obj(item.images) ?? {};
    const primary = obj(images.primary) ?? {};
    const small = obj(primary.small);
    const medium = obj(primary.medium);
    const large = obj(primary.large);

    const offersV2 = obj(item.offersV2) ?? {};
    const listings = arr(offersV2.listings);
    const firstListing =
      listings.map(obj).find((l) => l !== null && l.isBuyBoxWinner === true) ??
      listings.map(obj).find((l) => l !== null) ??
      null;
    const priceObj = obj(firstListing?.price);
    const money = obj(priceObj?.money) ?? priceObj;
    const availabilityObj = obj(firstListing?.availability);

    metadata.push({
      asin,
      parentAsin: str(item.parentASIN) ?? str(item.parentAsin),
      title: displayValue(itemInfo.title),
      author: contributors.length > 0 ? contributors.join(", ") : null,
      publisher:
        displayValue(byLine.manufacturer) ?? displayValue(byLine.brand),
      format: displayValue(classifications.binding),
      isbn10: isbns.find((v) => v.replace(/-/g, "").length === 10)?.replace(/-/g, "") ?? null,
      isbn13:
        eans.find((v) => v.replace(/-/g, "").length === 13)?.replace(/-/g, "") ??
        isbns.find((v) => v.replace(/-/g, "").length === 13)?.replace(/-/g, "") ??
        null,
      publicationDate: str(pubDate?.displayValue),
      coverSmallUrl: str(small?.url),
      coverMediumUrl: str(medium?.url),
      coverLargeUrl: str(large?.url),
      coverWidth: num(large?.width) ?? num(medium?.width),
      coverHeight: num(large?.height) ?? num(medium?.height),
      price: num(money?.amount) ?? num(money?.value),
      currency: str(money?.currency) ?? str(money?.currencyCode),
      priceRaw: str(priceObj?.displayAmount) ?? str(money?.displayAmount),
      availability: str(availabilityObj?.type) ?? str(availabilityObj?.message),
      preorder: detectPreorder(availabilityObj),
      rating: null, // Creators API liefert keine Bewertungen
      reviewCount: null,
      productUrl: str(item.detailPageURL) ?? str(item.detailPageUrl),
    });
  }

  const errors: CreatorsItemError[] = arr(root.errors ?? (itemsResult as Json).errors)
    .map((rawError) => {
      const e = obj(rawError);
      return {
        asin: str(e?.itemId) ?? str(e?.asin),
        code: str(e?.code),
        message: str(e?.message),
      };
    })
    .filter((e) => e.asin !== null || e.code !== null || e.message !== null);

  return { ranks, metadata, errors };
}
