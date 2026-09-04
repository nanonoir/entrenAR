import { z } from "zod";

const API_SALE_STATUS = ["PENDING", "CONFIRMED", "CANCELLED"] as const;
const API_PAYMENT_STATUS = ["PENDING", "PAID", "REFUNDED"] as const;
const API_DELIVERY_TYPE = ["SHIPPING", "PICKUP"] as const;
const API_SHIPPING_STATUS = ["TO_PACK", "TO_SHIP", "SHIPPED", "DELIVERED", "PICKUP", "CANCELLED"] as const;
const API_HISTORY_EVENT_TYPE = [
  "ORDER_CREATED",
  "PAYMENT_RECEIVED",
  "PACKAGE_PACKED",
  "PACKAGE_UNPACKED",
  "PACKAGE_SHIPPED",
  "PACKAGE_DELIVERED",
  "ORDER_CANCELLED",
  "ORDER_REOPENED",
  "ORDER_ARCHIVED",
  "ORDER_UNARCHIVED",
  "NOTE_ADDED",
  "ORDER_CONVERTED",
] as const;
const API_ROLE = ["CUSTOMER", "ADMIN"] as const;
const API_SUPPLIER_STATUS = ["ACTIVE", "INACTIVE"] as const;
const API_PURCHASE_ORDER_STATUS = ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"] as const;
const API_SALE_SORT_BY = ["createdAt", "updatedAt", "total", "number", "customerName"] as const;
const API_PURCHASE_ORDER_SORT_BY = [
  "createdAt",
  "expectedDate",
  "orderNumber",
  "status",
  "total",
  "updatedAt",
] as const;

const identifierSchema = z.string().trim().min(1).max(128);
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) => z.string().trim().max(max).nullable();
const moneySchema = z.union([
  z.number().finite().nonnegative(),
  z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/).transform(Number),
]);
const snapshotSchema = z.record(z.string(), z.unknown());
const dateTimeSchema = z.iso.datetime();

const saleCustomerResponseSchema = z.object({
  dni: z.string().trim().optional(),
  email: z.email(),
  firstName: requiredText(160),
  lastName: requiredText(160),
  phone: z.string().trim().optional(),
}).strict();

const saleSummaryResponseSchema = z.object({
  createdAt: dateTimeSchema,
  currency: requiredText(8),
  customer: saleCustomerResponseSchema,
  deliveryType: z.enum(API_DELIVERY_TYPE),
  id: identifierSchema,
  isArchived: z.boolean(),
  itemCount: z.number().int().nonnegative(),
  number: identifierSchema,
  paymentStatus: z.enum(API_PAYMENT_STATUS).nullable(),
  shippingStatus: z.enum(API_SHIPPING_STATUS),
  sourceOrderId: identifierSchema.optional(),
  status: z.enum(API_SALE_STATUS),
  total: moneySchema,
  trackingCode: z.string().trim().optional(),
  updatedAt: dateTimeSchema,
}).strict();

const saleItemResponseSchema = z.object({
  attributes: snapshotSchema,
  compareAtPrice: moneySchema.optional(),
  lineSubtotal: moneySchema,
  productId: identifierSchema,
  productName: requiredText(240),
  quantity: z.number().int().positive(),
  sku: requiredText(160),
  snapshot: snapshotSchema,
  unitPrice: moneySchema,
  variantId: identifierSchema.optional(),
  variantName: requiredText(160).optional(),
  weightGrams: z.number().int().nonnegative().optional(),
}).strict();

const salePaymentResponseSchema = z.object({
  amount: moneySchema,
  bankTransferSnapshot: snapshotSchema.optional(),
  currency: requiredText(8),
  paymentMethodId: identifierSchema,
  paymentMethodSnapshot: snapshotSchema,
  paymentOptionId: identifierSchema.optional(),
  status: z.enum(API_PAYMENT_STATUS),
}).strict();

const saleHistoryResponseSchema = z.object({
  actorId: identifierSchema.optional(),
  actorRole: z.enum(API_ROLE).optional(),
  createdAt: dateTimeSchema,
  description: z.string().trim().optional(),
  id: identifierSchema,
  metadata: z.unknown().optional(),
  title: requiredText(240),
  type: z.enum(API_HISTORY_EVENT_TYPE),
}).strict();

export const adminSaleSummaryResponseSchema = saleSummaryResponseSchema;

export const adminSaleDetailResponseSchema = saleSummaryResponseSchema.extend({
  archivedAt: dateTimeSchema.optional(),
  cancellationReason: z.string().trim().optional(),
  cancelledAt: dateTimeSchema.optional(),
  confirmedAt: dateTimeSchema.optional(),
  customerSnapshot: snapshotSchema,
  deliveredAt: dateTimeSchema.optional(),
  deliverySnapshot: snapshotSchema,
  discountAmount: moneySchema,
  discountSnapshot: snapshotSchema,
  history: z.array(saleHistoryResponseSchema),
  internalNotes: z.string().trim().optional(),
  items: z.array(saleItemResponseSchema),
  packedAt: dateTimeSchema.optional(),
  payment: salePaymentResponseSchema.nullable(),
  previousPaymentStatus: z.enum(API_PAYMENT_STATUS).optional(),
  previousShippingStatus: z.enum(API_SHIPPING_STATUS).optional(),
  previousStatus: z.enum(API_SALE_STATUS).optional(),
  shippingAddress: snapshotSchema.optional(),
  shippingCarrier: z.string().trim().optional(),
  shippingCost: moneySchema,
  shippingTrackingUrl: z.url().optional(),
  shippedAt: dateTimeSchema.optional(),
  subtotal: moneySchema,
}).strict();

export const adminSaleListResponseSchema = z.object({
  items: z.array(saleSummaryResponseSchema),
  limit: z.number().int().positive(),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
}).strict();

export const supplierResponseSchema = z.object({
  code: requiredText(80),
  contactName: nullableText(160),
  createdAt: dateTimeSchema,
  email: z.email().nullable(),
  id: identifierSchema,
  name: requiredText(160),
  notes: nullableText(2_000),
  phone: nullableText(80),
  status: z.enum(API_SUPPLIER_STATUS),
  updatedAt: dateTimeSchema,
}).strict();

export const supplierListResponseSchema = z.object({
  items: z.array(supplierResponseSchema),
  limit: z.number().int().positive(),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
}).strict();

const purchaseOrderItemResponseSchema = z.object({
  productId: identifierSchema,
  quantity: z.number().int().positive(),
  sku: requiredText(160),
  title: requiredText(240),
  totalCost: moneySchema,
  unitCost: moneySchema,
  variantId: identifierSchema.nullable(),
}).strict();

export const purchaseOrderResponseSchema = z.object({
  createdAt: dateTimeSchema,
  expectedDate: dateTimeSchema.nullable(),
  id: identifierSchema,
  items: z.array(purchaseOrderItemResponseSchema),
  notes: z.string().trim().nullable(),
  orderNumber: identifierSchema,
  receivedAt: dateTimeSchema.nullable(),
  shippingCost: moneySchema,
  status: z.enum(API_PURCHASE_ORDER_STATUS),
  subtotal: moneySchema,
  supplier: supplierResponseSchema,
  supplierId: identifierSchema,
  tax: moneySchema,
  total: moneySchema,
  updatedAt: dateTimeSchema,
}).strict();

export const purchaseOrderListResponseSchema = z.object({
  items: z.array(purchaseOrderResponseSchema),
  limit: z.number().int().positive(),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
}).strict();

const saleItemRequestSchema = z.object({
  attributes: snapshotSchema.default({}),
  compareAtPrice: moneySchema.optional(),
  lineSubtotal: moneySchema.optional(),
  name: requiredText(240).optional(),
  productId: identifierSchema,
  productName: requiredText(240).optional(),
  quantity: z.number().int().positive(),
  sku: requiredText(160).optional(),
  snapshot: snapshotSchema.default({}),
  unitPrice: moneySchema,
  variantId: identifierSchema.optional(),
  variantName: requiredText(160).optional(),
  weightGrams: z.number().int().nonnegative().optional(),
}).strict().superRefine((item, context) => {
  if (!item.name && !item.productName) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Each sale item requires productName.", path: ["productName"] });
  }
});

const customerRequestSchema = z.object({
  dni: z.string().trim().optional(),
  email: z.email(),
  firstName: requiredText(160),
  lastName: requiredText(160),
  phone: z.string().trim().optional(),
}).strict();

export const createManualSaleRequestSchema = z.object({
  currency: requiredText(8),
  customer: customerRequestSchema,
  deliverySnapshot: snapshotSchema,
  deliveryType: z.enum(API_DELIVERY_TYPE),
  discountAmount: moneySchema,
  discountSnapshot: snapshotSchema,
  internalNotes: z.string().trim().optional(),
  items: z.array(saleItemRequestSchema).min(1).max(500),
  paymentMethodId: identifierSchema,
  paymentMethodSnapshot: snapshotSchema,
  paymentOptionId: identifierSchema.optional(),
  paymentStatus: z.enum(API_PAYMENT_STATUS),
  shippingAddress: snapshotSchema.optional(),
  shippingCost: moneySchema,
  source: requiredText(120).optional(),
  subtotal: moneySchema,
  total: moneySchema,
}).strict();

export const convertOrderToSaleRequestSchema = z.object({
  orderId: identifierSchema.optional(),
  sourceOrderId: identifierSchema.optional(),
}).strict().superRefine((value, context) => {
  if (!value.orderId && !value.sourceOrderId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "orderId or sourceOrderId is required.", path: [] });
  }
  if (value.orderId && value.sourceOrderId && value.orderId !== value.sourceOrderId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "orderId and sourceOrderId must identify the same order.", path: ["sourceOrderId"] });
  }
});

export const shipSaleRequestSchema = z.object({
  carrier: requiredText(120),
  trackingCode: requiredText(160),
  trackingUrl: z.url().optional(),
}).strict();

export const cancelSaleRequestSchema = z.object({
  cancellationReason: requiredText(500),
  restoreStock: z.boolean(),
}).strict();

export const addSaleNoteRequestSchema = z.object({
  note: requiredText(2_000),
}).strict();

export const emptyCommandRequestSchema = z.object({}).strict();

export const createSupplierRequestSchema = z.object({
  code: requiredText(80),
  contactName: nullableText(160).optional(),
  email: z.email().nullable().optional(),
  name: requiredText(160),
  notes: nullableText(2_000).optional(),
  phone: nullableText(80).optional(),
  status: z.enum(API_SUPPLIER_STATUS),
}).strict();

export const updateSupplierRequestSchema = z.object({
  code: requiredText(80).optional(),
  contactName: nullableText(160).optional(),
  email: z.email().nullable().optional(),
  name: requiredText(160).optional(),
  notes: nullableText(2_000).optional(),
  phone: nullableText(80).optional(),
  status: z.enum(API_SUPPLIER_STATUS).optional(),
}).strict().refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one supplier field is required.",
);

export const supplierStatusRequestSchema = z.object({
  status: z.enum(API_SUPPLIER_STATUS),
}).strict();

const purchaseOrderItemRequestSchema = z.object({
  productId: identifierSchema,
  quantity: z.number().int().positive(),
  sku: requiredText(160),
  title: requiredText(240),
  totalCost: moneySchema.optional(),
  unitCost: moneySchema,
  variantId: identifierSchema.nullable().optional(),
}).strict().transform((item) => ({
  ...item,
  totalCost: item.totalCost ?? roundMoney(item.quantity * Number(item.unitCost)),
}));

export const createPurchaseOrderRequestSchema = z.object({
  expectedDate: dateTimeSchema.nullable().optional(),
  items: z.array(purchaseOrderItemRequestSchema).min(1).max(500),
  notes: z.string().trim().min(1).max(2_000).nullable().optional(),
  orderNumber: requiredText(80).optional(),
  shippingCost: moneySchema,
  subtotal: moneySchema,
  supplierId: identifierSchema,
  tax: moneySchema,
  total: moneySchema,
}).strict();

export const updatePurchaseOrderRequestSchema = z.object({
  expectedDate: dateTimeSchema.nullable().optional(),
  items: z.array(purchaseOrderItemRequestSchema).min(1).max(500).optional(),
  notes: z.string().trim().min(1).max(2_000).nullable().optional(),
  orderNumber: requiredText(80).optional(),
  shippingCost: moneySchema.optional(),
  subtotal: moneySchema.optional(),
  supplierId: identifierSchema.optional(),
  tax: moneySchema.optional(),
  total: moneySchema.optional(),
}).strict().refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one purchase-order field is required.",
);

export const salesFilterQuerySchema = z.object({
  dateRange: z.object({ from: z.coerce.date(), to: z.coerce.date() }).strict().optional(),
  isArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
  paymentStatus: z.enum(["pending", "received", "refunded"] as const).optional(),
  search: z.string().trim().min(1).max(240).optional(),
  shippingStatus: z.enum(["to_pack", "to_ship", "shipped", "delivered", "pickup", "cancelled"] as const).optional(),
  sortBy: z.enum(API_SALE_SORT_BY).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"] as const).default("desc"),
  status: z.enum(["pending", "confirmed", "cancelled"] as const).optional(),
}).strict().superRefine((value, context) => {
  if (value.dateRange && value.dateRange.from > value.dateRange.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "dateRange.from must be before or equal to dateRange.to.", path: ["dateRange", "from"] });
  }
});

export const supplierFilterQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
  search: z.string().trim().min(1).max(240).optional(),
  sortBy: z.enum(["name", "code", "status", "createdAt", "updatedAt"] as const).default("name"),
  sortOrder: z.enum(["asc", "desc"] as const).default("asc"),
  status: z.enum(["active", "inactive"] as const).optional(),
}).strict();

export const purchaseOrderFilterQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
  search: z.string().trim().min(1).max(240).optional(),
  sortBy: z.enum(API_PURCHASE_ORDER_SORT_BY).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"] as const).default("desc"),
  status: z.enum(["draft", "ordered", "received", "cancelled"] as const).optional(),
  supplierId: identifierSchema.optional(),
}).strict();

export type AdminSaleSummaryResponseDto = z.output<typeof adminSaleSummaryResponseSchema>;
export type AdminSaleDetailResponseDto = z.output<typeof adminSaleDetailResponseSchema>;
export type AdminSaleListResponseDto = z.output<typeof adminSaleListResponseSchema>;
export type SupplierResponseDto = z.output<typeof supplierResponseSchema>;
export type SupplierListResponseDto = z.output<typeof supplierListResponseSchema>;
export type PurchaseOrderResponseDto = z.output<typeof purchaseOrderResponseSchema>;
export type PurchaseOrderListResponseDto = z.output<typeof purchaseOrderListResponseSchema>;
export type CreateManualSaleRequestDto = z.output<typeof createManualSaleRequestSchema>;
export type ConvertOrderToSaleRequestDto = z.output<typeof convertOrderToSaleRequestSchema>;
export type ShipSaleRequestDto = z.output<typeof shipSaleRequestSchema>;
export type CancelSaleRequestDto = z.output<typeof cancelSaleRequestSchema>;
export type AddSaleNoteRequestDto = z.output<typeof addSaleNoteRequestSchema>;
export type CreateSupplierRequestDto = z.output<typeof createSupplierRequestSchema>;
export type UpdateSupplierRequestDto = z.output<typeof updateSupplierRequestSchema>;
export type SupplierStatusRequestDto = z.output<typeof supplierStatusRequestSchema>;
export type CreatePurchaseOrderRequestDto = z.output<typeof createPurchaseOrderRequestSchema>;
export type UpdatePurchaseOrderRequestDto = z.output<typeof updatePurchaseOrderRequestSchema>;

export {
  API_DELIVERY_TYPE,
  API_HISTORY_EVENT_TYPE,
  API_PAYMENT_STATUS,
  API_PURCHASE_ORDER_STATUS,
  API_ROLE,
  API_SALE_STATUS,
  API_SHIPPING_STATUS,
  API_SUPPLIER_STATUS,
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
