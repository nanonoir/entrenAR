import type { Prisma } from "../../generated/prisma/client";
import type { OrderDeliveryType, OrderHistoryEventType, OrderShippingStatus, OrderStatus, PaymentStatus, Role } from "../../generated/prisma/enums";

export const salesOrderInclude = { history: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, items: { orderBy: [{ productId: "asc" }, { id: "asc" }] }, payment: true } satisfies Prisma.OrderInclude;
export type SalesOrderRecord = Prisma.OrderGetPayload<{ include: typeof salesOrderInclude }>;
export type OrderHistoryRecord = Prisma.OrderHistoryGetPayload<Record<string, never>>;
export interface SaleCustomerDto { dni?: string; email: string; firstName: string; lastName: string; phone?: string; }
export type SaleSnapshotDto = Readonly<Record<string, unknown>>;
export interface AdminSaleItemDto { attributes: SaleSnapshotDto; compareAtPrice?: number; lineSubtotal: number; productId: string; productName: string; quantity: number; sku: string; snapshot: SaleSnapshotDto; unitPrice: number; variantId?: string; variantName?: string; weightGrams?: number; }
export interface SalePaymentDto { amount: number; bankTransferSnapshot?: SaleSnapshotDto; currency: string; paymentMethodId: string; paymentMethodSnapshot: SaleSnapshotDto; paymentOptionId?: string; status: PaymentStatus; }
export interface OrderHistoryDto { actorId?: string; actorRole?: Role; createdAt: string; description?: string; id: string; metadata?: unknown; title: string; type: OrderHistoryEventType; }
export interface AdminSaleSummaryDto { createdAt: string; currency: string; customer: SaleCustomerDto; customerId?: string; deliveryType: OrderDeliveryType; id: string; isArchived: boolean; itemCount: number; number: string; paymentStatus: PaymentStatus | null; shippingStatus: OrderShippingStatus; sourceOrderId?: string; status: OrderStatus; total: number; trackingCode?: string; updatedAt: string; }
export interface AdminSaleDetailDto extends AdminSaleSummaryDto { archivedAt?: string; cancellationReason?: string; cancelledAt?: string; confirmedAt?: string; customerSnapshot: SaleSnapshotDto; deliveredAt?: string; discountAmount: number; discountSnapshot: SaleSnapshotDto; history: OrderHistoryDto[]; internalNotes?: string; items: AdminSaleItemDto[]; packedAt?: string; payment: SalePaymentDto | null; previousPaymentStatus?: PaymentStatus; previousShippingStatus?: OrderShippingStatus; previousStatus?: OrderStatus; shippingAddress?: SaleSnapshotDto; shippingCarrier?: string; shippingCost: number; shippingTrackingUrl?: string; shippedAt?: string; subtotal: number; deliverySnapshot: SaleSnapshotDto; }

export function toAdminSaleSummaryDto(order: SalesOrderRecord): AdminSaleSummaryDto {
  return { createdAt: order.createdAt.toISOString(), currency: order.currency, customer: customerSnapshot(order), ...(order.customerId ? { customerId: order.customerId } : {}), deliveryType: order.deliveryType, id: order.id, isArchived: order.isArchived, itemCount: order.items.reduce((count, item) => count + item.quantity, 0), number: order.number, paymentStatus: order.payment?.status ?? null, shippingStatus: order.shippingStatus, ...(order.sourceOrderId ? { sourceOrderId: order.sourceOrderId } : {}), status: order.status, total: numberValue(order.total), ...(order.shippingTrackingCode ? { trackingCode: order.shippingTrackingCode } : {}), updatedAt: order.updatedAt.toISOString() };
}

export function toAdminSaleDetailDto(order: SalesOrderRecord): AdminSaleDetailDto {
  return {
    ...toAdminSaleSummaryDto(order), ...(order.archivedAt ? { archivedAt: order.archivedAt.toISOString() } : {}), ...(order.cancellationReason ? { cancellationReason: order.cancellationReason } : {}), ...(order.cancelledAt ? { cancelledAt: order.cancelledAt.toISOString() } : {}), ...(order.confirmedAt ? { confirmedAt: order.confirmedAt.toISOString() } : {}), customerSnapshot: snapshotRecord(order.customerSnapshot), ...(order.deliveredAt ? { deliveredAt: order.deliveredAt.toISOString() } : {}), discountAmount: numberValue(order.discountAmount), discountSnapshot: snapshotRecord(order.discountSnapshot),
    history: [...order.history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)).map(toOrderHistoryDto), ...(order.internalNotes ? { internalNotes: order.internalNotes } : {}), items: order.items.map(mapItem), ...(order.packedAt ? { packedAt: order.packedAt.toISOString() } : {}), payment: order.payment ? mapPayment(order.payment) : null,
    ...(order.previousPaymentStatus ? { previousPaymentStatus: order.previousPaymentStatus } : {}), ...(order.previousShippingStatus ? { previousShippingStatus: order.previousShippingStatus } : {}), ...(order.previousStatus ? { previousStatus: order.previousStatus } : {}), ...(order.shippingAddressSnapshot === null ? {} : { shippingAddress: snapshotRecord(order.shippingAddressSnapshot) }), ...(order.shippingCarrier ? { shippingCarrier: order.shippingCarrier } : {}), shippingCost: numberValue(order.shippingCost), ...(order.shippingTrackingUrl ? { shippingTrackingUrl: order.shippingTrackingUrl } : {}), ...(order.shippedAt ? { shippedAt: order.shippedAt.toISOString() } : {}), subtotal: numberValue(order.subtotal), deliverySnapshot: snapshotRecord(order.deliverySnapshot),
  };
}

export function toOrderHistoryDto(history: OrderHistoryRecord): OrderHistoryDto {
  return { ...(history.actorId ? { actorId: history.actorId } : {}), ...(history.actorRole ? { actorRole: history.actorRole } : {}), createdAt: history.createdAt.toISOString(), ...(history.description ? { description: history.description } : {}), id: history.id, ...(history.metadata === null ? {} : { metadata: cloneJson(history.metadata) }), title: history.title, type: history.type };
}

export const mapOrderToAdminSaleSummary = toAdminSaleSummaryDto;
export const mapOrderToAdminSaleDetail = toAdminSaleDetailDto;
export const mapOrderHistory = toOrderHistoryDto;
export const toAdminSaleSummary = toAdminSaleSummaryDto;
export const toAdminSaleDetail = toAdminSaleDetailDto;
export const toOrderHistory = toOrderHistoryDto;

function customerSnapshot(order: SalesOrderRecord): SaleCustomerDto {
  const snapshot = snapshotRecord(order.customerSnapshot);
  return { ...(stringValue(snapshot["dni"]) ?? order.customerDni ? { dni: stringValue(snapshot["dni"]) ?? order.customerDni! } : {}), email: stringValue(snapshot["email"]) ?? order.customerEmail, firstName: stringValue(snapshot["firstName"]) ?? order.customerFirstName, lastName: stringValue(snapshot["lastName"]) ?? order.customerLastName, ...(stringValue(snapshot["phone"]) ?? order.customerPhone ? { phone: stringValue(snapshot["phone"]) ?? order.customerPhone! } : {}) };
}

function mapItem(item: SalesOrderRecord["items"][number]): AdminSaleItemDto {
  return { attributes: snapshotRecord(item.attributes), ...(item.compareAtPrice === null ? {} : { compareAtPrice: numberValue(item.compareAtPrice) }), lineSubtotal: numberValue(item.lineSubtotal), productId: item.productId, productName: item.productName, quantity: item.quantity, sku: item.sku, snapshot: snapshotRecord(item.snapshot), unitPrice: numberValue(item.unitPrice), ...(item.variantId ? { variantId: item.variantId } : {}), ...(item.variantName ? { variantName: item.variantName } : {}), ...(item.weightGrams === null ? {} : { weightGrams: item.weightGrams }) };
}

function mapPayment(payment: NonNullable<SalesOrderRecord["payment"]>): SalePaymentDto {
  return { amount: numberValue(payment.amount), ...(payment.bankTransferSnapshot === null ? {} : { bankTransferSnapshot: snapshotRecord(payment.bankTransferSnapshot) }), currency: payment.currency, paymentMethodId: payment.paymentMethodId, paymentMethodSnapshot: snapshotRecord(payment.paymentMethodSnapshot), ...(payment.paymentOptionId ? { paymentOptionId: payment.paymentOptionId } : {}), status: payment.status };
}

function snapshotRecord(value: unknown): SaleSnapshotDto { return value && typeof value === "object" && !Array.isArray(value) ? cloneJson(value) as SaleSnapshotDto : {}; }
function cloneJson(value: unknown): unknown { return Array.isArray(value) ? value.map(cloneJson) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneJson(entry)])) : value; }
function stringValue(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }
function numberValue(value: { toString(): string } | number | null): number { const result = value === null ? 0 : Number(value); if (!Number.isFinite(result)) throw new Error("Sale money values must serialize to finite numbers."); return result; }
