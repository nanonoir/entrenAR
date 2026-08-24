import { StockMode } from "../../generated/prisma/enums";
import { INVENTORY_STOCK_MODE, type InventoryStockModeInput } from "./inventory.constants";

export const PUBLIC_INFINITE_STOCK = Number.MAX_SAFE_INTEGER;

export interface InventoryState {
  quantity: number | null;
  stockMode: StockMode;
}

export interface AdminInventoryRecord {
  productId: string;
  quantity: number | null;
  stock: number | "infinite";
  stockMode: InventoryStockModeInput;
  variantId?: string;
}

export function normalizeInventoryState(state: InventoryState): InventoryState {
  if (state.stockMode === StockMode.INFINITE) {
    return { quantity: null, stockMode: StockMode.INFINITE };
  }

  if (state.stockMode === StockMode.OUT_OF_STOCK) {
    return { quantity: 0, stockMode: StockMode.TRACKED };
  }

  return { quantity: state.quantity ?? 0, stockMode: StockMode.TRACKED };
}

export function toAdminInventoryRecord(
  productId: string,
  variantId: string | undefined,
  state: InventoryState,
): AdminInventoryRecord {
  const normalized = normalizeInventoryState(state);
  const isInfinite = normalized.stockMode === StockMode.INFINITE;

  return {
    productId,
    quantity: normalized.quantity,
    stock: isInfinite ? INVENTORY_STOCK_MODE.INFINITE : normalized.quantity ?? 0,
    stockMode: isInfinite ? INVENTORY_STOCK_MODE.INFINITE : INVENTORY_STOCK_MODE.LIMITED,
    ...(variantId ? { variantId } : {}),
  };
}

export function toPublicStockNumber(state: InventoryState): number {
  const normalized = normalizeInventoryState(state);

  return normalized.stockMode === StockMode.INFINITE
    ? PUBLIC_INFINITE_STOCK
    : normalized.quantity ?? 0;
}

export function formatInventoryStock(state: InventoryState): string {
  const normalized = normalizeInventoryState(state);

  return normalized.stockMode === StockMode.INFINITE ? "∞" : String(normalized.quantity ?? 0);
}
