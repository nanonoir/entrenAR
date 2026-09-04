import { generateEventId } from "@/lib/data/admin/sales-flow/helpers";
import type {
  AdminSaleDetail,
  CancelSalePayload,
  CreateManualSalePayload,
  CreatePurchaseOrderPayload,
  PurchaseOrder,
  SalesRepository,
} from "@/lib/api/admin/sales/sales.repository";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import type { AdminSalesState, CreatePurchaseOrderInput, CreateSaleInput, SalesStoreError } from "@/stores/admin-sales-store";
import type { AdminPurchaseOrder, AdminSale, SaleHistoryEvent } from "@/lib/data/admin/sales-flow/types";

type SalesStoreSetter = (value: Partial<AdminSalesState> | ((state: AdminSalesState) => Partial<AdminSalesState>)) => void;

export function toManualSalePayload(input: CreateSaleInput | CreateManualSalePayload): CreateManualSalePayload {
  const customer = input.customer;
  const email = customer.email?.trim() || `${customer.firstName.trim().toLowerCase().replaceAll(/\s+/g, ".")}@offline.invalid`;
  return {
    ...input,
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email,
      ...(customer.phone ? { phone: customer.phone } : {}),
      ...(customer.dniOrCuil ? { dni: customer.dniOrCuil } : {}),
    },
  };
}

export function toPurchaseOrderPayload(input: CreatePurchaseOrderInput, source: SalesRepository["source"] = "mock"): CreatePurchaseOrderPayload {
  return {
    ...input,
    supplierId: input.supplierId?.trim() || (source === "api" ? "sales-crm-seed-supplier-nutrition" : "supplier-nutricion"),
    ...(input.products ? { products: input.products } : {}),
  };
}

export function optimisticSale(input: CreateManualSalePayload, id: string, sourceOrderId?: string): AdminSale {
  const products = input.products ?? (input.items ?? []).map((item) => ({
    productId: item.productId,
    ...(item.variantId ? { variantId: item.variantId } : {}),
    name: item.productName ?? item.name ?? item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
  const paymentStatus = input.paymentStatus === "received" || input.paymentStatus === "PAID" ? "received" : "pending";
  return {
    id,
    number: `#${id}`,
    createdAt: new Date().toISOString(),
    ...(input.source ? { source: input.source } : {}),
    ...(sourceOrderId ? { sourceOrderId } : {}),
    customer: { firstName: input.customer.firstName, lastName: input.customer.lastName, email: input.customer.email },
    ...(input.shippingAddress ? { shippingAddress: { ...input.shippingAddress } } : {}),
    products: products.map((product) => ({ ...product })),
    paymentStatus,
    shippingStatus: input.deliveryType === "PICKUP" ? "pickup" : "to_pack",
    subtotal: input.subtotal ?? products.reduce((sum, product) => sum + product.quantity * product.unitPrice, 0),
    ...(input.discountType ? { discountType: input.discountType } : {}),
    ...(input.discountValue === undefined ? {} : { discountValue: input.discountValue }),
    shippingCost: input.shippingCost ?? 0,
    total: input.total ?? 0,
    archived: false,
    ...(input.internalNotes ? { notes: input.internalNotes } : {}),
    history: [makeEvent("sale_created", sourceOrderId ? `Convertida desde orden ${sourceOrderId}.` : "Venta creada manualmente.")],
  };
}

export function optimisticPurchaseOrder(input: CreatePurchaseOrderInput, id: string): AdminPurchaseOrder {
  const products = input.products ?? (input.items ?? []).map((item) => ({
    productId: item.productId,
    ...(item.variantId ? { variantId: item.variantId } : {}),
    name: item.title ?? item.name ?? item.productId,
    quantity: item.quantity,
    unitPrice: item.unitCost ?? item.unitPrice ?? 0,
  }));
  return {
    id,
    createdAt: new Date().toISOString(),
    source: input.source,
    customer: input.customer ?? { firstName: "Supplier", lastName: "" },
    ...(input.shippingAddress ? { shippingAddress: { ...input.shippingAddress } } : {}),
    products: products.map((product) => ({ ...product })),
    status: "pending",
    subtotal: input.subtotal ?? products.reduce((sum, product) => sum + product.quantity * product.unitPrice, 0),
    ...(input.discountType ? { discountType: input.discountType } : {}),
    ...(input.discountValue === undefined ? {} : { discountValue: input.discountValue }),
    shippingCost: input.shippingCost ?? 0,
    total: input.total ?? 0,
    ...(input.notes === undefined || input.notes === null ? {} : { notes: input.notes }),
    history: [makeEvent("sale_created", "Orden de compra creada.")],
  };
}

export function withCancellationEvents(result: AdminSaleDetail, payload: CancelSalePayload, sendEmail?: boolean): AdminSaleDetail {
  const history = [...result.history];
  if (payload.restoreStock && !history.some((event) => event.type === "stock_restored")) history.push(makeEvent("stock_restored"));
  if (sendEmail !== undefined && !history.some((event) => event.type === "email_sent" || event.type === "email_failed")) {
    history.push(makeEvent(sendEmail ? "email_sent" : "email_failed", sendEmail ? "E-mail enviado al cliente." : "E-mail no enviado (simulación)."));
  }
  return { ...result, history };
}

export function withStockEvent(result: AdminSaleDetail, type: "stock_deducted" | "stock_reserved"): AdminSaleDetail {
  return result.history.some((event) => event.type === type) ? result : { ...result, history: [...result.history, makeEvent(type)] };
}

export function replaceSale(set: SalesStoreSetter, next: AdminSale): void {
  set((state) => ({ sales: state.sales.some((sale) => sale.id === next.id) ? state.sales.map((sale) => sale.id === next.id ? mergeSale(sale, next) : sale) : [...state.sales, cloneSale(next)] }));
}

export function replacePurchaseOrder(set: SalesStoreSetter, next: PurchaseOrder): void {
  set((state) => ({ purchaseOrders: state.purchaseOrders.some((order) => order.id === next.id) ? state.purchaseOrders.map((order) => order.id === next.id ? clonePurchaseOrder(next) : order) : [...state.purchaseOrders, clonePurchaseOrder(next)] }));
}

export function mergeSale(current: AdminSale | undefined, next: AdminSale): AdminSale {
  if (!current || next.products.length > 0) return cloneSale(next);
  return {
    ...cloneSale(current),
    ...cloneSale(next),
    ...(current.shippingAddress ? { shippingAddress: { ...current.shippingAddress } } : {}),
    ...(current.notes ? { notes: current.notes } : {}),
    products: current.products.map((product) => ({ ...product })),
    history: current.history.map((event) => ({ ...event })),
    subtotal: current.subtotal,
    shippingCost: current.shippingCost,
  };
}

export function cloneSale(sale: AdminSale): AdminSale {
  return {
    ...sale,
    customer: { ...sale.customer },
    ...(sale.shippingAddress ? { shippingAddress: { ...sale.shippingAddress } } : {}),
    products: sale.products.map((product) => ({ ...product })),
    history: sale.history.map((event) => ({ ...event })),
  };
}

export function clonePurchaseOrder(order: AdminPurchaseOrder): AdminPurchaseOrder {
  return {
    ...order,
    customer: { ...order.customer },
    ...(order.shippingAddress ? { shippingAddress: { ...order.shippingAddress } } : {}),
    products: order.products.map((product) => ({ ...product })),
    history: order.history.map((event) => ({ ...event })),
  };
}

export function makeEvent(type: SaleHistoryEvent["type"], note?: string): SaleHistoryEvent {
  return { id: generateEventId(), type, date: new Date().toISOString(), actor: "Admin", ...(note ? { note } : {}) };
}

export function addAdminToast(message: string, tone: "success" | "error" | "info" = "success"): void {
  if (typeof window !== "undefined") useAdminToastStore.getState().addToast(message, tone);
}

export function reportFailure(set: SalesStoreSetter, code: string, message: string): false {
  set({ error: { code, issues: [], message, status: 404 }, status: "error" });
  addAdminToast(message, "error");
  return false;
}

export function toSalesStoreError(error: unknown, fallbackCode = "SALES_OPERATION_FAILED"): SalesStoreError {
  const value = isRecord(error) ? error : {};
  const issues = Array.isArray(value.issues) ? value.issues.flatMap((issue) => {
    const item = issue as { code?: unknown; field?: unknown; message?: unknown };
    return typeof item.message === "string" ? [{ code: String(item.code ?? "INVALID_FIELD"), field: String(item.field ?? "request"), message: item.message }] : [];
  }) : [];
  return {
    code: typeof value.code === "string" ? value.code : fallbackCode,
    issues,
    message: typeof value.message === "string" && value.message.trim() ? value.message : "No se pudo completar la operación de ventas.",
    status: typeof value.status === "number" ? value.status : 500,
  };
}

export function canUseFallback(repository: SalesRepository, error: unknown): boolean {
  if (repository.source !== "api") return false;
  const value = isRecord(error) ? error : {};
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message : "";
  return code === "SALES_API_UNAVAILABLE" || value.status === 503 || /offline|network|fetch failed|unavailable/i.test(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
