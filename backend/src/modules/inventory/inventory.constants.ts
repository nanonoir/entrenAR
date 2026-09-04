export const INVENTORY_OPERATION = {
  ADD: "add",
  REPLACE: "replace",
  SUBTRACT: "subtract",
} as const;

export const INVENTORY_STOCK_MODE = {
  INFINITE: "infinite",
  LIMITED: "limited",
} as const;

export const INVENTORY_ORIGIN = {
  ADMIN_MANUAL: "admin_manual",
  ADMIN_SALES_CANCELLATION: "admin_sales_cancellation",
  CHECKOUT: "checkout",
  PURCHASE_ORDER: "purchase_order",
} as const;

export type InventoryOperationInput = (typeof INVENTORY_OPERATION)[keyof typeof INVENTORY_OPERATION];
export type InventoryStockModeInput = (typeof INVENTORY_STOCK_MODE)[keyof typeof INVENTORY_STOCK_MODE];
export type InventoryOriginInput = (typeof INVENTORY_ORIGIN)[keyof typeof INVENTORY_ORIGIN];
