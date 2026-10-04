import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductListingSort } from "../../src/components/shop/products/listing/ProductListingSort";
import { productListingSortOptions, resolveProductListing } from "../../src/lib/product-listing";
import { resetListingPage, withListingPage } from "../../src/components/shop/products/listing/listing-query";
import type { CatalogListingPage, CatalogListingQuery, CatalogRepository, CatalogReadResult } from "../../src/lib/api/catalog/catalog.repository";
import type { CategoryNavItem } from "../../src/types/navigation";
import type { ProductDetail } from "../../src/types/product";

const categories: CatalogReadResult<CategoryNavItem[]> = {
  data: [
    { description: "Performance products", label: "Performance", slug: "performance" },
    { description: "Creatine and pre-training", label: "Creatina y pre", slug: "creatina-y-pre" },
  ],
  status: "success",
};

function listingPage(total: number, page: number): CatalogListingPage {
  return {
    facets: {
      brands: [{ count: 3, label: "ENA", slug: "ena" }],
      categories: [{ count: total, label: "Performance", slug: "performance" }],
      subcategories: [{ count: 2, label: "Glutamina", slug: "glutamina" }],
    },
    items: total > 0 ? [{ id: "product-1", name: "Product one", brand: "ENA", categorySlug: "performance", price: 50, slug: "product-one", stock: 1 } as unknown as ProductDetail] : [],
    limit: 20,
    page,
    priceBounds: { min: total > 0 ? 20 : 0, max: total > 0 ? 80 : 0 },
    total,
    totalPages: Math.ceil(total / 20),
  };
}

function repository(
  listingResult: CatalogReadResult<CatalogListingPage>,
  queries: CatalogListingQuery[],
  categoryResult: CatalogReadResult<CategoryNavItem[]> = categories,
): CatalogRepository {
  return {
    getAdminCategories: async () => ({ data: [], status: "empty" }),
    getAdminProductById: async () => ({ data: null, status: "empty" }),
    getAdminProducts: async () => ({ data: [], status: "empty" }),
    getInventoryHistory: async () => ({ data: [], status: "empty" }),
    getPublicBrands: async () => ({ data: [], status: "empty" }),
    getPublicCategories: async () => categoryResult,
    getPublicListing: async (query) => { queries.push(query); return listingResult; },
    getPublicProductBySlug: async () => ({ data: null, status: "empty" }),
    getPublicProducts: async () => ({ data: [], status: "empty" }),
  };
}

async function run(): Promise<void> {
  const sortMarkup = renderToStaticMarkup(createElement("div", null, ...Array.from({ length: 2 }, (_, key) =>
    createElement(ProductListingSort, { key, options: productListingSortOptions, value: "relevantes", mobileOpen: false,
      onChange: () => {}, onOpenMobile: () => {}, onCloseMobile: () => {} }))));
  const labels = [...sortMarkup.matchAll(/<label\b[^>]*for="([^"]+)"[^>]*>([^<]+)<\/label>/g)];
  const selectIds = [...sortMarkup.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>/g)].map((match) => match[1]);
  if (labels.length !== 2 || selectIds.length !== 2 || new Set(selectIds).size !== 2
    || labels.some((label, index) => label[1] !== selectIds[index] || label[2] !== "Ordenar por")) {
    throw new Error("Sort controls must have distinct stable IDs and explicit labels excluding option text.");
  }

  const queries: CatalogListingQuery[] = [];
  const populated = await resolveProductListing(["suplementos", "performance"], {
    categoria: "performance", marca: "ena", orden: "mas-vendidos", page: "2", precioMin: "20", precioMax: "80",
  }, repository({ data: listingPage(25, 2), status: "success" }, queries));
  const query = queries[0];
  if (!populated || populated.status !== "success" || populated.totalCount !== 25 || populated.page !== 2
    || populated.totalPages !== 2 || !query || query.categorySlug !== "performance" || query.page !== 2
    || query.brandSlugs?.[0] !== "ena" || query.categorySlugs?.[0] !== "performance"
    || query.sort !== "best-selling" || populated.filterGroups.every((group) => group.id !== "brand") || queries.length !== 1) {
    throw new Error("Server-filtered listing must preserve route, filters, sort, totals, facets and pagination.");
  }

  const empty = await resolveProductListing(["suplementos", "performance"], {}, repository(
    { data: listingPage(0, 1), status: "empty" }, [],
  ));
  if (!empty || empty.status !== "empty" || empty.context.title !== "Performance" || empty.totalCount !== 0) {
    throw new Error("A valid zero-product category must remain a listing, not a 404 or error.");
  }

  const noMatch = await resolveProductListing(["suplementos", "performance"], { marca: "unknown-brand" }, repository(
    { data: listingPage(0, 1), status: "empty" }, [],
  ));
  if (!noMatch || noMatch.status !== "empty" || noMatch.filterState.brandSlugs[0] !== "unknown-brand") {
    throw new Error("A valid filtered no-match must remain distinct from a catalog failure.");
  }

  const controlledError = await resolveProductListing(["suplementos", "performance"], {}, repository({
    error: { code: "CATALOG_API_UNAVAILABLE", message: "Unavailable" },
    status: "error",
  }, []));
  if (!controlledError || controlledError.status !== "error" || controlledError.error?.code !== "CATALOG_API_UNAVAILABLE") {
    throw new Error("Catalog failures must remain distinct from valid empty listings.");
  }

  const categoryFailure = await resolveProductListing(["suplementos", "performance"], {}, repository(
    { data: listingPage(0, 1), status: "empty" },
    [],
    { error: { code: "CATEGORY_API_UNAVAILABLE", message: "Unavailable" }, status: "error" },
  ));
  if (!categoryFailure || categoryFailure.status !== "error" || categoryFailure.context.title !== "Performance") {
    throw new Error("A public-category lookup failure must not turn a valid route into a false 404.");
  }

  const currentParams = new URLSearchParams("page=3&marca=ena&orden=mas-vendidos&campaign=spring");
  const nextPage = withListingPage(currentParams, 4);
  const reset = resetListingPage(currentParams);
  if (nextPage.get("page") !== "4" || nextPage.get("marca") !== "ena" || nextPage.get("campaign") !== "spring"
    || reset.has("page") || reset.get("marca") !== "ena" || reset.get("orden") !== "mas-vendidos") {
    throw new Error("Page navigation must retain query state; filter changes must reset only the page.");
  }

  console.log("catalog listing UI harness: populated, empty, controlled error, server filters, and query retention/reset are represented");
}

void run();
