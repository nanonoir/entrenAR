import { load } from "cheerio";
import { decodeSourceProduct, SystemicSourceSchemaError, type SourceProduct } from "./source-data/tiendanube-product";

export interface HttpResponse { status: number; headers: Headers; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }
export interface HttpPort { request(url: string, init: RequestInit): Promise<HttpResponse> }
export interface ScraperConfig { concurrency?: number; timeoutMs?: number; attempts?: number; fetcher?: HttpPort; headers?: HeadersInit }
export interface ExtractedProduct { url: string; name: string; descriptionHtml: string; sku?: string; price?: number; compareAtPrice?: number; images: string[]; categories: string[]; variants: unknown[]; sourceProduct?: SourceProduct }
export interface ExtractionFailure { url: string; code: "SOURCE_NOT_FOUND" | "SOURCE_FAILED" | "SOURCE_SCHEMA_INVALID"; message: string }

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
      const response = await fetcher.request(url, { signal: controller.signal, ...(config.headers ? { headers: config.headers } : {}) });
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
  const productRoot = document("#single-product").first();
  const productId = asRecordArray(productRoot.attr("data-variants"), url)[0]?.["product_id"];
  const sdkScript = document("script#nube-sdk-script").first().text();
  const sdkProduct = extractSdkProductObject(sdkScript, url);
  const sdkVariants = extractSdkVariants(sdkProduct, url);
  const variantRows = asRecordArray(productRoot.attr("data-variants"), url);
  if (variantRows.length === 0) throw new SystemicSourceSchemaError(url, "The product container has no data-variants entries.");
  const optionNames = document('label[for^="variation_"]').toArray().map((label) => document(label).text().trim()).filter(Boolean);
  const gallery = document("#single-product .js-product-slide").toArray().map((slide) => {
    const element = document(slide);
    const id = element.attr("data-image");
    const rawUrl = element.find(".js-product-slide-link").attr("href");
    if (!id || !rawUrl) return undefined;
    const imageUrl = normalizeImageUrl(rawUrl, url);
    return { id, url: imageUrl };
  }).filter((image): image is { id: string; url: string } => image !== undefined);
  const imageById = new Map(gallery.map((image) => [image.id, image]));
  const variants = variantRows.map((row) => {
    const id = String(row["id"] ?? "");
    const sdk = sdkVariants.get(id);
    if (!id || !sdk) throw new SystemicSourceSchemaError(url, `Missing NubeSDK logistics for variant ${id || "<empty>"}.`);
    const options = Object.fromEntries(optionNames.flatMap((name, index) => {
      const value = row[`option${index}`];
      return typeof value === "string" && value.trim() ? [[name, value.trim()]] : [];
    }));
    const rawPrice = row["price_number"];
    const rawCompareAt = row["compare_at_price_number"];
    const stockMode = sdk.stockManagement ? "TRACKED" : "INFINITE";
    const imageId = row["image"] === null || row["image"] === undefined ? undefined : String(row["image"]);
    if (imageId && !imageById.has(imageId)) throw new SystemicSourceSchemaError(url, `Variant ${id} references gallery image ${imageId} that is not in the product gallery.`);
    return {
      id,
      sku: String(row["sku"] ?? "").trim(),
      ...(typeof rawPrice === "number" ? { price: rawPrice } : {}),
      ...(typeof rawCompareAt === "number" && rawCompareAt > 0 ? { compareAtPrice: rawCompareAt } : {}),
      options,
      stockMode,
      ...(stockMode === "TRACKED" && Number.isInteger(row["stock"]) && (row["stock"] as number) >= 0 ? { quantity: row["stock"] as number } : {}),
      ...(imageId ? { imageId } : {}),
      logistics: {
        ...(sdk.weightKg === undefined ? {} : { weightGrams: Math.round(sdk.weightKg * 1000) }),
        ...(sdk.heightCm === undefined ? {} : { heightCm: sdk.heightCm }),
        ...(sdk.widthCm === undefined ? {} : { widthCm: sdk.widthCm }),
        ...(sdk.lengthCm === undefined ? {} : { lengthCm: sdk.lengthCm }),
      },
    };
  });
  const name = document("h1.js-product-name").first().text().trim() || document("h1").first().text().trim();
  const descriptionHtml = document('[data-store^="product-description"] .user-content').first().html() ?? "";
  const brand = sdkProduct.brand;
  const sourceProduct = decodeSourceProduct({ sourceUrl: url, sourceId: String(productId ?? ""), name, ...(brand ? { brand } : {}), descriptionHtml, categories: [], gallery, variants }, url);
  return {
    url,
    name,
    descriptionHtml,
    sku: sourceProduct.variants[0]?.sku,
    price: sourceProduct.variants[0]?.price,
    compareAtPrice: sourceProduct.variants[0]?.compareAtPrice,
    images: sourceProduct.gallery.map((image) => image.url),
    categories: sourceProduct.categories.map((category) => category.sourceCategory),
    variants: sourceProduct.variants,
    sourceProduct: { ...sourceProduct, name, descriptionHtml },
  };
}

export async function mapBounded<T, R>(items: readonly T[], worker: (item: T) => Promise<R>, concurrency: number = DEFAULT_CONFIG.concurrency): Promise<R[]> {
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

export async function extractProducts(urls: readonly string[], config: ScraperConfig = {}): Promise<{ products: ExtractedProduct[]; failures: ExtractionFailure[] }> {
  const extractBatch = async (batch: readonly string[]) => mapBounded<string, { url: string; product?: ExtractedProduct; failure?: ExtractionFailure }>(batch, async (url) => {
    try {
      const response = await fetchWithRetry(url, config);
      if (response.status === 404) return { url, failure: { url, code: "SOURCE_NOT_FOUND" as const, message: "Product source returned HTTP 404." } };
      if (response.status !== 200) return { url, failure: { url, code: "SOURCE_FAILED" as const, message: `Product source returned HTTP ${response.status}.` } };
      return { url, product: parseProductHtml(url, await response.text()) };
    } catch (error) {
      if (error instanceof SystemicSourceSchemaError) return { url, failure: { url, code: "SOURCE_SCHEMA_INVALID" as const, message: `${error.message} ${error.detail}` } };
      return { url, failure: { url, code: "SOURCE_FAILED" as const, message: error instanceof Error ? error.message : "Product source failed." } };
    }
  }, Math.min(config.concurrency ?? DEFAULT_CONFIG.concurrency, 3));
  const probe = urls.slice(0, Math.min(3, urls.length));
  const probeResults = await extractBatch(probe);
  const probeProducts = probeResults.flatMap((result) => result.product ? [result.product] : []);
  const probeFailures = probeResults.flatMap((result) => result.failure ? [result.failure] : []);
  if (probe.length > 0 && probeProducts.length === 0 && probeFailures.length === probe.length && probeFailures.every((failure) => failure.code === "SOURCE_SCHEMA_INVALID")) {
    const failedUrl = probeFailures[0]!.url;
    throw new SystemicSourceSchemaError(failedUrl, `All ${probe.length} products in the parser probe failed structured decoding.`, probeFailures.map((failure) => failure.url));
  }
  const remainingResults = await extractBatch(urls.slice(probe.length));
  const results = [...probeResults, ...remainingResults];
  return { products: results.flatMap((result) => result.product ? [result.product] : []), failures: results.flatMap((result) => result.failure ? [result.failure] : []) };
}

interface SdkVariantLogistics { stockManagement: boolean; weightKg?: number; heightCm?: number; widthCm?: number; lengthCm?: number }
interface SdkProductData { brand?: string; variantBlocks: string[] }

function asRecordArray(value: string | undefined, url: string): Array<Record<string, unknown>> {
  if (!value) throw new SystemicSourceSchemaError(url, "The product page is missing its #single-product data-variants attribute.");
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "object" || item === null || Array.isArray(item))) throw new Error("Expected an array of variant objects.");
    return parsed as Array<Record<string, unknown>>;
  } catch (error) { throw new SystemicSourceSchemaError(url, `The data-variants attribute is invalid JSON: ${error instanceof Error ? error.message : "parse error"}`); }
}

function extractSdkProductObject(script: string, url: string): SdkProductData {
  const marker = script.indexOf("product: {");
  if (marker < 0) throw new SystemicSourceSchemaError(url, "The NubeSDK initialState product object was not found.");
  const start = script.indexOf("{", marker);
  const objectText = takeBalanced(script, start, "{", "}");
  if (!objectText) throw new SystemicSourceSchemaError(url, "The NubeSDK product object is incomplete.");
  const brandValue = readJsField(objectText, "brand");
  const variantsMarker = objectText.indexOf("variants:");
  const arrayStart = variantsMarker < 0 ? -1 : objectText.indexOf("[", variantsMarker);
  const variantsArray = arrayStart < 0 ? undefined : takeBalanced(objectText, arrayStart, "[", "]");
  if (!variantsArray) throw new SystemicSourceSchemaError(url, "The NubeSDK product variants were not found.");
  const variantBlocks = splitTopLevelObjects(variantsArray.slice(1, -1));
  return { ...(typeof brandValue === "string" && brandValue.trim() ? { brand: brandValue.trim() } : {}), variantBlocks };
}

function extractSdkVariants(product: SdkProductData, url: string): Map<string, SdkVariantLogistics> {
  const variants = new Map<string, SdkVariantLogistics>();
  for (const block of product.variantBlocks) {
    const id = readJsField(block, "id");
    const stockManagement = readJsField(block, "stock_management");
    if ((typeof id !== "number" && typeof id !== "string") || typeof stockManagement !== "boolean") continue;
    variants.set(String(id), {
      stockManagement,
      ...optionalNumber(readJsField(block, "weight"), (value) => value * 1000, "weight"),
      ...optionalNumber(readJsField(block, "height"), (value) => value, "heightCm"),
      ...optionalNumber(readJsField(block, "width"), (value) => value, "widthCm"),
      ...optionalNumber(readJsField(block, "depth"), (value) => value, "lengthCm"),
    });
  }
  if (variants.size === 0) throw new SystemicSourceSchemaError(url, "No usable logistics/stock records were found in NubeSDK product variants.");
  return variants;
}

function optionalNumber(value: unknown, convert: (value: number) => number, key: "weight" | "heightCm" | "widthCm" | "lengthCm"): Partial<SdkVariantLogistics> {
  if (value === undefined || value === null || value === "") return {};
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numberValue)) throw new Error(`Invalid NubeSDK logistics value: ${key}.`);
  const converted = convert(numberValue);
  return key === "weight" ? { weightKg: converted / 1000 } : { [key]: converted };
}

function readJsField(objectText: string, key: string): unknown {
  const match = new RegExp(`(?:^|[,{]\\s*)${key}\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|-?\\d+(?:\\.\\d+)?|true|false|null)`).exec(objectText);
  if (!match) return undefined;
  const literal = match[1]!;
  if (literal.startsWith('"')) return JSON.parse(literal) as string;
  if (literal.startsWith("'")) return literal.slice(1, -1).replace(/\\\\'/g, "'").replace(/\\\\n/g, "\n");
  if (literal === "true") return true;
  if (literal === "false") return false;
  if (literal === "null") return null;
  return Number(literal);
}

function takeBalanced(input: string, start: number, open: string, close: string): string | undefined {
  if (input[start] !== open) return undefined;
  let depth = 0; let quote = ""; let escaped = false;
  for (let index = start; index < input.length; index += 1) {
    const character = input[index]!;
    if (quote) { if (escaped) escaped = false; else if (character === "\\") escaped = true; else if (character === quote) quote = ""; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === open) depth += 1;
    if (character === close && --depth === 0) return input.slice(start, index + 1);
  }
  return undefined;
}

function splitTopLevelObjects(input: string): string[] {
  const blocks: string[] = []; let start = -1; let depth = 0; let quote = ""; let escaped = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quote) { if (escaped) escaped = false; else if (character === "\\") escaped = true; else if (character === quote) quote = ""; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === "{") { if (depth === 0) start = index; depth += 1; }
    if (character === "}" && depth > 0 && --depth === 0 && start >= 0) { blocks.push(input.slice(start, index + 1)); start = -1; }
  }
  return blocks;
}

function normalizeImageUrl(value: string, pageUrl: string): string {
  const parsed = new URL(value, pageUrl);
  if (parsed.protocol === "http:") parsed.protocol = "https:";
  if (parsed.protocol !== "https:") throw new Error("Product gallery contains a non-HTTPS asset URL.");
  return parsed.toString();
}
