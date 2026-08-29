import { dedupeEntries } from "@/lib/amazon/leaderboard-math";
import type {
  NormalizedCategory,
  NormalizedCategoryRank,
  NormalizedLeaderboard,
  NormalizedLeaderboardEntry,
  NormalizedProductMetadata,
  NormalizedProductRanks,
  ProviderQuotaStatus,
} from "@/lib/amazon/provider-types";

/**
 * Reine Parser für Rainforest-API-Antworten (product, bestsellers, categories,
 * account). Defensive Verarbeitung – kein Feld wird vorausgesetzt.
 * Es wird NIE Roh-HTML verarbeitet (Requests laufen mit include_html=false).
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

function rank(value: unknown): number | null {
  const n = num(value);
  return n !== null && Number.isInteger(n) && n > 0 ? n : null;
}

function date(value: unknown): Date | null {
  const s = str(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface RainforestRequestInfo {
  success: boolean;
  creditsUsed: number | null;
  creditsRemaining: number | null;
  createdAt: Date | null;
  processedAt: Date | null;
}

export function parseRequestInfo(payload: unknown): RainforestRequestInfo {
  const root = obj(payload) ?? {};
  const info = obj(root.request_info) ?? {};
  const meta = obj(root.request_metadata) ?? {};
  return {
    success: info.success === true,
    creditsUsed: num(info.credits_used),
    creditsRemaining: num(info.credits_remaining),
    createdAt: date(meta.created_at ?? info.created_at),
    processedAt: date(meta.processed_at ?? info.processed_at),
  };
}

function parsePreorder(product: Json): boolean | null {
  const buybox = obj(product.buybox_winner) ?? {};
  if (buybox.is_preorder === true) return true;
  const availability = obj(buybox.availability) ?? obj(product.availability) ?? {};
  const availabilityText = str(availability.raw) ?? str(availability.type);
  // Amazon.de formuliert Vorbestellungen u. a. als "Dieser Artikel erscheint am …"
  if (
    availabilityText &&
    /vorbestell|pre.?order|noch nicht erschienen|erscheint am/i.test(availabilityText)
  ) {
    return true;
  }
  if (typeof buybox.is_preorder === "boolean") return buybox.is_preorder;
  if (availabilityText) return false;
  return null;
}

/** product.bestsellers_rank → Kategorienränge (erster Eintrag oft der Hauptrang). */
export function parseRainforestProductRanks(payload: unknown): NormalizedProductRanks | null {
  const root = obj(payload) ?? {};
  const product = obj(root.product);
  if (!product) return null;
  const asin = str(product.asin);
  if (!asin) return null;

  const info = parseRequestInfo(payload);
  let websiteSalesRank: number | null = null;
  let websiteDisplayGroup: string | null = null;
  const categoryRanks: NormalizedCategoryRank[] = [];

  for (const rawEntry of arr(product.bestsellers_rank)) {
    const entry = obj(rawEntry);
    if (!entry) continue;
    const entryRank = rank(entry.rank);
    const category = str(entry.category);
    if (entryRank === null || !category) continue;
    // "Bücher" (bzw. "Books") als Gesamtrang interpretieren, sonst Kategorierang
    const isOverall = /^(bücher|books)$/i.test(category.split("›").pop()?.trim() ?? category);
    if (isOverall && websiteSalesRank === null) {
      websiteSalesRank = entryRank;
      websiteDisplayGroup = category;
      continue;
    }
    const link = str(entry.link);
    const idFromLink = link?.match(/\/(?:bestsellers|gp\/bestsellers)\/[^/]*\/(\d+)/)?.[1] ?? null;
    const leafName = category.split("›").pop()?.trim() ?? category;
    categoryRanks.push({
      providerCategoryId: idFromLink ?? `name:${leafName.toLowerCase()}`,
      categoryName: leafName,
      categoryPath: category.includes("›") ? category : null,
      rank: entryRank,
      isRoot: false,
      // Browse-Node-IDs funktionieren bei type=bestsellers oft nicht direkt –
      // die Bestseller-URL aus der Produktantwort dient als Fallback.
      bestsellerUrl: link,
    });
  }

  return {
    asin,
    websiteSalesRank,
    websiteDisplayGroup,
    categoryRanks,
    providerUpdatedAt: info.processedAt,
    partial: false,
  };
}

/** product → Metadaten (Preis/Bewertung/Verfügbarkeit primär von Rainforest). */
export function parseRainforestProductMetadata(payload: unknown): NormalizedProductMetadata | null {
  const root = obj(payload) ?? {};
  const product = obj(root.product);
  if (!product) return null;
  const asin = str(product.asin);
  if (!asin) return null;

  const buybox = obj(product.buybox_winner) ?? {};
  const price = obj(buybox.price) ?? obj(product.price) ?? {};
  const availability = obj(buybox.availability) ?? obj(product.availability) ?? {};
  const specifications = arr(product.specifications).map(obj);
  const findSpec = (pattern: RegExp): string | null => {
    for (const spec of specifications) {
      const name = str(spec?.name);
      if (name && pattern.test(name)) return str(spec?.value);
    }
    return null;
  };
  const firstImage = str(product.image) ?? str(obj(arr(product.images)[0])?.link);
  const authors = arr(product.authors)
    .map((a) => str(obj(a)?.name))
    .filter((n): n is string => n !== null);

  return {
    asin,
    parentAsin: str(product.parent_asin),
    title: str(product.title),
    author: authors.length > 0 ? authors.join(", ") : str(product.author) ?? str(product.brand),
    publisher: findSpec(/verlag|publisher|herausgeber/i),
    format: str(product.format) ?? str(obj(arr(product.variants)[0])?.title),
    isbn10: findSpec(/isbn-?10/i)?.replace(/[\s-]/g, "") ?? null,
    isbn13: findSpec(/isbn-?13/i)?.replace(/[\s-]/g, "") ?? null,
    publicationDate: findSpec(/erscheinungstermin|publication date|herausgabedatum/i),
    coverSmallUrl: firstImage,
    coverMediumUrl: firstImage,
    coverLargeUrl: firstImage,
    coverWidth: null,
    coverHeight: null,
    price: num(price.value),
    currency: str(price.currency),
    priceRaw: str(price.raw),
    availability: str(availability.raw) ?? str(availability.type),
    preorder: parsePreorder(product),
    rating: num(product.rating),
    reviewCount: num(product.ratings_total),
    productUrl: str(product.link),
  };
}

/** bestsellers-Ergebnis → Top-25-Liste (Reihenfolge unverändert, Duplikate raus). */
export function parseRainforestBestsellers(
  payload: unknown,
  requestedLimit = 25,
): NormalizedLeaderboard | null {
  const root = obj(payload) ?? {};
  const rawEntries = arr(root.bestsellers);
  const info = parseRequestInfo(payload);
  const bestsellersInfo = obj(root.bestsellers_info) ?? {};
  const currentCategory = obj(bestsellersInfo.current_category) ?? {};

  if (rawEntries.length === 0 && !info.success) return null;

  const parsed: NormalizedLeaderboardEntry[] = [];
  for (const rawEntry of rawEntries) {
    const entry = obj(rawEntry);
    if (!entry) continue;
    const asin = str(entry.asin);
    const entryRank = rank(entry.rank) ?? rank(entry.position);
    const title = str(entry.title);
    if (!asin || entryRank === null || !title) continue;
    const price = obj(entry.price) ?? {};
    const subTitle = obj(entry.sub_title);
    parsed.push({
      position: rank(entry.position) ?? entryRank,
      bestsellerRank: entryRank,
      asin,
      title,
      subTitle: str(subTitle?.text) ?? str(entry.sub_title),
      author: str(subTitle?.text) ?? str(entry.author),
      variant: str(entry.variant),
      link: str(entry.link),
      image: str(entry.image),
      rating: num(entry.rating),
      reviewCount: num(entry.ratings_total),
      price: num(price.value),
      currency: str(price.currency),
      priceRaw: str(price.raw),
    });
  }

  // Duplikate entfernen (Reihenfolge bleibt), auf Limit begrenzen,
  // Positionen NICHT neu vergeben – nur fortlaufend nummerieren, wenn der
  // Provider keine position geliefert hat.
  const unique = dedupeEntries(parsed, requestedLimit).map((entry, index) => ({
    ...entry,
    position: index + 1,
  }));

  return {
    providerCategoryId: str(currentCategory.id),
    categoryName: str(currentCategory.name),
    entries: unique,
    returnedCount: unique.length,
    complete: unique.length >= requestedLimit,
    partialReason:
      unique.length >= requestedLimit
        ? null
        : `Provider lieferte nur ${unique.length} von ${requestedLimit} Einträgen`,
    providerUpdatedAt: info.processedAt,
  };
}

/** categories-Ergebnis → Kategorienliste inkl. Pfaden. */
export function parseRainforestCategories(payload: unknown): NormalizedCategory[] {
  const root = obj(payload) ?? {};
  const categories: NormalizedCategory[] = [];
  for (const rawCategory of arr(root.categories)) {
    const c = obj(rawCategory);
    if (!c) continue;
    const id = c.id !== undefined && c.id !== null ? String(c.id) : null;
    const name = str(c.name);
    if (!id || !name) continue;
    categories.push({
      providerCategoryId: id,
      name,
      type: str(c.type),
      path: str(c.path),
      parentId: c.parent_id !== undefined && c.parent_id !== null ? String(c.parent_id) : null,
      hasChildren: typeof c.has_children === "boolean" ? c.has_children : null,
      isRoot: typeof c.is_root === "boolean" ? c.is_root : null,
      domain: str(c.domain),
      url: str(c.link),
    });
  }
  return categories;
}

/** account-Ergebnis → Quota-Status (api_key/E-Mail werden NICHT übernommen). */
export function parseRainforestAccount(payload: unknown): ProviderQuotaStatus | null {
  const root = obj(payload) ?? {};
  const account = obj(root.account_info);
  if (!account) return null;
  const usage = arr(account.usage_history)
    .map(obj)
    .filter((u): u is Json => u !== null)
    .map((u) => ({
      month: str(u.month) ?? "?",
      year: num(u.year) ?? 0,
      credits: num(u.credits_total_for_month) ?? 0,
    }));
  const status = arr(account.status)
    .map(obj)
    .filter((s): s is Json => s !== null)
    .map((s) => ({
      component: str(s.component) ?? "?",
      status: str(s.status) ?? "?",
    }));
  return {
    plan: str(account.plan),
    creditsUsed: num(account.credits_used),
    creditsLimit: num(account.credits_limit),
    creditsRemaining: num(account.credits_remaining),
    creditsResetAt: str(account.credits_reset_at),
    overageAllowed: typeof account.overage_allowed === "boolean" ? account.overage_allowed : null,
    platformStatus: status.length > 0 ? status : null,
    monthlyUsage: usage.length > 0 ? usage : null,
  };
}
