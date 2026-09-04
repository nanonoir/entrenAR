import { z } from "zod";

import { PurchaseOrderStatus } from "../../generated/prisma/enums";
import { supplierResponseSchema } from "../suppliers/suppliers.schemas";

export const PURCHASE_ORDER_COMMAND = { CANCEL: "CANCEL", RECEIVE: "RECEIVE", SUBMIT: "SUBMIT" } as const;
export const PURCHASE_ORDER_SORT_BY = { CREATED_AT: "createdAt", EXPECTED_DATE: "expectedDate", ORDER_NUMBER: "orderNumber", STATUS: "status", TOTAL: "total", UPDATED_AT: "updatedAt" } as const;
export const purchaseOrderIdentifierSchema = z.string().trim().min(1).max(128);
const id = purchaseOrderIdentifierSchema;
const text = (max: number) => z.string().trim().min(1).max(max);
const money = z.number().finite().nonnegative();
const statuses = [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.CANCELLED] as const;
const status = z.preprocess((value) => typeof value === "string" ? value.toUpperCase() : value, z.enum(statuses));

export const purchaseOrderItemSchema = z.object({
  productId: id,
  quantity: z.number().int().positive(),
  sku: text(160),
  title: text(240),
  totalCost: money.optional(),
  unitCost: money,
  variantId: id.nullable().optional(),
}).strict().transform((item) => ({ ...item, totalCost: item.totalCost ?? roundMoney(item.quantity * item.unitCost) }));

const purchaseOrderFields = {
  expectedDate: z.coerce.date().nullable().optional(),
  items: z.array(purchaseOrderItemSchema).min(1).max(500),
  notes: z.string().trim().min(1).max(2_000).nullable().optional(),
  orderNumber: text(80).optional(),
  shippingCost: money.default(0),
  subtotal: money.optional(),
  supplierId: id,
  tax: money.default(0),
  total: money.optional(),
};

export const createPurchaseOrderSchema = z.object(purchaseOrderFields).strict();
export const updatePurchaseOrderSchema = z.object({
  id: id.optional(),
  expectedDate: purchaseOrderFields.expectedDate,
  items: purchaseOrderFields.items.optional(),
  notes: purchaseOrderFields.notes,
  orderNumber: purchaseOrderFields.orderNumber,
  shippingCost: money.optional(),
  subtotal: money.optional(),
  supplierId: id.optional(),
  tax: money.optional(),
  total: money.optional(),
}).strict().refine((value) => Object.entries(value).some(([key, entry]) => key !== "id" && entry !== undefined), "At least one purchase-order field is required.");

export const purchaseOrderFilterQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().min(1).max(240).optional(),
  sortBy: z.enum(Object.values(PURCHASE_ORDER_SORT_BY) as [string, ...string[]]).default(PURCHASE_ORDER_SORT_BY.CREATED_AT),
  sortOrder: z.enum(["asc", "desc"] as const).default("desc"),
  status: status.optional(),
  supplierId: id.optional(),
}).strict();
export const purchaseOrderCommandSchema = z.preprocess((value) => value === undefined ? {} : value, z.object({}).strict());

export const purchaseOrderItemResponseSchema = purchaseOrderItemSchema.transform((item) => item);
export const purchaseOrderResponseSchema = z.object({
  createdAt: z.string(), expectedDate: z.string().nullable(), id: z.string(), items: z.array(purchaseOrderItemResponseSchema), notes: z.string().nullable(), orderNumber: z.string(), receivedAt: z.string().nullable(), shippingCost: money,
  status: z.enum(statuses), subtotal: money, supplier: supplierResponseSchema, supplierId: z.string(), tax: money, total: money, updatedAt: z.string(),
}).strict();
export const purchaseOrderListResponseSchema = z.object({ items: z.array(purchaseOrderResponseSchema), limit: z.number(), page: z.number(), total: z.number() }).strict();

export type PurchaseOrderCommand = (typeof PURCHASE_ORDER_COMMAND)[keyof typeof PURCHASE_ORDER_COMMAND];
export type PurchaseOrderSortBy = (typeof PURCHASE_ORDER_SORT_BY)[keyof typeof PURCHASE_ORDER_SORT_BY];
export type CreatePurchaseOrderDto = z.output<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderDto = z.output<typeof updatePurchaseOrderSchema>;
export type PurchaseOrderFilterQueryDto = z.output<typeof purchaseOrderFilterQuerySchema>;
export type PurchaseOrderItemDto = z.output<typeof purchaseOrderItemSchema>;
export type PurchaseOrderResponseDto = z.output<typeof purchaseOrderResponseSchema>;
export type PurchaseOrderListResponseDto = z.output<typeof purchaseOrderListResponseSchema>;
export const createPurchaseOrderDtoSchema = createPurchaseOrderSchema;
export const updatePurchaseOrderDtoSchema = updatePurchaseOrderSchema;
export const purchaseOrderFilterQueryDtoSchema = purchaseOrderFilterQuerySchema;

function roundMoney(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
