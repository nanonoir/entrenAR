import { z } from "zod";
import { OrderDeliveryType, OrderShippingStatus, OrderStatus, PaymentStatus } from "../../generated/prisma/enums";

export const SALE_COMMAND = { CONFIRM: "CONFIRM", PACK: "PACK", UNPACK: "UNPACK", SHIP: "SHIP", DELIVER: "DELIVER", CANCEL: "CANCEL", REOPEN: "REOPEN", ARCHIVE: "ARCHIVE", UNARCHIVE: "UNARCHIVE", ADD_NOTE: "ADD_NOTE", MANUAL_CREATE: "MANUAL_CREATE", CONVERT_ORDER_TO_SALE: "CONVERT_ORDER_TO_SALE" } as const;
export type SaleCommandType = (typeof SALE_COMMAND)[keyof typeof SALE_COMMAND];
export const SALE_SORT_BY = { CREATED_AT: "createdAt", UPDATED_AT: "updatedAt", TOTAL: "total", NUMBER: "number", CUSTOMER_NAME: "customerName" } as const;
export type SaleSortBy = (typeof SALE_SORT_BY)[keyof typeof SALE_SORT_BY];

export const salesIdentifierSchema = z.string().trim().min(1).max(128);
const id = salesIdentifierSchema;
const text = (max = 500) => z.string().trim().min(1).max(max);
const money = z.number().finite().nonnegative();
const jsonObject = z.record(z.string(), z.unknown());
const boolQuery = z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean());
const enumQuery = <const T extends readonly [string, ...string[]]>(values: T) => z.preprocess((value) => typeof value === "string" ? value.toUpperCase() : value, z.enum(values));
const orderStatus = enumQuery([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED] as const);
const paymentStatus = enumQuery([PaymentStatus.PENDING, PaymentStatus.PAID, PaymentStatus.REFUNDED] as const);
const shippingStatus = enumQuery([OrderShippingStatus.TO_PACK, OrderShippingStatus.TO_SHIP, OrderShippingStatus.SHIPPED, OrderShippingStatus.DELIVERED, OrderShippingStatus.PICKUP, OrderShippingStatus.CANCELLED] as const);

const dateRange = z.object({ from: z.coerce.date(), to: z.coerce.date() }).strict().superRefine((range, context) => {
  if (range.from > range.to) context.addIssue({ code: z.ZodIssueCode.custom, message: "dateRange.from must be before or equal to dateRange.to.", path: ["from"] });
});

export const salesListQuerySchema = z.object({
  dateRange: dateRange.optional(), isArchived: boolQuery.optional(), limit: z.coerce.number().int().min(1).max(100).default(20), page: z.coerce.number().int().min(1).default(1),
  paymentStatus: paymentStatus.optional(), search: z.string().trim().min(1).max(240).optional(), shippingStatus: shippingStatus.optional(),
  sortBy: z.enum([SALE_SORT_BY.CREATED_AT, SALE_SORT_BY.UPDATED_AT, SALE_SORT_BY.TOTAL, SALE_SORT_BY.NUMBER, SALE_SORT_BY.CUSTOMER_NAME] as const).default(SALE_SORT_BY.CREATED_AT),
  sortOrder: z.enum(["asc", "desc"] as const).default("desc"), status: orderStatus.optional(),
}).strict();
export type SalesListQuery = z.output<typeof salesListQuerySchema>;
export type SaleDateRange = z.output<typeof dateRange>;

const empty = z.preprocess((value) => value === undefined ? {} : value, z.object({}).strict());
export const confirmSaleSchema = empty;
export const packSaleSchema = empty;
export const unpackSaleSchema = empty;
export const deliverSaleSchema = empty;
export const reopenSaleSchema = empty;
export const archiveSaleSchema = empty;
export const unarchiveSaleSchema = empty;
export const shipSaleSchema = z.object({ carrier: text(120), trackingCode: text(160), trackingUrl: z.url().optional() }).strict();
export const cancelSaleSchema = z.object({ cancellationReason: text(), restoreStock: z.boolean() }).strict();
export const addSaleNoteSchema = z.object({ note: text(2_000) }).strict();

export type ConfirmSale = z.output<typeof confirmSaleSchema>;
export type PackSale = z.output<typeof packSaleSchema>;
export type UnpackSale = z.output<typeof unpackSaleSchema>;
export type ShipSale = z.output<typeof shipSaleSchema>;
export type DeliverSale = z.output<typeof deliverSaleSchema>;
export type CancelSale = z.output<typeof cancelSaleSchema>;
export type ReopenSale = z.output<typeof reopenSaleSchema>;
export type ArchiveSale = z.output<typeof archiveSaleSchema>;
export type UnarchiveSale = z.output<typeof unarchiveSaleSchema>;
export type AddSaleNote = z.output<typeof addSaleNoteSchema>;

const customer = z.object({ dni: text(80).optional(), email: z.email(), firstName: text(160), lastName: text(160), phone: text(80).optional() }).strict();
const item = z.object({
  attributes: jsonObject.default({}), compareAtPrice: money.optional(), lineSubtotal: money.optional(), name: text(240).optional(), productId: id,
  productName: text(240).optional(), quantity: z.number().int().positive(), sku: text(160).optional(), snapshot: jsonObject.default({}), unitPrice: money,
  variantId: id.optional(), variantName: text(160).optional(), weightGrams: z.number().int().nonnegative().optional(),
}).strict().superRefine((value, context) => {
  if (!value.productName && !value.name) context.addIssue({ code: z.ZodIssueCode.custom, message: "Each sale item requires productName.", path: ["productName"] });
}).transform((value) => ({
  attributes: value.attributes, ...(value.compareAtPrice === undefined ? {} : { compareAtPrice: value.compareAtPrice }), lineSubtotal: value.lineSubtotal ?? value.quantity * value.unitPrice,
  productId: value.productId, productName: value.productName ?? value.name!, quantity: value.quantity, sku: value.sku ?? value.productId, snapshot: value.snapshot, unitPrice: value.unitPrice,
  ...(value.variantId === undefined ? {} : { variantId: value.variantId }), ...(value.variantName === undefined ? {} : { variantName: value.variantName }), ...(value.weightGrams === undefined ? {} : { weightGrams: value.weightGrams }),
}));

export const createManualSaleSchema = z.object({
  currency: text(8).default("ARS"), customer, deliverySnapshot: jsonObject.default({}), deliveryType: z.enum([OrderDeliveryType.SHIPPING, OrderDeliveryType.PICKUP]).default(OrderDeliveryType.SHIPPING),
  discountAmount: money.default(0), discountSnapshot: jsonObject.default({}), internalNotes: text(2_000).optional(), items: z.array(item).min(1).max(500), paymentMethodId: id.default("manual"),
  paymentMethodSnapshot: jsonObject.default({}), paymentOptionId: id.optional(), paymentStatus: paymentStatus.default(PaymentStatus.PENDING), shippingAddress: jsonObject.optional(), shippingCost: money.default(0), source: text(120).optional(), subtotal: money, total: money,
}).strict();
export type CreateManualSale = z.output<typeof createManualSaleSchema>;

export const convertOrderToSaleSchema = z.object({ orderId: id.optional(), sourceOrderId: id.optional() }).strict().superRefine((value, context) => {
  if (!value.orderId && !value.sourceOrderId) context.addIssue({ code: z.ZodIssueCode.custom, message: "orderId or sourceOrderId is required.", path: [] });
  if (value.orderId && value.sourceOrderId && value.orderId !== value.sourceOrderId) context.addIssue({ code: z.ZodIssueCode.custom, message: "orderId and sourceOrderId must identify the same order.", path: ["sourceOrderId"] });
});
export type ConvertOrderToSale = z.output<typeof convertOrderToSaleSchema>;

const command = <T extends z.ZodType>(type: SaleCommandType, payload: T) => z.object({ payload, type: z.literal(type) }).strict();
export const salesCommandSchema = z.discriminatedUnion("type", [
  command(SALE_COMMAND.CONFIRM, confirmSaleSchema), command(SALE_COMMAND.PACK, packSaleSchema), command(SALE_COMMAND.UNPACK, unpackSaleSchema), command(SALE_COMMAND.SHIP, shipSaleSchema), command(SALE_COMMAND.DELIVER, deliverSaleSchema), command(SALE_COMMAND.CANCEL, cancelSaleSchema),
  command(SALE_COMMAND.REOPEN, reopenSaleSchema), command(SALE_COMMAND.ARCHIVE, archiveSaleSchema), command(SALE_COMMAND.UNARCHIVE, unarchiveSaleSchema), command(SALE_COMMAND.ADD_NOTE, addSaleNoteSchema), command(SALE_COMMAND.MANUAL_CREATE, createManualSaleSchema), command(SALE_COMMAND.CONVERT_ORDER_TO_SALE, convertOrderToSaleSchema),
]);
export type SalesCommand =
  | { payload: ConfirmSale; type: typeof SALE_COMMAND.CONFIRM } | { payload: PackSale; type: typeof SALE_COMMAND.PACK } | { payload: UnpackSale; type: typeof SALE_COMMAND.UNPACK }
  | { payload: ShipSale; type: typeof SALE_COMMAND.SHIP } | { payload: DeliverSale; type: typeof SALE_COMMAND.DELIVER } | { payload: CancelSale; type: typeof SALE_COMMAND.CANCEL }
  | { payload: ReopenSale; type: typeof SALE_COMMAND.REOPEN } | { payload: ArchiveSale; type: typeof SALE_COMMAND.ARCHIVE } | { payload: UnarchiveSale; type: typeof SALE_COMMAND.UNARCHIVE }
  | { payload: AddSaleNote; type: typeof SALE_COMMAND.ADD_NOTE } | { payload: CreateManualSale; type: typeof SALE_COMMAND.MANUAL_CREATE } | { payload: ConvertOrderToSale; type: typeof SALE_COMMAND.CONVERT_ORDER_TO_SALE };
export type ParsedSalesCommand = z.output<typeof salesCommandSchema>;
