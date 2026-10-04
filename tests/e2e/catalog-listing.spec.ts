import { test, expect, type Page } from "@playwright/test";
import { setTimeout as delay } from "node:timers/promises";
import { readFile } from "node:fs/promises";
import { canonicalCategoryUrl, loadCatalogReference, referenceScope, referenceMetadata,
  checkRecordedConsolidation, compareCurrentProtectedSnapshot, checkEmptyAndTransportFailure,
  type ReferenceProduct } from "../harnesses/catalog-listing-acceptance.harness";
import { publishedCategoryPaths, publishedBrandAliases } from "../harnesses/catalog-listing-acceptance.harness";
import { resolveProductListing } from "../../src/lib/product-listing";
import { CatalogApiRepository } from "../../src/lib/api/catalog/catalog-api.repository";
import type { CatalogApiClient } from "../../src/lib/api/catalog/client";
import type { ShakerSnapshot } from "../../backend/src/modules/catalog-scraper/operations/shaker-consolidation";

interface Facet { slug: string; label: string; count: number }
interface Product { id: string; slug: string; price: number; compareAtPrice?: number; categories: { id: string; slug: string }[] }
interface Listing {
  items: Product[]; total: number; totalPages: number; page: number; limit: number;
  facets: { brands: Facet[]; categories: Facet[]; subcategories: Facet[] };
  priceBounds: { min: number; max: number };
}
const reference = loadCatalogReference();
const categories = [...reference.publicCategories].sort((a, b) => a.slug.localeCompare(b.slug));
const offset = Number(process.env["CATALOG_CATEGORY_OFFSET"] ?? 0);
const size = Number(process.env["CATALOG_CATEGORY_SIZE"] ?? 12);
if (!Number.isInteger(offset) || offset < 0 || offset >= categories.length || !Number.isInteger(size) || size < 1 || size > 15) {
  throw new Error("Category offset must select discovered categories; size must be 1..15");
}
const selected = categories.slice(offset, offset + size);
const api = process.env["CATALOG_ACCEPTANCE_API"] ?? "http://127.0.0.1:3001/api/v1";
let nextRequest = 0;
async function pace(): Promise<void> {
  await delay(Math.max(0, nextRequest - Date.now()));
  nextRequest = Date.now() + 3000;
}
async function get<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await pace();
    const response = await fetch(`${api}${path}`, { signal: AbortSignal.timeout(15_000) });
    if (attempt === 0 && [502, 503, 504].includes(response.status)) { await response.body?.cancel(); continue; }
    expect(response.status, `API ${path}`).toBe(200);
    return await response.json() as T;
  }
  throw new Error("Bounded transient retry exhausted");
}
async function goto(page: Page, url: string): Promise<void> {
  await pace();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  expect(response?.status(), url).toBe(200);
}
const cards = (page: Page) => page.getByRole("article").getByRole("link", { name: /^Ver / });
const facetCounts = (facets: Facet[]) => Object.fromEntries([...facets].sort((a, b) => a.slug.localeCompare(b.slug)).map((f) => [f.slug, f.count]));

test.describe("catalog acceptance", () => {
  test.describe.configure({ mode: "default", timeout: 180_000 });
  test.beforeAll(async ({}, info) => {
    expect(info.config.workers, "Use --workers=1 to preserve throttle pacing").toBe(1);
    expect(info.project.retries, "Use --retries=0; requests have their own bounded retry").toBe(0);
    const recorded = await checkRecordedConsolidation();
    expect(reference.products.length).toBe(recorded.counts["Product"]);
    const memberships = reference.products.flatMap((p) => p.categoryIds.map((id) => `${p.id}:${id}`)).sort();
    expect(memberships).toEqual(recorded.links.map((row) => `${row["productId"]}:${row["categoryId"]}`).sort());
    const live = await get<{ id: string; slug: string; parentId?: string }[]>("/categories");
    expect(live.map((c) => c.slug).sort()).toEqual(categories.map((c) => c.slug).sort());
    for (const c of live) {
      const expected = categories.find((entry) => entry.slug === c.slug)!;
      expect(c.id).toBe(expected.id);
      expect(c.parentId ?? null).toBe(expected.parentId);
    }
    console.log(JSON.stringify({ discoveredPublicCount: categories.length, offset, size, selectedSlugs: selected.map((c) => c.slug) }));
  });
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(30_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  async function completeListing(page: Page, url: string, query: string, expected: ReferenceProduct[], scope = expected): Promise<void> {
    const metadata = referenceMetadata(scope, categories, new URLSearchParams(query).get("categorySlug") ?? undefined);
    const products: Product[] = [];
    const pages = Math.max(1, Math.ceil(expected.length / 100));
    expect(pages).toBeLessThanOrEqual(20);
    for (let number = 1; number <= pages; number++) {
      const result = await get<Listing>(`/products?limit=100&page=${number}&sort=featured${query}`);
      expect(result.page).toBe(number);
      expect(result.limit).toBe(100);
      expect(result.total).toBe(expected.length);
      expect(result.totalPages).toBe(Math.ceil(expected.length / 100));
      for (const key of ["brands", "categories", "subcategories"] as const) expect(facetCounts(result.facets[key])).toEqual(metadata[key]);
      expect(result.priceBounds).toEqual(metadata.priceBounds);
      products.push(...result.items);
    }
    expect(new Set(products.map((p) => p.id)).size).toBe(expected.length);
    expect(products.map((p) => p.id).sort()).toEqual(expected.map((p) => p.id).sort());
    for (const p of products) {
      const original = expected.find((candidate) => candidate.id === p.id)!;
      expect(p.slug).toBe(original.slug);
      expect(p.compareAtPrice ?? null).toBe(original.compareAtPrice);
      expect(p.price).toBe(original.price);
      expect(p.categories.map((c) => c.id).sort()).toEqual([...original.categoryIds].sort());
    }
    const browserPages = Math.max(1, Math.ceil(expected.length / 20));
    const seenUrls: string[] = [];
    for (let number = 1; number <= browserPages; number++) {
      if (number === 1) await goto(page, `${url}?page=1&campaign=acceptance`);
      else { await pace(); await page.getByRole("button", { name: "Página siguiente", exact: true }).click(); }
      await expect(page).toHaveURL((current) => current.pathname === url && current.searchParams.get("page") === String(number)
        && current.searchParams.get("campaign") === "acceptance");
      await expect(page.getByText(`${expected.length} productos encontrados`, { exact: true })).toBeVisible();
      const actual = await cards(page).evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
      expect(actual).toEqual(products.slice((number - 1) * 20, number * 20).map((p) => `/productos/${p.slug}`));
      seenUrls.push(...actual);
      if (expected.length === 0) await expect(page.getByText("No hay productos disponibles.", { exact: true })).toBeVisible();
      if (browserPages > 1) {
        await expect(page.getByRole("navigation", { name: "Paginación de productos" })).toContainText(`Página ${number} de ${browserPages}`);
        if (number === 1) await expect(page.getByRole("button", { name: "Página anterior" })).toBeDisabled();
        if (number === browserPages) await expect(page.getByRole("button", { name: "Página siguiente" })).toBeDisabled();
      }
    }
    expect(new Set(seenUrls).size).toBe(expected.length);
    expect(seenUrls.sort()).toEqual(expected.map((product) => `/productos/${product.slug}`).sort());
  }

  for (const category of selected) {
    test(`@categories public category ${category.slug}`, async ({ page }) => {
      const url = canonicalCategoryUrl(category);
      const client: CatalogApiClient = { get: <T>(path: string) => get<T>(path) };
      const route = await resolveProductListing(url.split("/").filter(Boolean), {}, new CatalogApiRepository(client));
      expect(route?.context.categorySlug === category.slug || route?.context.subcategorySlug === category.slug).toBe(true);
      await completeListing(page, url, `&categorySlug=${encodeURIComponent(category.slug)}`, referenceScope(reference, category.slug));
      console.log(JSON.stringify({ coveredSlug: category.slug, expectedUniqueTotal: referenceScope(reference, category.slug).length }));
    });
  }

  for (const slug of ["star-nutrition", "ena"]) {
    test(`@additional brand ${slug}`, async ({ page }) => {
      const expected = referenceScope(reference, undefined, slug);
      expect(expected.length).toBeGreaterThan(20);
      const brands = await get<Facet[]>("/brands");
      const metadata = referenceMetadata(referenceScope(reference), categories);
      expect(facetCounts(brands)).toEqual(metadata.brands);
      await goto(page, "/marcas");
      const brand = brands.find((b) => b.slug === slug)!;
      await expect(page.getByRole("link", { name: new RegExp(brand.label, "i") }).and(page.locator(`main a[href='/marcas/${slug}']`))).toHaveCount(1);
      await completeListing(page, `/marcas/${slug}`, `&brandSlug=${slug}`, expected);
      console.log(JSON.stringify({ brand: slug, currentReferenceTotal: expected.length }));
    });
  }
  test("@additional offers beyond global first 100", async ({ page }) => {
    const scope = referenceScope(reference);
    const offers = scope.filter((p) => p.compareAtPrice !== null && p.compareAtPrice > p.price);
    expect(offers.length).toBeGreaterThan(100);
    await completeListing(page, "/ofertas", "&offersOnly=true", offers, scope);
  });
  for (const slug of ["suplementos", "performance", "control-de-peso"]) {
    test(`@additional complete representative scope ${slug}`, async ({ page }) => {
      const category = categories.find((c) => c.slug === slug);
      expect(category, "Retained public scope must exist").toBeTruthy();
      const expected = referenceScope(reference, slug);
      await completeListing(page, canonicalCategoryUrl(category!), `&categorySlug=${slug}`, expected);
      console.log(JSON.stringify({ representativeScope: slug, currentReferenceTotal: expected.length }));
    });
  }
  test("@additional inclusive filters, full-scope facets and stable price sorting", async ({ page }) => {
    const scope = referenceScope(reference);
    const brand = referenceScope(reference, undefined, "ena");
    const price = [...brand].sort((a, b) => a.price - b.price)[Math.floor(brand.length / 2)]!.price;
    const expected = brand.filter((p) => p.price >= price);
    const query = `&brandSlugs=ena&minPrice=${price}`;
    const first = await get<Listing>(`/products?limit=20&page=1&sort=price-asc${query}`);
    expect(first.total).toBe(expected.length);
    expect(facetCounts(first.facets.brands)).toEqual(referenceMetadata(scope, categories).brands);
    const sorted = [...first.items].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
    expect(first.items.map((p) => p.id)).toEqual(sorted.map((p) => p.id));
    expect(first.items.every((p) => expected.some((original) => original.id === p.id))).toBe(true);
    await goto(page, `/productos?marca=ena&precioMin=${price}&orden=menor-precio`);
    expect(await cards(page).evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname)))
      .toEqual(first.items.map((p) => `/productos/${p.slug}`));
    await goto(page, "/productos?marca=unknown-acceptance-brand");
    await expect(page.getByText("No encontramos productos con esos filtros.", { exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
  test("@additional shakers and permanent aliases", async ({ page, request }) => {
    await completeListing(page, "/shakers", "&categorySlug=shakers", referenceScope(reference, "shakers"));
    for (const path of ["/shakers-y-botellas", "/suplementos/proteinas/shakers-y-botellas", "/marcas/Star%20Nutrition", "/marcas/ENA"]) {
      await pace();
      const response = await request.get(`${process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:3000"}${path}?page=2&orden=menor-precio&campaign=acceptance`, { maxRedirects: 0, timeout: 15_000 });
      expect(response.status()).toBe(308);
      const location = new URL(response.headers()["location"]!, "http://127.0.0.1:3000");
      expect(location.pathname).toBe(path.startsWith("/marcas") ? `/marcas/${path.endsWith("ENA") ? "ena" : "star-nutrition"}` : "/shakers");
      expect(location.searchParams.get("page")).toBe("2");
      expect(location.searchParams.get("orden")).toBe("menor-precio");
      expect(location.searchParams.get("campaign")).toBe("acceptance");
    }
    await pace();
    expect((await page.goto("/marcas/unknown-acceptance-brand", { waitUntil: "domcontentloaded" }))?.status()).toBe(404);
    await checkEmptyAndTransportFailure();
  });

  const navigation = [...publishedCategoryPaths.map((path) => ({ path, target: path.split("/").at(-1)!, brand: false })),
    ...publishedBrandAliases.map(([alias, target]) => ({ path: `/marcas/${alias}`, target, brand: true }))];
  const navigationOffset = Number(process.env["CATALOG_NAVIGATION_OFFSET"] ?? 0);
  const navigationSize = Number(process.env["CATALOG_NAVIGATION_SIZE"] ?? 6);
  if (!Number.isInteger(navigationOffset) || navigationOffset < 0 || navigationOffset >= navigation.length
    || !Number.isInteger(navigationSize) || navigationSize < 1 || navigationSize > 18) throw new Error("Invalid navigation chunk");
  for (const entry of navigation.slice(navigationOffset, navigationOffset + navigationSize)) {
    test(`@navigation published ${entry.path}`, async ({ page, request }) => {
      const params = "page=1&orden=menor-precio&campaign=navigation";
      await pace();
      const response = await request.get(`${process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:3000"}${entry.path}?${params}`, { maxRedirects: 0, timeout: 15_000 });
      expect(response.status()).toBe(entry.brand ? 308 : 200);
      if (entry.brand) {
        const location = new URL(response.headers()["location"]!, "http://127.0.0.1:3000");
        expect(location.pathname).toBe(`/marcas/${entry.target}`);
        expect(location.pathname).not.toBe(entry.path);
        for (const [key, value] of new URLSearchParams(params)) expect(location.searchParams.get(key)).toBe(value);
        await pace();
        expect((await request.get(location.href, { maxRedirects: 0, timeout: 15_000 })).status()).toBe(200);
        await pace();
        expect((await request.get("/marcas/unknown-acceptance-brand", { maxRedirects: 0, timeout: 15_000 })).status()).toBe(404);
      }
      await goto(page, `${entry.path}?${params}`);
      const expected = referenceScope(reference, entry.brand ? undefined : entry.target, entry.brand ? entry.target : undefined);
      await expect(page.getByText(`${expected.length} productos encontrados`, { exact: true })).toBeVisible();
      await expect(page).toHaveURL((url) => url.pathname === (entry.brand ? `/marcas/${entry.target}` : entry.path)
        && [...new URLSearchParams(params)].every(([key, value]) => url.searchParams.get(key) === value));
      const slugs = new Set(expected.map((product) => `/productos/${product.slug}`));
      const rendered = await cards(page).evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
      expect(rendered.length).toBe(Math.min(20, expected.length)); expect(rendered.every((slug) => slugs.has(slug))).toBe(true);
      expect(new Set(rendered).size).toBe(rendered.length);
      if (!entry.brand) {
        await pace();
        expect((await request.get(`/` + (entry.path.startsWith("/market/") ? "indumentaria" : "market") + `/${entry.target}`, { maxRedirects: 0, timeout: 15_000 })).status()).toBe(404);
      }
      console.log(JSON.stringify({ coveredPublishedPath: entry.path, canonicalTarget: entry.target, expectedTotal: expected.length }));
    });
  }

  for (const mobile of [false, true]) {
    test(`@additional ${mobile ? "mobile" : "desktop"} URL controls`, async ({ page }) => {
      await page.setViewportSize({ width: mobile ? 390 : 1440, height: 900 });
      await goto(page, "/productos?page=2&campaign=acceptance");
      if (mobile) { await page.getByRole("button", { name: "Ordenar por", exact: true }).click(); await pace(); await page.getByRole("button", { name: "Menor precio", exact: true }).click(); }
      else { await pace(); await page.getByLabel("Ordenar por", { exact: true }).selectOption("menor-precio"); }
      await expect(page).toHaveURL((url) => !url.searchParams.has("page") && url.searchParams.get("orden") === "menor-precio");
      await pace(); await page.getByRole("button", { name: "Página siguiente" }).click();
      await expect(page).toHaveURL((url) => url.searchParams.get("page") === "2" && url.searchParams.get("orden") === "menor-precio" && url.searchParams.get("campaign") === "acceptance");
      if (mobile) await page.getByRole("button", { name: "Filtros", exact: true }).click();
      const surface = mobile ? page.getByRole("dialog", { name: "Filtros" }) : page.getByRole("complementary").filter({ has: page.getByRole("button", { name: "Aplicar precio" }) });
      await surface.locator("summary").filter({ hasText: /^Marcas$/ }).click();
      const brandCount = referenceScope(reference, undefined, "ena").length;
      const brandCheckbox = surface.getByRole("checkbox", { name: `ENA ${brandCount}`, exact: true });
      await expect(brandCheckbox).not.toBeChecked();
      await pace(); await brandCheckbox.click();
      await expect(page).toHaveURL((url) => !url.searchParams.has("page") && url.searchParams.get("marca") === "ena");
      await expect(brandCheckbox).toBeChecked();
      const bounds = referenceMetadata(referenceScope(reference), categories).priceBounds;
      await surface.getByLabel("Mínimo", { exact: true }).fill(String(bounds.min));
      await surface.getByLabel("Máximo", { exact: true }).fill(String(bounds.max));
      await pace(); await surface.getByRole("button", { name: "Aplicar precio" }).click();
      await expect(page).toHaveURL((url) => !url.searchParams.has("page") && url.searchParams.get("precioMin") === String(bounds.min));
      await pace(); await surface.getByRole("button", { name: "Limpiar", exact: true }).click();
      await expect(page).toHaveURL((url) => !url.searchParams.has("marca") && !url.searchParams.has("precioMin") && !url.searchParams.has("orden") && url.searchParams.get("campaign") === "acceptance");
      await expect(brandCheckbox).not.toBeChecked();
      if (mobile) await page.getByRole("button", { name: "Ver productos", exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
  test("@additional closed cart avoids catalog fetch and open cart loads offers", async ({ page }) => {
    const calls: number[] = [];
    const responses: { page: number; status: number }[] = [];
    const isCatalog = (url: string) => {
      const parsed = new URL(url);
      return parsed.pathname === new URL(`${api}/products`).pathname && parsed.searchParams.get("limit") === "100";
    };
    page.on("request", (request) => { if (request.method() === "GET" && isCatalog(request.url())) calls.push(Number(new URL(request.url()).searchParams.get("page"))); });
    page.on("response", (response) => { if (isCatalog(response.url())) responses.push({ page: Number(new URL(response.url()).searchParams.get("page")), status: response.status() }); });
    await goto(page, "/ofertas?page=1&campaign=closed-cart");
    const drawer = page.getByRole("dialog", { name: "Tu carrito", exact: true });
    await expect(drawer).toHaveCount(0);
    await pace(); await page.getByRole("button", { name: "Página siguiente", exact: true }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("page") === "2" && url.searchParams.get("campaign") === "closed-cart");
    await expect(page.getByText(`${referenceScope(reference).filter((p) => p.compareAtPrice !== null && p.compareAtPrice > p.price).length} productos encontrados`, { exact: true })).toBeVisible();
    expect(calls).toEqual([]);
    const count = Math.ceil(referenceScope(reference).length / 100);
    expect(count).toBeGreaterThan(0);
    await pace();
    await Promise.all([
      page.waitForResponse((response) => isCatalog(response.url()) && new URL(response.url()).searchParams.get("page") === String(count), { timeout: 15_000 }),
      page.getByRole("button", { name: "Abrir carrito", exact: true }).click(),
    ]);
    await expect(drawer).toBeVisible();
    await expect.poll(() => [...new Set(responses.map((response) => response.page))].sort((a, b) => a - b), { timeout: 15_000 })
      .toEqual(Array.from({ length: count }, (_, index) => index + 1));
    expect(responses.every((response) => response.status === 200)).toBe(true);
    const openedCalls = calls.length;
    await drawer.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await pace(); await page.getByRole("button", { name: "Página siguiente", exact: true }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("page") === "3");
    await expect(page.getByRole("navigation", { name: "Paginación de productos" })).toContainText("Página 3 de");
    expect(calls.length).toBe(openedCalls);
  });
  test("@additional current protected integrity, not historical-only", async () => {
    const path = process.env["CATALOG_ACCEPTANCE_SNAPSHOT"];
    expect(path, "Fresh sanitized readonly snapshot is required").toBeTruthy();
    const expected = await checkRecordedConsolidation();
    const current: ShakerSnapshot = JSON.parse(await readFile(path!, "utf8"));
    compareCurrentProtectedSnapshot(current, expected);
  });
});
