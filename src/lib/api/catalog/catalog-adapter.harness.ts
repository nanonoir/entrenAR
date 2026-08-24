import { CatalogApiRepository } from "@/lib/api/catalog/catalog-api.repository";
import { CatalogApiError } from "@/lib/api/catalog/client";
import { catalogLoading, getCatalogRepository } from "@/lib/api/catalog/catalog.repository";
import { resolveShopRoute } from "@/lib/data/shop-routes";
import { resolveProductListing } from "@/lib/product-listing";

async function run(): Promise<void> {
  const mock = getCatalogRepository("mock");
  const mockDetail = await mock.getPublicProductBySlug("whey-protein-isolate-900g");

  if (mockDetail.status !== "success" || mockDetail.data.slug !== "whey-protein-isolate-900g") {
    throw new Error("Mock public slug compatibility failed.");
  }

  const api = new CatalogApiRepository({
    get: async (path) => {
      if (path.startsWith("/products?")) {
        return {
          items: [{
            id: "api-product",
            name: "API Product",
            price: "42.50",
            slug: "public-api-product",
            stock: "infinite",
            stockMode: "infinite",
            variants: [{
              id: "api-variant",
              label: "Default",
              optionValues: {},
              price: "42.50",
              stock: "infinite",
              stockMode: "infinite",
            }],
          }],
          limit: 100,
          page: 1,
          total: 1,
        };
      }

      if (path.startsWith("/admin/products?")) {
        return {
          items: [{
            categoryId: "api-category",
            categoryIds: ["api-category"],
            categoryName: "API Category",
            createdAt: "2026-08-24T00:00:00.000Z",
            highlightSections: [],
            id: "admin-product",
            manualOrder: 1,
            missingLogistics: false,
            name: "Admin API Product",
            publicSlug: "public-admin-product",
            salePrice: "85.25",
            salesCount: 0,
            shippingRequired: true,
            sku: "ADMIN-API-001",
            slug: "admin-api-product",
            stock: { type: "infinite" },
            tags: [],
            updatedAt: "2026-08-24T00:00:00.000Z",
            variantCombinations: [{ attributes: {}, id: "admin-variant", name: "Default", price: "85.25", sku: "ADMIN-API-001-DEFAULT", stock: "infinite" }],
            variantProperties: [],
            visibility: "visible",
          }],
          limit: 100,
          page: 1,
          total: 1,
        };
      }

      if (path.startsWith("/admin/inventory/history?")) {
        return {
          items: [{
            actor: "Admin",
            change: "Replaced stock with ∞.",
            createdAt: "2026-08-24T00:00:00.000Z",
            id: "history-1",
            origin: "admin_manual",
            productId: "admin-product",
            productName: "Admin API Product",
            resultingStock: "∞",
            type: "stock-edit",
          }],
        };
      }

      throw new CatalogApiError({ code: "NOT_FOUND", message: "Missing", status: 404 });
    },
  });
  const apiProducts = await api.getPublicProducts();

  if (
    apiProducts.status !== "success" ||
    apiProducts.data[0]?.slug !== "public-api-product" ||
    apiProducts.data[0]?.price !== 42.5 ||
    apiProducts.data[0]?.stock !== Number.MAX_SAFE_INTEGER
  ) {
    throw new Error("API Decimal/infinite-stock mapping failed.");
  }

  const adminProducts = await api.getAdminProducts();

  if (
    adminProducts.status !== "success" ||
    adminProducts.data[0]?.salePrice !== 85.25 ||
    adminProducts.data[0]?.stock.type !== "infinite" ||
    adminProducts.data[0]?.variantCombinations[0]?.stock !== "infinite"
  ) {
    throw new Error("Admin API stock/Decimal mapping failed.");
  }

  const history = await api.getInventoryHistory("admin-product");

  if (history.status !== "success" || history.data[0]?.id !== "history-1") {
    throw new Error("Inventory history mapping failed.");
  }

  const empty = new CatalogApiRepository({
    get: async () => ({ items: [], limit: 100, page: 1, total: 0 }),
  });
  const emptyProducts = await empty.getPublicProducts();

  if (emptyProducts.status !== "empty") {
    throw new Error("Empty state mapping failed.");
  }

  const unavailable = new CatalogApiRepository({
    get: async () => {
      throw new CatalogApiError({ code: "CATALOG_API_UNAVAILABLE", message: "Unavailable", status: 503 });
    },
  });
  const errorProducts = await unavailable.getPublicProducts();

  if (errorProducts.status !== "error" || errorProducts.error.code !== "CATALOG_API_UNAVAILABLE") {
    throw new Error("Error state mapping failed.");
  }

  if (catalogLoading<string[]>().status !== "loading") {
    throw new Error("Loading state mapping failed.");
  }

  const shopRoute = await resolveShopRoute(["productos", "whey-protein-isolate-900g"]);
  const listing = await resolveProductListing(["suplementos", "proteinas"]);

  if (shopRoute.type !== "product" || shopRoute.product.slug !== "whey-protein-isolate-900g" || listing?.context.categorySlug !== "proteinas") {
    throw new Error("Repository-backed public route mapping failed.");
  }

  console.log("catalog adapter harness: mock URL, public/admin Decimal and stock mappings, history, route reads, loading, empty, and error states passed");
}

void run();
