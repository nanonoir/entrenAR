import { load } from "cheerio";
import type { HttpPort } from "./scraper";
import { fetchWithRetry, mapBounded } from "./scraper";
import type { SourceCategoryMapping } from "./taxonomy";

const PAGE_SIZE = 100;
const MAX_CATEGORY_PAGES = 20;

export async function collectCategoryMemberships(mappings: readonly SourceCategoryMapping[], fetcher?: HttpPort): Promise<Map<string, string[]>> {
  const categories = mappings.filter((mapping): mapping is SourceCategoryMapping & { sourceUrl: string } => mapping.sourceUrl !== null);
  const results = await mapBounded(categories, async (category) => {
    const productIds = new Set<string>();
    for (let page = 1; page <= MAX_CATEGORY_PAGES; page += 1) {
      const pageUrl = categoryPageUrl(category.sourceUrl, page);
      const response = await fetchWithRetry(pageUrl, {
        fetcher,
        headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" },
      });
      if (response.status !== 200) throw new Error(`Category listing request failed for approved source category ${category.sourceCategory} (HTTP ${response.status}).`);
      const payload: unknown = JSON.parse(await response.text());
      if (typeof payload !== "object" || payload === null || !("html" in payload) || typeof payload.html !== "string") {
        throw new Error(`Category listing response shape changed for ${category.sourceCategory}.`);
      }
      const listing = parseProductListing(payload.html);
      for (const productId of listing.productIds) productIds.add(productId);
      if (listing.cardCount < PAGE_SIZE) break;
      if (page === MAX_CATEGORY_PAGES) throw new Error(`Category listing exceeded ${MAX_CATEGORY_PAGES} pages for ${category.sourceCategory}.`);
    }
    return { category: category.sourceCategory, productIds: [...productIds] };
  }, 3);

  const memberships = new Map<string, string[]>();
  for (const result of results) for (const productId of result.productIds) {
    const names = memberships.get(productId) ?? [];
    names.push(result.category);
    memberships.set(productId, names);
  }
  for (const [productId, names] of memberships) memberships.set(productId, [...new Set(names)].sort((left, right) => left.localeCompare(right)));
  return memberships;
}

export function categoryPageUrl(sourceUrl: string, page: number): string {
  if (!Number.isInteger(page) || page < 1 || page > MAX_CATEGORY_PAGES) throw new Error("Invalid category page number.");
  const url = new URL(sourceUrl);
  if (url.hostname !== "www.entreno.com.ar" || !url.pathname.endsWith("/")) throw new Error("Unapproved category listing URL.");
  url.pathname = `${url.pathname}page/${page}/`;
  url.search = "";
  url.searchParams.set("results_only", "true");
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("theme", "toluca");
  return url.toString();
}

export function extractProductIds(markup: string): string[] {
  return parseProductListing(markup).productIds;
}

function parseProductListing(markup: string): { productIds: string[]; cardCount: number } {
  const document = load(markup);
  const cards = document("[data-product-id]").toArray();
  const productIds = cards.map((element) => document(element).attr("data-product-id")?.trim()).filter((value): value is string => Boolean(value && /^\d+$/.test(value)));
  return { productIds: [...new Set(productIds)], cardCount: cards.length };
}
