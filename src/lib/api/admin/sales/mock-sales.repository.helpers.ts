import { SalesApiError } from "./client";
import {
  toCreateManualSalePayload,
  toPurchaseOrderQueryParams,
  toSalesQueryParams,
  toSupplierQueryParams,
} from "./sales-api.payloads";
import type {
  AdminSaleDetail,
  PurchaseOrder,
  PurchaseOrderFilterQuery,
  SalesFilterQuery,
  Supplier,
  SupplierFilterQuery,
} from "./sales.repository";
import { generateEventId } from "@/lib/data/admin/sales-flow/helpers";
import type {
  AdminPurchaseOrder,
  AdminSale,
  SaleAddress,
  SaleHistoryEvent,
  SalePaymentStatus,
} from "@/lib/data/admin/sales-flow/types";

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    code: "NUT-001",
    contactName: "Martina Díaz",
    createdAt: "2026-06-01T10:00:00.000Z",
    email: "ventas@nutricion.example.com",
    id: "supplier-nutricion",
    name: "Nutrición Mayorista",
    notes: "Supplier fixture for offline administration.",
    phone: "+54 11 4000-1000",
    status: "active",
    updatedAt: "2026-06-01T10:00:00.000Z",
  },
];

export function toMockSaleDetail(sale: AdminSale): AdminSaleDetail {
  const paymentStatus = sale.paymentStatus;
  const backendStatus = paymentStatus === "cancelled" || sale.shippingStatus === "cancelled" ? "CANCELLED" : "CONFIRMED";
  const discountAmount = sale.discountType === "percentage" && sale.discountValue
    ? Math.min(sale.subtotal, sale.subtotal * sale.discountValue / 100)
    : sale.discountValue ?? 0;
  const payment = {
    amount: sale.total,
    currency: "ARS",
    paymentMethodId: "manual",
    paymentMethodSnapshot: {},
    status: paymentStatus,
  } satisfies AdminSaleDetail["payment"];

  return {
    ...cloneBaseSale(sale),
    backendStatus,
    currency: "ARS",
    customerSnapshot: cloneSnapshot({ ...sale.customer }),
    deliverySnapshot: sale.shippingAddress ? cloneSnapshot({ ...sale.shippingAddress }) : {},
    deliveryType: sale.shippingStatus === "pickup" ? "pickup" : "shipping",
    discountAmount,
    discountSnapshot: {
      ...(sale.discountType ? { discountType: sale.discountType } : {}),
      ...(sale.discountValue === undefined ? {} : { discountValue: sale.discountValue }),
    },
    internalNotes: sale.notes,
    items: sale.products.map((product) => ({ ...product })),
    payment,
    status: backendStatus === "CANCELLED" ? "cancelled" : "confirmed",
    subtotal: sale.subtotal,
    updatedAt: sale.createdAt,
  };
}

export function toMockSaleSummary(sale: AdminSaleDetail): AdminSale {
  return {
    id: sale.id,
    number: sale.number,
    createdAt: sale.createdAt,
    customer: { ...sale.customer },
    itemCount: sale.products.reduce((count, product) => count + product.quantity, 0),
    products: [],
    paymentStatus: sale.paymentStatus,
    shippingStatus: sale.shippingStatus,
    subtotal: 0,
    shippingCost: 0,
    total: sale.total,
    archived: sale.archived,
    history: [],
    ...(sale.sourceOrderId ? { sourceOrderId: sale.sourceOrderId } : {}),
    ...(sale.trackingCode ? { trackingCode: sale.trackingCode } : {}),
  };
}

export function createSaleFromRequest(
  input: ReturnType<typeof toCreateManualSalePayload>,
  id: string,
  sourceOrderId?: string,
): AdminSaleDetail {
  const paymentStatus = toUiPaymentStatus(input.paymentStatus);
  const products = input.items.map((item) => ({
    productId: item.productId,
    ...(item.variantId ? { variantId: item.variantId } : {}),
    name: item.productName ?? item.name ?? item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
  const shippingAddress = input.shippingAddress ? toUiAddress(input.shippingAddress) : undefined;
  const discount = discountFromSnapshot(input.discountSnapshot, input.discountAmount);
  const createdAt = now();
  const sale: AdminSaleDetail = {
    id,
    number: `#${id}`,
    createdAt,
    ...(input.source ? { source: input.source } : {}),
    ...(sourceOrderId ? { sourceOrderId } : {}),
    customer: {
      ...(input.customer.dni ? { dniOrCuil: input.customer.dni } : {}),
      email: input.customer.email,
      firstName: input.customer.firstName,
      lastName: input.customer.lastName,
      ...(input.customer.phone ? { phone: input.customer.phone } : {}),
    },
    ...(shippingAddress ? { shippingAddress } : {}),
    products,
    paymentStatus,
    shippingStatus: input.deliveryType === "PICKUP" ? "pickup" : "to_pack",
    subtotal: input.subtotal,
    ...(discount.type ? { discountType: discount.type } : {}),
    ...(discount.value === undefined ? {} : { discountValue: discount.value }),
    shippingCost: input.shippingCost,
    total: input.total,
    archived: false,
    ...(input.internalNotes ? { notes: input.internalNotes } : {}),
    history: [makeEvent("sale_created", sourceOrderId ? `Sale created from order ${sourceOrderId}.` : "Manual sale created."), makeEvent(paymentStatus === "received" ? "stock_deducted" : "stock_reserved")],
    backendStatus: "CONFIRMED",
    currency: input.currency,
    customerSnapshot: cloneSnapshot(input.customer),
    deliverySnapshot: cloneSnapshot(input.deliverySnapshot),
    deliveryType: input.deliveryType === "PICKUP" ? "pickup" : "shipping",
    discountAmount: input.discountAmount,
    discountSnapshot: cloneSnapshot(input.discountSnapshot),
    internalNotes: input.internalNotes,
    items: products.map((product) => ({ ...product })),
    payment: {
      amount: input.total,
      currency: input.currency,
      paymentMethodId: input.paymentMethodId,
      paymentMethodSnapshot: cloneSnapshot(input.paymentMethodSnapshot),
      ...(input.paymentOptionId ? { paymentOptionId: input.paymentOptionId } : {}),
      status: paymentStatus,
    },
    status: "confirmed",
    updatedAt: createdAt,
  };
  return sale;
}

export function createSaleFromOrder(order: PurchaseOrder, id: string): AdminSaleDetail {
  return createSaleFromRequest(toCreateManualSalePayload({
    customer: { ...order.customer, email: order.customer.email ?? `${order.id}@offline.invalid` },
    products: order.products,
    shippingAddress: order.shippingAddress,
    shippingCost: order.shippingCost,
    source: order.source,
    subtotal: order.subtotal,
    total: order.total,
  }), id, order.id);
}

export function toMockPurchaseOrder(order: AdminPurchaseOrder): PurchaseOrder {
  const backendStatus = order.status === "converted" ? "RECEIVED" : order.status === "cancelled" ? "CANCELLED" : "DRAFT";
  return {
    ...clonePurchaseOrderBase(order),
    backendStatus,
    orderNumber: order.id,
  };
}

export function cloneSale(sale: AdminSaleDetail): AdminSaleDetail {
  return {
    ...sale,
    ...cloneBaseSale(sale),
    customerSnapshot: cloneSnapshot(sale.customerSnapshot),
    deliverySnapshot: cloneSnapshot(sale.deliverySnapshot),
    discountSnapshot: cloneSnapshot(sale.discountSnapshot),
    items: sale.items.map((item) => ({ ...item })),
    payment: sale.payment ? {
      ...sale.payment,
      ...(sale.payment.bankTransferSnapshot ? { bankTransferSnapshot: cloneSnapshot(sale.payment.bankTransferSnapshot) } : {}),
      paymentMethodSnapshot: cloneSnapshot(sale.payment.paymentMethodSnapshot),
    } : null,
  };
}

export function clonePurchaseOrder(order: PurchaseOrder): PurchaseOrder {
  return {
    ...order,
    ...clonePurchaseOrderBase(order),
    ...(order.supplier ? { supplier: cloneSupplier(order.supplier) } : {}),
    products: order.products.map((product) => ({ ...product })),
    history: order.history.map((event) => ({ ...event })),
  };
}

export function cloneSupplier(supplier: Supplier): Supplier {
  return { ...supplier };
}

export function parseSalesQuery(query: SalesFilterQuery): SalesFilterQuery {
  toSalesQueryParams(query);
  return { ...query, page: query.page ?? 1, limit: query.limit ?? 20 };
}

export function parseSupplierQuery(query: SupplierFilterQuery): SupplierFilterQuery {
  toSupplierQueryParams(query);
  return { ...query, page: query.page ?? 1, limit: query.limit ?? 20 };
}

export function parsePurchaseOrderQuery(query: PurchaseOrderFilterQuery): PurchaseOrderFilterQuery {
  toPurchaseOrderQueryParams(query);
  return { ...query, page: query.page ?? 1, limit: query.limit ?? 20 };
}

export function matchesSale(sale: AdminSaleDetail, query: SalesFilterQuery): boolean {
  const haystack = [sale.number, sale.source, sale.customer.firstName, sale.customer.lastName, sale.customer.email, ...sale.products.map((product) => product.name)].filter(Boolean).join(" ").toLowerCase();
  const from = query.dateRange?.from ?? query.dateFrom;
  const to = query.dateRange?.to ?? query.dateTo;
  const created = new Date(sale.createdAt).getTime();
  return (query.search === undefined || haystack.includes(query.search.trim().toLowerCase()))
    && (query.status === undefined || sale.status === query.status)
    && (query.paymentStatus === undefined || sale.paymentStatus === query.paymentStatus)
    && (query.shippingStatus === undefined || sale.shippingStatus === query.shippingStatus)
    && (query.isArchived === undefined || sale.archived === query.isArchived)
    && (from === undefined || created >= new Date(from).getTime())
    && (to === undefined || created <= new Date(to).getTime());
}

export function compareSales(left: AdminSaleDetail, right: AdminSaleDetail, query: SalesFilterQuery): number {
  const sortBy = query.sortBy ?? "createdAt";
  return compareValues(saleSortValue(left, sortBy), saleSortValue(right, sortBy), query.sortOrder)
    || compareValues(left.id, right.id, query.sortOrder);
}

export function matchesSupplier(supplier: Supplier, query: SupplierFilterQuery): boolean {
  const haystack = [supplier.name, supplier.code, supplier.contactName, supplier.email].filter(Boolean).join(" ").toLowerCase();
  return (query.search === undefined || haystack.includes(query.search.trim().toLowerCase()))
    && (query.status === undefined || supplier.status === query.status);
}

export function matchesPurchaseOrder(order: PurchaseOrder, query: PurchaseOrderFilterQuery): boolean {
  const haystack = [order.id, order.orderNumber, order.source, order.supplier?.name, ...order.products.map((product) => product.name)].filter(Boolean).join(" ").toLowerCase();
  return (query.search === undefined || haystack.includes(query.search.trim().toLowerCase()))
    && (query.status === undefined || backendStatus(order).toLowerCase() === query.status)
    && (query.supplierId === undefined || order.supplierId === query.supplierId);
}

export function compareValues(left: unknown, right: unknown, order: "asc" | "desc" | undefined): number {
  const leftValue = typeof left === "number" ? left : String(left ?? "").toLowerCase();
  const rightValue = typeof right === "number" ? right : String(right ?? "").toLowerCase();
  const comparison = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
  return order === "asc" ? comparison : -comparison;
}

export function supplierSortValue(supplier: Supplier, sortBy: SupplierFilterQuery["sortBy"]): unknown {
  if (sortBy === "code") return supplier.code;
  if (sortBy === "status") return supplier.status;
  if (sortBy === "createdAt") return supplier.createdAt;
  if (sortBy === "updatedAt") return supplier.updatedAt;
  return supplier.name;
}

export function purchaseOrderSortValue(order: PurchaseOrder, sortBy: PurchaseOrderFilterQuery["sortBy"]): unknown {
  if (sortBy === "expectedDate") return order.expectedDate;
  if (sortBy === "orderNumber") return order.orderNumber;
  if (sortBy === "status") return order.backendStatus;
  if (sortBy === "total") return order.total;
  if (sortBy === "updatedAt") return order.updatedAt;
  return order.createdAt;
}

export function backendStatus(order: PurchaseOrder): "CANCELLED" | "DRAFT" | "ORDERED" | "RECEIVED" {
  if (order.backendStatus) return order.backendStatus;
  return order.status === "converted" ? "RECEIVED" : order.status === "cancelled" ? "CANCELLED" : "DRAFT";
}

export function makeEvent(type: SaleHistoryEvent["type"], note?: string): SaleHistoryEvent {
  return { id: generateEventId(), type, date: now(), actor: "Admin", ...(note ? { note } : {}) };
}

export function notFoundError(resource: string): SalesApiError {
  return new SalesApiError({ code: "NOT_FOUND", message: `The requested ${resource} was not found.`, status: 404 });
}

export function conflictError(message: string): SalesApiError {
  return new SalesApiError({ code: "CONFLICT", message, status: 409 });
}

function cloneBaseSale(sale: AdminSale): AdminSale {
  return {
    ...sale,
    customer: { ...sale.customer },
    ...(sale.shippingAddress ? { shippingAddress: { ...sale.shippingAddress } } : {}),
    products: sale.products.map((product) => ({ ...product })),
    history: sale.history.map((event) => ({ ...event })),
  };
}

function clonePurchaseOrderBase(order: AdminPurchaseOrder): AdminPurchaseOrder {
  return {
    ...order,
    customer: { ...order.customer },
    ...(order.shippingAddress ? { shippingAddress: { ...order.shippingAddress } } : {}),
    products: order.products.map((product) => ({ ...product })),
    history: order.history.map((event) => ({ ...event })),
  };
}

function discountFromSnapshot(snapshot: Record<string, unknown>, amount: number): { type?: "fixed" | "percentage"; value?: number } {
  const rawType = snapshot.discountType ?? snapshot.type;
  const type = rawType === "percentage" || rawType === "fixed" ? rawType : amount > 0 ? "fixed" : undefined;
  const rawValue = snapshot.discountValue ?? snapshot.value;
  const value = typeof rawValue === "number" ? rawValue : type ? amount : undefined;
  return { ...(type ? { type } : {}), ...(value === undefined ? {} : { value }) };
}

function saleSortValue(sale: AdminSaleDetail, sortBy: SalesFilterQuery["sortBy"]): unknown {
  if (sortBy === "customerName") return `${sale.customer.lastName} ${sale.customer.firstName}`;
  if (sortBy === "total") return sale.total;
  if (sortBy === "number") return sale.number;
  if (sortBy === "updatedAt") return sale.updatedAt;
  return sale.createdAt;
}

function toUiPaymentStatus(status: "PAID" | "PENDING" | "REFUNDED"): SalePaymentStatus {
  return status === "PAID" ? "received" : status === "REFUNDED" ? "refunded" : "pending";
}

function toUiAddress(value: Record<string, unknown>): SaleAddress {
  return {
    street: textValue(value.street),
    number: textValue(value.number),
    ...(textValue(value.floor) ? { floor: textValue(value.floor) } : {}),
    ...(textValue(value.unit) ? { unit: textValue(value.unit) } : {}),
    city: textValue(value.city),
    province: textValue(value.province),
    postalCode: textValue(value.postalCode),
    country: textValue(value.country) || "Argentina",
    ...(textValue(value.notes) ? { notes: textValue(value.notes) } : {}),
  };
}

function cloneSnapshot(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") return cloneSnapshot(value as Record<string, unknown>);
  return value;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function now(): string {
  return new Date().toISOString();
}
