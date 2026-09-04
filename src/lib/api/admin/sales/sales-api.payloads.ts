import { z } from "zod";

import { SalesApiError } from "./client";
import {
  addSaleNoteRequestSchema,
  cancelSaleRequestSchema,
  convertOrderToSaleRequestSchema,
  createManualSaleRequestSchema,
  createPurchaseOrderRequestSchema,
  createSupplierRequestSchema,
  purchaseOrderFilterQuerySchema,
  salesFilterQuerySchema,
  shipSaleRequestSchema,
  supplierFilterQuerySchema,
  supplierStatusRequestSchema,
  updatePurchaseOrderRequestSchema,
  updateSupplierRequestSchema,
  type AddSaleNoteRequestDto,
  type CancelSaleRequestDto,
  type ConvertOrderToSaleRequestDto,
  type CreateManualSaleRequestDto,
  type CreatePurchaseOrderRequestDto,
  type CreateSupplierRequestDto,
  type UpdatePurchaseOrderRequestDto,
  type UpdateSupplierRequestDto,
  type ShipSaleRequestDto,
  type SupplierStatusRequestDto,
} from "./sales-api.schemas";
import {
  PURCHASE_ORDER_BACKEND_STATUS,
  SALE_DELIVERY_TYPE,
  SALE_ORDER_STATUS,
  SUPPLIER_STATUS,
  type CreateManualSalePayload,
  type CreatePurchaseOrderPayload,
  type CreateSupplierPayload,
  type ConvertOrderToSalePayload,
  type SalesFilterQuery,
  type ShipSalePayload,
  type CancelSalePayload,
  type PurchaseOrderFilterQuery,
  type PurchaseOrderItemPayload,
  type SupplierFilterQuery,
  type SupplierStatus,
  type UpdateSupplierPayload,
} from "./sales.repository";

export function toCreateManualSalePayload(input: CreateManualSalePayload): CreateManualSaleRequestDto {
  const items = saleItems(input);
  const discountAmount = input.discountAmount ?? calculateDiscount(input.subtotal ?? subtotal(items), input.discountType, input.discountValue);
  const subtotalValue = input.subtotal ?? subtotal(items);
  const shippingCost = input.shippingCost ?? 0;
  const total = input.total ?? Math.max(0, subtotalValue - discountAmount + shippingCost);
  const payload = {
    currency: input.currency?.trim() || "ARS",
    customer: {
      ...(input.customer.dni ?? input.customer.dniOrCuil
        ? { dni: (input.customer.dni ?? input.customer.dniOrCuil)!.trim() }
        : {}),
      email: input.customer.email.trim().toLowerCase(),
      firstName: input.customer.firstName.trim(),
      lastName: input.customer.lastName.trim(),
      ...(input.customer.phone ? { phone: input.customer.phone.trim() } : {}),
    },
    deliverySnapshot: input.deliverySnapshot ? { ...input.deliverySnapshot } : input.shippingAddress ? { ...input.shippingAddress } : {},
    deliveryType: toApiDeliveryType(input.deliveryType),
    discountAmount,
    discountSnapshot: input.discountSnapshot
      ? { ...input.discountSnapshot }
      : buildDiscountSnapshot(input.discountType, input.discountValue, discountAmount),
    ...(input.internalNotes === undefined ? {} : { internalNotes: input.internalNotes.trim() }),
    items: items.map(toSaleItemPayload),
    paymentMethodId: input.paymentMethodId?.trim() || "manual",
    paymentMethodSnapshot: input.paymentMethodSnapshot ? { ...input.paymentMethodSnapshot } : {},
    ...(input.paymentOptionId ? { paymentOptionId: input.paymentOptionId.trim() } : {}),
    paymentStatus: toApiManualPaymentStatus(input.paymentStatus),
    ...(input.shippingAddress ? { shippingAddress: { ...input.shippingAddress } } : {}),
    shippingCost,
    ...(input.source ? { source: input.source.trim() } : {}),
    subtotal: subtotalValue,
    total,
  };

  return parsePayload(createManualSaleRequestSchema, payload, "The manual sale payload is invalid.");
}

export function toConvertOrderToSalePayload(input: ConvertOrderToSalePayload): ConvertOrderToSaleRequestDto {
  const payload = {
    ...(input.orderId?.trim() ? { orderId: input.orderId.trim() } : {}),
    ...(input.sourceOrderId?.trim() ? { sourceOrderId: input.sourceOrderId.trim() } : {}),
  };

  return parsePayload(convertOrderToSaleRequestSchema, payload, "The order conversion payload is invalid.");
}

export function toShipSalePayload(input: ShipSalePayload): ShipSaleRequestDto {
  return parsePayload(shipSaleRequestSchema, {
    carrier: input.carrier.trim(),
    trackingCode: input.trackingCode.trim(),
    ...(input.trackingUrl?.trim() ? { trackingUrl: input.trackingUrl.trim() } : {}),
  }, "The shipping payload is invalid.");
}

export function toCancelSalePayload(input: CancelSalePayload): CancelSaleRequestDto {
  return parsePayload(cancelSaleRequestSchema, {
    cancellationReason: input.cancellationReason.trim(),
    restoreStock: input.restoreStock,
  }, "The cancellation payload is invalid.");
}

export function toAddSaleNotePayload(note: string): AddSaleNoteRequestDto {
  return parsePayload(addSaleNoteRequestSchema, { note: note.trim() }, "The sale note is invalid.");
}

export function toCreateSupplierPayload(input: CreateSupplierPayload): CreateSupplierRequestDto {
  const payload = {
    code: input.code.trim().toUpperCase(),
    ...(input.contactName === undefined ? {} : { contactName: normalizeNullableText(input.contactName) }),
    ...(input.email === undefined ? {} : { email: normalizeNullableText(input.email)?.toLowerCase() ?? null }),
    name: input.name.trim(),
    ...(input.notes === undefined ? {} : { notes: normalizeNullableText(input.notes) }),
    ...(input.phone === undefined ? {} : { phone: normalizeNullableText(input.phone) }),
    status: toApiSupplierStatus(input.status),
  };

  return parsePayload(createSupplierRequestSchema, payload, "The supplier payload is invalid.");
}

export function toUpdateSupplierPayload(input: UpdateSupplierPayload): UpdateSupplierRequestDto {
  const payload = {
    ...(input.code === undefined ? {} : { code: input.code.trim().toUpperCase() }),
    ...(input.contactName === undefined ? {} : { contactName: normalizeNullableText(input.contactName) }),
    ...(input.email === undefined ? {} : { email: normalizeNullableText(input.email)?.toLowerCase() ?? null }),
    ...(input.name === undefined ? {} : { name: input.name.trim() }),
    ...(input.notes === undefined ? {} : { notes: normalizeNullableText(input.notes) }),
    ...(input.phone === undefined ? {} : { phone: normalizeNullableText(input.phone) }),
    ...(input.status === undefined ? {} : { status: toApiSupplierStatus(input.status) }),
  };

  return parsePayload(updateSupplierRequestSchema, payload, "The supplier update payload is invalid.");
}

export function toSupplierStatusPayload(status: SupplierStatus): SupplierStatusRequestDto {
  return parsePayload(supplierStatusRequestSchema, { status: toApiSupplierStatus(status) }, "The supplier status is invalid.");
}

export function toCreatePurchaseOrderPayload(input: CreatePurchaseOrderPayload): CreatePurchaseOrderRequestDto {
  const items = purchaseOrderItems(input);
  const subtotalValue = input.subtotal ?? items.reduce((sum, item) => sum + itemTotal(item), 0);
  const tax = input.tax ?? 0;
  const shippingCost = input.shippingCost ?? 0;
  const payload = {
    ...(input.expectedDate === undefined ? {} : { expectedDate: normalizeNullableDate(input.expectedDate) }),
    items: items.map(toPurchaseOrderItemPayload),
    ...(input.notes === undefined ? {} : { notes: input.notes === null ? null : input.notes.trim() }),
    ...(input.orderNumber?.trim() ? { orderNumber: input.orderNumber.trim() } : {}),
    shippingCost,
    subtotal: subtotalValue,
    supplierId: input.supplierId.trim(),
    tax,
    total: input.total ?? subtotalValue + tax + shippingCost,
  };

  return parsePayload(createPurchaseOrderRequestSchema, payload, "The purchase-order payload is invalid.");
}

export function toUpdatePurchaseOrderPayload(input: Partial<CreatePurchaseOrderPayload>): UpdatePurchaseOrderRequestDto {
  const payload = {
    ...(input.expectedDate === undefined ? {} : { expectedDate: normalizeNullableDate(input.expectedDate) }),
    ...(input.items || input.products ? { items: purchaseOrderItems(input).map(toPurchaseOrderItemPayload) } : {}),
    ...(input.notes === undefined ? {} : { notes: input.notes === null ? null : input.notes.trim() }),
    ...(input.orderNumber === undefined ? {} : { orderNumber: input.orderNumber.trim() }),
    ...(input.shippingCost === undefined ? {} : { shippingCost: input.shippingCost }),
    ...(input.subtotal === undefined ? {} : { subtotal: input.subtotal }),
    ...(input.supplierId === undefined ? {} : { supplierId: input.supplierId.trim() }),
    ...(input.tax === undefined ? {} : { tax: input.tax }),
    ...(input.total === undefined ? {} : { total: input.total }),
  };

  return parsePayload(updatePurchaseOrderRequestSchema, payload, "The purchase-order update payload is invalid.");
}

export function toSalesQueryParams(input: SalesFilterQuery = {}): URLSearchParams {
  const query = parseQuery(salesFilterQuerySchema, normalizeSalesQuery(input), "The sales filter is invalid.");
  const params = new URLSearchParams();

  appendNumber(params, "limit", input.limit);
  appendNumber(params, "page", input.page);
  appendString(params, "search", query.search);
  appendString(params, "status", toApiSaleStatus(query.status));
  appendString(params, "paymentStatus", toApiPaymentStatus(query.paymentStatus));
  appendString(params, "shippingStatus", toApiShippingStatus(query.shippingStatus));
  appendBoolean(params, "isArchived", query.isArchived);
  appendString(params, "sortBy", input.sortBy === undefined ? undefined : query.sortBy);
  appendString(params, "sortOrder", input.sortOrder === undefined ? undefined : query.sortOrder);
  if (query.dateRange) {
    appendString(params, "dateRange.from", query.dateRange.from.toISOString());
    appendString(params, "dateRange.to", query.dateRange.to.toISOString());
  }

  if (input.paymentStatus === "cancelled" && !input.status) {
    params.set("status", SALE_ORDER_STATUS.CANCELLED);
    params.delete("paymentStatus");
  }

  return params;
}

export function toSupplierQueryParams(input: SupplierFilterQuery = {}): URLSearchParams {
  const query = parseQuery(supplierFilterQuerySchema, input, "The supplier filter is invalid.");
  const params = new URLSearchParams();
  appendNumber(params, "limit", input.limit);
  appendNumber(params, "page", input.page);
  appendString(params, "search", query.search);
  appendString(params, "sortBy", input.sortBy === undefined ? undefined : query.sortBy);
  appendString(params, "sortOrder", input.sortOrder === undefined ? undefined : query.sortOrder);
  appendString(params, "status", toApiSupplierStatus(query.status));
  return params;
}

export function toPurchaseOrderQueryParams(input: PurchaseOrderFilterQuery = {}): URLSearchParams {
  const query = parseQuery(purchaseOrderFilterQuerySchema, input, "The purchase-order filter is invalid.");
  const params = new URLSearchParams();
  appendNumber(params, "limit", input.limit);
  appendNumber(params, "page", input.page);
  appendString(params, "search", query.search);
  appendString(params, "sortBy", input.sortBy === undefined ? undefined : query.sortBy);
  appendString(params, "sortOrder", input.sortOrder === undefined ? undefined : query.sortOrder);
  appendString(params, "status", toApiPurchaseOrderStatus(query.status));
  appendString(params, "supplierId", query.supplierId);
  return params;
}

export const buildCreateManualSalePayload = toCreateManualSalePayload;
export const buildConvertOrderToSalePayload = toConvertOrderToSalePayload;
export const buildCreateSupplierPayload = toCreateSupplierPayload;
export const buildUpdateSupplierPayload = toUpdateSupplierPayload;
export const buildCreatePurchaseOrderPayload = toCreatePurchaseOrderPayload;

function saleItems(input: CreateManualSalePayload): readonly NonNullable<CreateManualSalePayload["items"]>[number][] {
  if (input.items) return input.items;
  return (input.products ?? []).map((product) => ({ ...product }));
}

function toSaleItemPayload(item: NonNullable<CreateManualSalePayload["items"]>[number]) {
  return {
    attributes: item.attributes ? { ...item.attributes } : {},
    ...(item.compareAtPrice === undefined ? {} : { compareAtPrice: item.compareAtPrice }),
    lineSubtotal: item.lineSubtotal ?? item.quantity * item.unitPrice,
    name: item.name,
    productId: item.productId.trim(),
    productName: item.productName ?? item.name,
    quantity: item.quantity,
    sku: item.sku?.trim() || item.productId.trim(),
    snapshot: item.snapshot ? { ...item.snapshot } : {},
    unitPrice: item.unitPrice,
    ...(item.variantId === undefined ? {} : { variantId: item.variantId?.trim() }),
    ...(item.variantName === undefined ? {} : { variantName: item.variantName.trim() }),
    ...(item.weightGrams === undefined ? {} : { weightGrams: item.weightGrams }),
  };
}

function purchaseOrderItems(input: Pick<CreatePurchaseOrderPayload, "items" | "products">): readonly PurchaseOrderItemPayload[] {
  if (input.items) return input.items;
  return (input.products ?? []).map((product) => ({
    name: product.name,
    productId: product.productId,
    quantity: product.quantity,
    sku: product.productId,
    title: product.name,
    totalCost: product.quantity * product.unitPrice,
    unitCost: product.unitPrice,
    variantId: product.variantId,
  }));
}

function toPurchaseOrderItemPayload(item: PurchaseOrderItemPayload) {
  const unitCost = item.unitCost ?? item.unitPrice;
  const title = item.title ?? item.name ?? item.productId;
  return {
    productId: item.productId.trim(),
    quantity: item.quantity,
    sku: item.sku?.trim() || item.productId.trim(),
    title: title.trim(),
    ...(item.totalCost === undefined ? {} : { totalCost: item.totalCost }),
    unitCost,
    ...(item.variantId === undefined ? {} : { variantId: item.variantId }),
  };
}

function parsePayload<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw validationError(parsed.error, message);
}

function parseQuery<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  return parsePayload(schema, value, message);
}

function normalizeSalesQuery(input: SalesFilterQuery): Record<string, unknown> {
  const range = input.dateRange
    ? { from: new Date(input.dateRange.from), to: new Date(input.dateRange.to) }
    : input.dateFrom !== undefined || input.dateTo !== undefined
      ? { from: new Date(input.dateFrom ?? ""), to: new Date(input.dateTo ?? "") }
      : undefined;

  return {
    ...(range ? { dateRange: range } : {}),
    ...(input.isArchived === undefined ? {} : { isArchived: input.isArchived }),
    ...(input.limit === undefined ? {} : { limit: input.limit }),
    ...(input.page === undefined ? {} : { page: input.page }),
    ...(input.paymentStatus === "cancelled" ? {} : input.paymentStatus === undefined ? {} : { paymentStatus: input.paymentStatus }),
    ...(input.search === undefined ? {} : { search: input.search }),
    ...(input.shippingStatus === undefined ? {} : { shippingStatus: input.shippingStatus }),
    ...(input.sortBy === undefined ? {} : { sortBy: input.sortBy }),
    ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    ...(input.status === undefined ? {} : { status: input.status }),
  };
}

function subtotal(items: readonly NonNullable<CreateManualSalePayload["items"]>[number][]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function itemTotal(item: PurchaseOrderItemPayload): number {
  return item.totalCost ?? item.quantity * (item.unitCost ?? item.unitPrice ?? 0);
}

function calculateDiscount(value: number, type?: CreateManualSalePayload["discountType"], amount?: number): number {
  if (!amount || !type) return 0;
  return Math.min(value, type === "percentage" ? value * (amount / 100) : amount);
}

function buildDiscountSnapshot(type?: CreateManualSalePayload["discountType"], value?: number, amount = 0): Record<string, unknown> {
  return {
    ...(type ? { discountType: type } : {}),
    ...(value === undefined ? {} : { discountValue: value }),
    amount,
  };
}

function toApiDeliveryType(value: CreateManualSalePayload["deliveryType"]): "SHIPPING" | "PICKUP" {
  return value?.toLowerCase() === SALE_DELIVERY_TYPE.PICKUP ? "PICKUP" : "SHIPPING";
}

function toApiManualPaymentStatus(value: CreateManualSalePayload["paymentStatus"]): "PENDING" | "PAID" | "REFUNDED" {
  if (value === "received" || value === "PAID") return "PAID";
  if (value === "refunded" || value === "REFUNDED") return "REFUNDED";
  if (value === "cancelled") {
    throw new SalesApiError({
      code: "VALIDATION_ERROR",
      message: "A manual sale cannot be created with a cancelled payment.",
      status: 400,
    });
  }
  return "PENDING";
}

function toApiSaleStatus(value: SalesFilterQuery["status"]): string | undefined {
  return value?.toUpperCase();
}

function toApiPaymentStatus(value: SalesFilterQuery["paymentStatus"]): string | undefined {
  if (value === "received") return "PAID";
  if (value === "pending") return "PENDING";
  if (value === "refunded") return "REFUNDED";
  return undefined;
}

function toApiShippingStatus(value: SalesFilterQuery["shippingStatus"]): string | undefined {
  return value?.toUpperCase();
}

function toApiSupplierStatus(value: SupplierStatus | undefined): "ACTIVE" | "INACTIVE" | undefined {
  if (value === SUPPLIER_STATUS.ACTIVE) return "ACTIVE";
  if (value === SUPPLIER_STATUS.INACTIVE) return "INACTIVE";
  return undefined;
}

function toApiPurchaseOrderStatus(value: PurchaseOrderFilterQuery["status"]): string | undefined {
  if (!value) return undefined;
  return value === "draft" ? PURCHASE_ORDER_BACKEND_STATUS.DRAFT
    : value === "ordered" ? PURCHASE_ORDER_BACKEND_STATUS.ORDERED
      : value === "received" ? PURCHASE_ORDER_BACKEND_STATUS.RECEIVED
        : PURCHASE_ORDER_BACKEND_STATUS.CANCELLED;
}

function normalizeNullableText(value: string | null): string | null {
  return value === null ? null : value.trim();
}

function normalizeNullableDate(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new SalesApiError({ code: "VALIDATION_ERROR", message: "The date value is invalid.", status: 400 });
  }
  return date.toISOString();
}

function appendString(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value !== undefined && value.trim()) params.set(key, value);
}

function appendNumber(params: URLSearchParams, key: string, value: number | undefined): void {
  if (value !== undefined) params.set(key, String(value));
}

function appendBoolean(params: URLSearchParams, key: string, value: boolean | undefined): void {
  if (value !== undefined) params.set(key, String(value));
}

function validationError(error: z.ZodError, message: string): SalesApiError {
  return new SalesApiError({
    code: "VALIDATION_ERROR",
    issues: error.issues.map((issue) => ({
      code: issue.code,
      field: issue.path.length ? issue.path.map(String).join(".") : "request",
      message: issue.message,
    })),
    message,
    status: 400,
  });
}
