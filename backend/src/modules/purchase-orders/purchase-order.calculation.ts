import { addMoney, multiplyMoney, normalizeMoney, type MoneyInput } from "../../common/money/money.utils";
import type { PurchaseOrderMoneyItem, PurchaseOrderUpdateRecord } from "./purchase-orders.repository";

export interface PurchaseCalculationItem {
  productId: string;
  quantity: number;
  sku: string;
  title: string;
  unitCost: MoneyInput;
  variantId?: string | null;
}
export interface PurchaseCalculationInput {
  expectedDate: Date | null;
  items: readonly PurchaseCalculationItem[];
  notes: string | null;
  orderNumber: string;
  shippingCost: MoneyInput;
  supplierId: string;
  tax: MoneyInput;
}
export function calculatePurchaseOrder(input: PurchaseCalculationInput): PurchaseOrderUpdateRecord {
  const items: PurchaseOrderMoneyItem[] = input.items.map((item) => ({ ...item, totalCost: multiplyMoney(item.unitCost, item.quantity), unitCost: normalizeMoney(item.unitCost), variantId: item.variantId ?? null }));
  const subtotal = items.reduce((sum, item) => addMoney(sum, item.totalCost), normalizeMoney(0));
  const shippingCost = normalizeMoney(input.shippingCost);
  const tax = normalizeMoney(input.tax);
  return { expectedDate: input.expectedDate, items, notes: input.notes, orderNumber: input.orderNumber, shippingCost, subtotal, supplierId: input.supplierId, tax, total: addMoney(addMoney(subtotal, tax), shippingCost) };
}
