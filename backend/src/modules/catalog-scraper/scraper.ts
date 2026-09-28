import { load } from "cheerio";

export interface HttpResponse { status: number; headers: Headers; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }
export interface HttpPort { request(url: string, init: RequestInit): Promise<HttpResponse> }
export interface ScraperConfig { concurrency?: number; timeoutMs?: number; attempts?: number; fetcher?: HttpPort }
export interface ExtractedProduct { url: string; name: string; descriptionHtml: string; sku?: string; price?: number; compareAtPrice?: number; images: string[]; categories: string[]; variants: unknown[] }

const DEFAULT_CONFIG = { concurrency: 3, timeoutMs: 15_000, attempts: 3 } as const;

export async function fetchWithRetry(url: string, config: ScraperConfig = {}): Promise<HttpResponse> {
  const fetcher = config.fetcher ?? { request: (input: string, init: RequestInit) => fetch(input, init) };
  const attempts = config.attempts ?? DEFAULT_CONFIG.attempts;
  const timeoutMs = config.timeoutMs ?? DEFAULT_CONFIG.timeoutMs;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher.request(url, { signal: controller.signal });
      if (response.status < 500 && response.status !== 429) return response;
      lastError = new Error(`Retryable HTTP status ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
  }
  throw lastError instanceof Error ? lastError : new Error("HTTP request failed.");
}

export function discoverProductUrls(xml: string): { urls: string[]; duplicates: number } {
  const urls = [...xml.matchAll(/<loc>\s*(https?:\/\/[^<]+\/productos\/[^<]+)\s*<\/loc>/gi)].map((match) => match[1]!);
  const unique = [...new Set(urls)].sort((left, right) => left.localeCompare(right));
  return { urls: unique, duplicates: urls.length - unique.length };
}

export function parseProductHtml(url: string, html: string): ExtractedProduct {
  const document = load(html);
  const variants = document("[data-variants]").first().attr("data-variants");
  let parsedVariants: unknown[] = [];
  if (variants) {
    try { parsedVariants = JSON.parse(variants) as unknown[]; } catch { throw new Error("Malformed variant data."); }
  }
  const script = document("script#nube-sdk-script, script[src*='nube-sdk']").first().text();
  return {
    url,
    name: document("h1").first().text().trim() || document("title").first().text().trim(),
    descriptionHtml: document(".product-description, [data-description]").first().html() ?? "",
    sku: document("[data-sku]").first().attr("data-sku"),
    price: numberFromText(document("[data-price]").first().attr("data-price") ?? document(".price").first().text()),
    compareAtPrice: numberFromText(document("[data-compare-at-price]").first().attr("data-compare-at-price") ?? ""),
    images: document("img").map((_, node) => document(node).attr("src")).get().filter((value): value is string => Boolean(value)),
    categories: document("[data-category]").map((_, node) => document(node).attr("data-category")).get().filter((value): value is string => Boolean(value)),
    variants: parsedVariants.length > 0 ? parsedVariants : script ? [script] : [],
  };
}

export async function mapBounded<T, R>(items: readonly T[], worker: (item: T) => Promise<R>, concurrency = DEFAULT_CONFIG.concurrency): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function consume(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => consume()));
  return results;
}

function numberFromText(value: string): number | undefined {
  const normalized = value.replace(/[^0-9.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const result = Number(normalized);
  return Number.isFinite(result) && result > 0 ? result : undefined;
}
