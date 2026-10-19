import {
  INVENTORY_PAGE_SIZE,
  defaultInventoryViewState,
  filterInventoryProducts,
  getInventoryStockStatus,
  paginateInventory,
  parseInventoryViewState,
  serializeInventoryViewState,
} from "../inventory-view";
import type { AdminProduct } from "@/types/admin-product";

function product(overrides: Partial<AdminProduct> & Pick<AdminProduct, "id" | "name" | "sku">): AdminProduct {
  return {
    categoryId: "cat-a", categoryIds: ["cat-a"], categoryName: "A", createdAt: "2026-01-01T00:00:00.000Z", highlightSections: [], manualOrder: 0,
    missingLogistics: false, publicSlug: overrides.id, salePrice: 1, salesCount: 0, shippingRequired: true, slug: overrides.id, stock: { type: "limited", quantity: 5 },
    tags: [], updatedAt: "2026-01-01T00:00:00.000Z", variantCombinations: [], variantProperties: [], visibility: "visible", ...overrides,
  };
}

function run(): void {
  const items = [
    product({ id: "1", name: "Whey Vainilla", sku: "WHEY-1" }),
    product({ id: "2", name: "Creatina", sku: "CRE-1", categoryId: "cat-b", categoryIds: ["cat-b"], categoryName: "B", stock: { type: "limited", quantity: 0 } }),
    product({ id: "3", name: "Banda", sku: "BAN-1", stock: { type: "infinite" } }),
    product({ id: "4", name: "Remera", sku: "REM-1", variantCombinations: [{ id: "v1", name: "Talle M", sku: "REM-M", stock: 0 }, { id: "v2", name: "Talle L", sku: "REM-L", stock: 0 }] }),
    product({ id: "5", name: "Short", sku: "SHO-1", variantCombinations: [{ id: "v3", name: "Talle S", sku: "SHO-S", stock: 0 }, { id: "v4", name: "Talle XL", sku: "SHO-XL", stock: 3 }] }),
  ];
  assert(getInventoryStockStatus(items[3]!) === "out" && getInventoryStockStatus(items[4]!) === "available" && getInventoryStockStatus(items[2]!) === "infinite", "Stock status derivation failed.");
  assert(filterInventoryProducts(items, { ...defaultInventoryViewState, query: "cre-1" }).map((p) => p.id).join() === "2", "SKU search failed.");
  assert(filterInventoryProducts(items, { ...defaultInventoryViewState, query: "talle xl" }).map((p) => p.id).join() === "5", "Variant name search failed.");
  assert(filterInventoryProducts(items, { ...defaultInventoryViewState, stock: "out" }).map((p) => p.id).join() === "2,4", "Out-of-stock filter failed.");
  assert(filterInventoryProducts(items, { ...defaultInventoryViewState, stock: "available" }).map((p) => p.id).join() === "1,3,5", "Available filter failed.");
  assert(filterInventoryProducts(items, { ...defaultInventoryViewState, categoryId: "cat-b" }).map((p) => p.id).join() === "2", "Category filter failed.");

  const many = Array.from({ length: INVENTORY_PAGE_SIZE * 2 + 1 }, (_, index) => index);
  const last = paginateInventory(many, 99);
  assert(last.page === 3 && last.items.length === 1 && last.totalPages === 3, "Pagination did not clamp to the last page.");
  assert(paginateInventory([], 4).page === 1 && paginateInventory([], 4).totalPages === 1, "Empty pagination failed.");

  const state = { categoryId: "cat-b", page: 3, query: " whey ", stock: "out" as const };
  const query = serializeInventoryViewState(state);
  const restored = parseInventoryViewState(new URLSearchParams(query));
  assert(restored.query === "whey" && restored.stock === "out" && restored.categoryId === "cat-b" && restored.page === 3, "View state did not round-trip through the URL.");
  assert(serializeInventoryViewState(defaultInventoryViewState) === "" && parseInventoryViewState(new URLSearchParams("stock=bogus&page=-2")).stock === "all", "Invalid URL state was not normalized.");
  console.log("inventory view harness: search, stock/category filters, pagination, and URL state passed");
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

run();
