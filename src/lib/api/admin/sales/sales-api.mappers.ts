import { z } from "zod";

import { SalesApiError } from "./client";
import {
  API_HISTORY_EVENT_TYPE,
  API_PAYMENT_STATUS,
  type AdminSaleDetailResponseDto,
  type AdminSaleSummaryResponseDto,
  adminSaleDetailResponseSchema,
  adminSaleListResponseSchema,
  adminSaleSummaryResponseSchema,
  purchaseOrderListResponseSchema,
  purchaseOrderResponseSchema,
  supplierListResponseSchema,
  supplierResponseSchema,
  type PurchaseOrderResponseDto,
  type SupplierResponseDto,
} from "./sales-api.schemas";
import {
  BACKEND_SALE_STATUS,
  PURCHASE_ORDER_BACKEND_STATUS,
  SALE_DELIVERY_TYPE,
  SALE_ORDER_STATUS,
  SUPPLIER_STATUS,
  type AdminSaleDetail,
  type PaginatedSalesResult,
  type PurchaseOrder,
  type Supplier,
} from "./sales.repository";
import type {
  AdminSale,
  SaleAddress,
  SaleHistoryEvent,
  SalePaymentStatus,
  SaleProduct,
  SaleShippingStatus,
} from "@/lib/data/admin/sales-flow/types";

export function mapSalesListResponse(response: unknown): PaginatedSalesResult {
  const parsed = parseResponse(response, adminSaleListResponseSchema);
  return {
    items: parsed.items.map(mapAdminSaleSummary),
    limit: parsed.limit,
    page: parsed.page,
    total: parsed.total,
  };
}

export function mapAdminSaleSummary(response: unknown): AdminSale;
export function mapAdminSaleSummary(response: AdminSaleSummaryResponseDto): AdminSale;
export function mapAdminSaleSummary(response: unknown): AdminSale {
  const parsed = parseResponse(response, adminSaleSummaryResponseSchema);
  return mapParsedSaleSummary(parsed);
}

export function mapAdminSaleDetail(response: unknown): AdminSaleDetail {
  const parsed = parseResponse(response, adminSaleDetailResponseSchema);
  const summary = mapParsedSaleSummary(parsed);
  const discount = mapDiscount(parsed.discountSnapshot, parsed.discountAmount);

  return {
    ...summary,
    backendStatus: toBackendSaleStatus(parsed.status),
    confirmedAt: parsed.confirmedAt,
    currency: parsed.currency,
    customerSnapshot: cloneSnapshot(parsed.customerSnapshot),
    deliveredAt: parsed.deliveredAt,
    deliverySnapshot: cloneSnapshot(parsed.deliverySnapshot),
    deliveryType: parsed.deliveryType === "PICKUP" ? SALE_DELIVERY_TYPE.PICKUP : SALE_DELIVERY_TYPE.SHIPPING,
    discountAmount: parsed.discountAmount,
    discountSnapshot: cloneSnapshot(parsed.discountSnapshot),
    ...(discount.type ? { discountType: discount.type } : {}),
    ...(discount.value === undefined ? {} : { discountValue: discount.value }),
    history: parsed.history.map(mapHistoryEvent),
    ...(parsed.internalNotes ? { notes: parsed.internalNotes } : {}),
    items: parsed.items.map(mapSaleItem),
    packedAt: parsed.packedAt,
    payment: parsed.payment ? mapPayment(parsed.payment) : null,
    previousPaymentStatus: parsed.previousPaymentStatus
      ? toPaymentStatus(parsed.previousPaymentStatus)
      : undefined,
    previousShippingStatus: parsed.previousShippingStatus
      ? toShippingStatus(parsed.previousShippingStatus)
      : undefined,
    shippingAddress: parsed.shippingAddress ? mapAddress(parsed.shippingAddress) : undefined,
    shippingCarrier: parsed.shippingCarrier,
    shippingCost: parsed.shippingCost,
    shippingTrackingUrl: parsed.shippingTrackingUrl,
    shippedAt: parsed.shippedAt,
    subtotal: parsed.subtotal,
    status: toSaleStatus(parsed.status),
    updatedAt: parsed.updatedAt,
  };
}

export function mapSupplierResponse(response: unknown): Supplier {
  return mapSupplier(parseResponse(response, supplierResponseSchema));
}

export function mapSuppliersListResponse(response: unknown): Supplier[] {
  const parsed = parseResponse(response, supplierListResponseSchema);
  return parsed.items.map(mapSupplier);
}

export function mapPurchaseOrderResponse(response: unknown): PurchaseOrder {
  return mapPurchaseOrder(parseResponse(response, purchaseOrderResponseSchema));
}

export function mapPurchaseOrdersListResponse(response: unknown): PurchaseOrder[] {
  const parsed = parseResponse(response, purchaseOrderListResponseSchema);
  return parsed.items.map(mapPurchaseOrder);
}

export const mapSaleSummary = mapAdminSaleSummary;
export const mapSaleDetail = mapAdminSaleDetail;
export const mapSupplier = (response: SupplierResponseDto): Supplier => ({
  code: response.code,
  ...(response.contactName === null ? {} : { contactName: response.contactName }),
  createdAt: response.createdAt,
  ...(response.email === null ? {} : { email: response.email }),
  id: response.id,
  name: response.name,
  ...(response.notes === null ? {} : { notes: response.notes }),
  ...(response.phone === null ? {} : { phone: response.phone }),
  status: response.status === "ACTIVE" ? SUPPLIER_STATUS.ACTIVE : SUPPLIER_STATUS.INACTIVE,
  updatedAt: response.updatedAt,
});

export const mapPurchaseOrder = (response: PurchaseOrderResponseDto): PurchaseOrder => {
  const backendStatus = response.status;
  const status = backendStatus === PURCHASE_ORDER_BACKEND_STATUS.CANCELLED
    ? "cancelled"
    : backendStatus === PURCHASE_ORDER_BACKEND_STATUS.RECEIVED ? "converted" : "pending";
  const customer = {
    firstName: response.supplier.name,
    lastName: "",
    ...(response.supplier.email ? { email: response.supplier.email } : {}),
    ...(response.supplier.phone ? { phone: response.supplier.phone } : {}),
  };

  return {
    id: response.id,
    createdAt: response.createdAt,
    source: response.supplier.name,
    customer,
    products: response.items.map((item) => ({
      productId: item.productId,
      ...(item.variantId ? { variantId: item.variantId } : {}),
      name: item.title,
      quantity: item.quantity,
      unitPrice: item.unitCost,
    })),
    status,
    subtotal: response.subtotal,
    shippingCost: response.shippingCost,
    total: response.total,
    ...(response.notes === null ? {} : { notes: response.notes }),
    history: [],
    supplier: mapSupplier(response.supplier),
    supplierId: response.supplierId,
    orderNumber: response.orderNumber,
    backendStatus,
    ...(response.expectedDate === null ? {} : { expectedDate: response.expectedDate }),
    ...(response.receivedAt === null ? {} : { receivedAt: response.receivedAt }),
    tax: response.tax,
    updatedAt: response.updatedAt,
  };
};

export function unwrapSalesResponse(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.ok === false) throw invalidResponse();
  return value.ok === true && "data" in value ? value.data : value;
}

function mapCustomer(customer: AdminSaleSummaryResponseDto["customer"]) {
  return {
    ...(customer.dni ? { dniOrCuil: customer.dni } : {}),
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    ...(customer.phone ? { phone: customer.phone } : {}),
  };
}

function mapParsedSaleSummary(parsed: AdminSaleSummaryResponseDto): AdminSale {
  const saleStatus = toSaleStatus(parsed.status);
  return {
    id: parsed.id,
    number: parsed.number,
    createdAt: parsed.createdAt,
    ...(parsed.sourceOrderId ? { sourceOrderId: parsed.sourceOrderId } : {}),
    customer: mapCustomer(parsed.customer),
    itemCount: parsed.itemCount,
    products: [],
    paymentStatus: toPaymentStatus(parsed.paymentStatus, saleStatus),
    shippingStatus: toShippingStatus(parsed.shippingStatus),
    subtotal: 0,
    shippingCost: 0,
    total: parsed.total,
    archived: parsed.isArchived,
    ...(parsed.trackingCode ? { trackingCode: parsed.trackingCode } : {}),
    history: [],
  };
}

function mapSaleItem(item: AdminSaleDetailResponseDto["items"][number]): SaleProduct {
  return {
    productId: item.productId,
    ...(item.variantId ? { variantId: item.variantId } : {}),
    name: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  };
}

function mapPayment(payment: NonNullable<AdminSaleDetailResponseDto["payment"]>) {
  return {
    amount: payment.amount,
    ...(payment.bankTransferSnapshot ? { bankTransferSnapshot: cloneSnapshot(payment.bankTransferSnapshot) } : {}),
    currency: payment.currency,
    paymentMethodId: payment.paymentMethodId,
    paymentMethodSnapshot: cloneSnapshot(payment.paymentMethodSnapshot),
    ...(payment.paymentOptionId ? { paymentOptionId: payment.paymentOptionId } : {}),
    status: toPaymentStatus(payment.status),
  };
}

function mapHistoryEvent(event: AdminSaleDetailResponseDto["history"][number]): SaleHistoryEvent {
  const type = historyType(event.type);
  return {
    id: event.id,
    type,
    date: event.createdAt,
    actor: event.actorRole === "ADMIN" ? "Admin" : event.actorRole === "CUSTOMER" ? "Customer" : event.actorId ?? "System",
    ...(event.description ? { note: event.description } : {}),
  };
}

function historyType(type: (typeof API_HISTORY_EVENT_TYPE)[number]): SaleHistoryEvent["type"] {
  const mapped: Record<(typeof API_HISTORY_EVENT_TYPE)[number], SaleHistoryEvent["type"]> = {
    NOTE_ADDED: "sale_updated",
    ORDER_ARCHIVED: "sale_archived",
    ORDER_CANCELLED: "sale_cancelled",
    ORDER_CONVERTED: "order_converted",
    ORDER_CREATED: "sale_created",
    ORDER_REOPENED: "sale_reopened",
    ORDER_UNARCHIVED: "sale_updated",
    PACKAGE_DELIVERED: "sale_updated",
    PACKAGE_PACKED: "package_packed",
    PACKAGE_SHIPPED: "package_shipped",
    PACKAGE_UNPACKED: "package_unpacked",
    PAYMENT_RECEIVED: "payment_received",
  };
  return mapped[type];
}

function mapAddress(snapshot: Record<string, unknown>): SaleAddress {
  return {
    street: stringValue(snapshot.street),
    number: stringValue(snapshot.number),
    ...(stringValue(snapshot.floor) ? { floor: stringValue(snapshot.floor) } : {}),
    ...(stringValue(snapshot.unit) ? { unit: stringValue(snapshot.unit) } : {}),
    city: stringValue(snapshot.city),
    province: stringValue(snapshot.province),
    postalCode: stringValue(snapshot.postalCode),
    country: stringValue(snapshot.country) || "Argentina",
    ...(stringValue(snapshot.notes) ? { notes: stringValue(snapshot.notes) } : {}),
  };
}

function mapDiscount(snapshot: Record<string, unknown>, amount: number): { type?: "fixed" | "percentage"; value?: number } {
  const rawType = snapshot.discountType ?? snapshot.type;
  const type = rawType === "percentage" || rawType === "fixed" ? rawType : amount > 0 ? "fixed" : undefined;
  const rawValue = snapshot.discountValue ?? snapshot.value;
  const value = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : type ? amount : undefined;
  return { ...(type ? { type } : {}), ...(value === undefined ? {} : { value }) };
}

function toSaleStatus(status: AdminSaleSummaryResponseDto["status"]): "pending" | "confirmed" | "cancelled" {
  return status === "PENDING" ? SALE_ORDER_STATUS.PENDING : status === "CANCELLED" ? SALE_ORDER_STATUS.CANCELLED : SALE_ORDER_STATUS.CONFIRMED;
}

function toBackendSaleStatus(status: AdminSaleSummaryResponseDto["status"]): "PENDING" | "CONFIRMED" | "CANCELLED" {
  return status === "PENDING" ? BACKEND_SALE_STATUS.PENDING : status === "CANCELLED" ? BACKEND_SALE_STATUS.CANCELLED : BACKEND_SALE_STATUS.CONFIRMED;
}

function toPaymentStatus(
  status: (typeof API_PAYMENT_STATUS)[number] | null,
  saleStatus?: "pending" | "confirmed" | "cancelled",
): SalePaymentStatus {
  if (saleStatus === SALE_ORDER_STATUS.CANCELLED) return "cancelled";
  if (status === "PAID") return "received";
  if (status === "REFUNDED") return "refunded";
  return "pending";
}

function toShippingStatus(status: AdminSaleSummaryResponseDto["shippingStatus"]): SaleShippingStatus {
  return status.toLowerCase() as SaleShippingStatus;
}

function parseResponse<T>(value: unknown, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(unwrapSalesResponse(value));
  if (parsed.success) return parsed.data;
  throw invalidResponse(parsed.error);
}

function invalidResponse(error?: z.ZodError): SalesApiError {
  return new SalesApiError({
    code: "SALES_API_INVALID_RESPONSE",
    issues: error?.issues.map((issue) => ({
      code: "INVALID_RESPONSE",
      field: issue.path.length ? issue.path.map(String).join(".") : "response",
      message: issue.message,
    })),
    message: "The sales API returned an invalid response.",
    status: 502,
  });
}

function cloneSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(snapshot).map(([key, value]) => [key, cloneValue(value)]));
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isRecord(value)) return cloneSnapshot(value);
  return value;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
