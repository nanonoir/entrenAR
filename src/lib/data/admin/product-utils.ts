import type { AdminProductStock } from "@/types/admin-product";

const PRODUCT_STOCK_TONE = {
  NEUTRAL: "neutral",
  SALE: "sale",
  SUCCESS: "success",
  WARNING: "warning",
} as const;

export type ProductStockTone = (typeof PRODUCT_STOCK_TONE)[keyof typeof PRODUCT_STOCK_TONE];

export function formatAdminProductStock(stock: AdminProductStock): string {
  if (stock.type === "infinite") return "∞";
  if (stock.quantity === 0) return "Sin stock";
  return `${stock.quantity} unidades`;
}

export function getAdminProductStockTone(stock: AdminProductStock): ProductStockTone {
  if (stock.type === "infinite") return PRODUCT_STOCK_TONE.SUCCESS;
  if (stock.quantity === 0) return PRODUCT_STOCK_TONE.SALE;
  if (stock.quantity <= 10) return PRODUCT_STOCK_TONE.WARNING;
  return PRODUCT_STOCK_TONE.SUCCESS;
}
