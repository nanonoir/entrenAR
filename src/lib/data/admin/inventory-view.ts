import type { AdminProduct } from "@/types/admin-product";

export const INVENTORY_PAGE_SIZE = 25;

export const INVENTORY_STOCK_FILTER = {
  ALL: "all",
  AVAILABLE: "available",
  INFINITE: "infinite",
  OUT: "out",
} as const;

export type InventoryStockFilter = (typeof INVENTORY_STOCK_FILTER)[keyof typeof INVENTORY_STOCK_FILTER];

export interface InventoryViewState {
  categoryId: string;
  page: number;
  query: string;
  stock: InventoryStockFilter;
}

export const defaultInventoryViewState: InventoryViewState = {
  categoryId: "",
  page: 1,
  query: "",
  stock: INVENTORY_STOCK_FILTER.ALL,
};

/** A product is "out" only when nothing sellable remains: no infinite stock and zero units across its rows. */
export function getInventoryStockStatus(product: AdminProduct): Exclude<InventoryStockFilter, "all"> {
  if (product.variantCombinations.length > 0) {
    if (product.variantCombinations.some((variant) => variant.stock === "infinite")) return INVENTORY_STOCK_FILTER.INFINITE;
    return product.variantCombinations.some((variant) => Number(variant.stock) > 0) ? INVENTORY_STOCK_FILTER.AVAILABLE : INVENTORY_STOCK_FILTER.OUT;
  }
  if (product.stock.type === "infinite") return INVENTORY_STOCK_FILTER.INFINITE;
  return product.stock.quantity > 0 ? INVENTORY_STOCK_FILTER.AVAILABLE : INVENTORY_STOCK_FILTER.OUT;
}

export function filterInventoryProducts(products: readonly AdminProduct[], state: InventoryViewState): AdminProduct[] {
  const query = state.query.trim().toLowerCase();
  return products.filter((product) => {
    if (state.categoryId && !(product.categoryIds.length > 0 ? product.categoryIds : [product.categoryId]).includes(state.categoryId)) return false;
    if (state.stock === INVENTORY_STOCK_FILTER.AVAILABLE && getInventoryStockStatus(product) === INVENTORY_STOCK_FILTER.OUT) return false;
    if (state.stock === INVENTORY_STOCK_FILTER.INFINITE && getInventoryStockStatus(product) !== INVENTORY_STOCK_FILTER.INFINITE) return false;
    if (state.stock === INVENTORY_STOCK_FILTER.OUT && getInventoryStockStatus(product) !== INVENTORY_STOCK_FILTER.OUT) return false;
    if (!query) return true;
    return [product.name, product.sku, product.categoryName, ...product.variantCombinations.flatMap((variant) => [variant.name, variant.sku])]
      .some((value) => value.toLowerCase().includes(query));
  });
}

export function paginateInventory<T>(items: readonly T[], page: number, pageSize = INVENTORY_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, total: items.length, totalPages };
}

export function parseInventoryViewState(params: Pick<URLSearchParams, "get">): InventoryViewState {
  const stock = params.get("stock");
  const page = Number(params.get("page"));
  return {
    categoryId: params.get("category") ?? "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    query: params.get("q") ?? "",
    stock: stock === INVENTORY_STOCK_FILTER.AVAILABLE || stock === INVENTORY_STOCK_FILTER.INFINITE || stock === INVENTORY_STOCK_FILTER.OUT ? stock : INVENTORY_STOCK_FILTER.ALL,
  };
}

export function serializeInventoryViewState(state: InventoryViewState): string {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.stock !== INVENTORY_STOCK_FILTER.ALL) params.set("stock", state.stock);
  if (state.categoryId) params.set("category", state.categoryId);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}
