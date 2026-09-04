import { OrderDeliveryType, OrderHistoryEventType, OrderShippingStatus, OrderStatus, PaymentStatus } from "../../generated/prisma/enums";
import { SALE_COMMAND, type SaleCommandType } from "./sales.schemas";

export interface SaleState { deliveryType: OrderDeliveryType; isArchived: boolean; paymentStatus: PaymentStatus | null; previousPaymentStatus?: PaymentStatus | null; previousShippingStatus?: OrderShippingStatus | null; previousStatus?: OrderStatus | null; shippingStatus: OrderShippingStatus; status: OrderStatus; }
export interface SaleTransitionOptions { cancellationReason?: string; carrier?: string; now?: Date; trackingCode?: string; trackingUrl?: string; }
export interface SaleStatePatch { archivedAt?: Date | null; cancelledAt?: Date | null; cancellationReason?: string | null; confirmedAt?: Date | null; deliveredAt?: Date | null; isArchived?: boolean; packedAt?: Date | null; previousPaymentStatus?: PaymentStatus | null; previousShippingStatus?: OrderShippingStatus | null; previousStatus?: OrderStatus | null; shippedAt?: Date | null; shippingCarrier?: string | null; shippingStatus?: OrderShippingStatus; shippingTrackingCode?: string | null; shippingTrackingUrl?: string | null; status?: OrderStatus; }
export interface SaleTransition { eventType: OrderHistoryEventType; patch: SaleStatePatch; }
export class SaleTransitionError extends Error { constructor(public readonly command: SaleCommandType, message: string) { super(message); this.name = "SaleTransitionError"; } }

type LifecycleCommand = Exclude<SaleCommandType, "ADD_NOTE" | "MANUAL_CREATE" | "CONVERT_ORDER_TO_SALE">;

export const canConfirmSale = (state: SaleState) => !state.isArchived && state.status === OrderStatus.PENDING;
export const canPackSale = (state: SaleState) => !state.isArchived && state.status === OrderStatus.CONFIRMED && state.shippingStatus === OrderShippingStatus.TO_PACK;
export const canUnpackSale = (state: SaleState) => !state.isArchived && state.status === OrderStatus.CONFIRMED && state.shippingStatus === OrderShippingStatus.TO_SHIP;
export const canShipSale = (state: SaleState) => canUnpackSale(state) && state.deliveryType === OrderDeliveryType.SHIPPING;
export const canDeliverSale = (state: SaleState) => !state.isArchived && state.status === OrderStatus.CONFIRMED && state.shippingStatus === OrderShippingStatus.SHIPPED;
export const canCancelSale = (state: SaleState) => !state.isArchived && state.status !== OrderStatus.CANCELLED && state.shippingStatus !== OrderShippingStatus.SHIPPED && state.shippingStatus !== OrderShippingStatus.DELIVERED && state.shippingStatus !== OrderShippingStatus.CANCELLED;
export const canReopenSale = (state: SaleState) => !state.isArchived && state.status === OrderStatus.CANCELLED;
export const canArchiveSale = (state: SaleState) => !state.isArchived && (state.status === OrderStatus.CANCELLED || state.shippingStatus === OrderShippingStatus.DELIVERED && state.paymentStatus === PaymentStatus.PAID);
export const canUnarchiveSale = (state: SaleState) => state.isArchived;
export const canEditSale = (state: SaleState) => !state.isArchived && state.status !== OrderStatus.CANCELLED && state.shippingStatus === OrderShippingStatus.TO_PACK;

const eventTypes: Record<SaleCommandType, OrderHistoryEventType> = {
  ADD_NOTE: OrderHistoryEventType.NOTE_ADDED, ARCHIVE: OrderHistoryEventType.ORDER_ARCHIVED, CANCEL: OrderHistoryEventType.ORDER_CANCELLED, CONFIRM: OrderHistoryEventType.PAYMENT_RECEIVED,
  CONVERT_ORDER_TO_SALE: OrderHistoryEventType.ORDER_CONVERTED, DELIVER: OrderHistoryEventType.PACKAGE_DELIVERED, MANUAL_CREATE: OrderHistoryEventType.ORDER_CREATED, PACK: OrderHistoryEventType.PACKAGE_PACKED,
  REOPEN: OrderHistoryEventType.ORDER_REOPENED, SHIP: OrderHistoryEventType.PACKAGE_SHIPPED, UNARCHIVE: OrderHistoryEventType.ORDER_UNARCHIVED, UNPACK: OrderHistoryEventType.PACKAGE_UNPACKED,
};
export const resolveHistoryEventType = (command: SaleCommandType) => eventTypes[command];

export function assertSaleTransition(state: SaleState, command: LifecycleCommand): void {
  const guards: Record<LifecycleCommand, boolean> = {
    ARCHIVE: canArchiveSale(state), CANCEL: canCancelSale(state), CONFIRM: canConfirmSale(state), DELIVER: canDeliverSale(state), PACK: canPackSale(state), REOPEN: canReopenSale(state), SHIP: canShipSale(state), UNARCHIVE: canUnarchiveSale(state), UNPACK: canUnpackSale(state),
  };
  if (!guards[command]) throw new SaleTransitionError(command, `Sale cannot execute ${command} from its current state.`);
}

export function transitionSale(state: SaleState, command: LifecycleCommand, options: SaleTransitionOptions = {}): SaleTransition {
  assertSaleTransition(state, command);
  const now = options.now ?? new Date();
  if (command === SALE_COMMAND.CONFIRM) return { eventType: resolveHistoryEventType(command), patch: { confirmedAt: now, status: OrderStatus.CONFIRMED } };
  if (command === SALE_COMMAND.PACK) return { eventType: resolveHistoryEventType(command), patch: { packedAt: now, shippingStatus: OrderShippingStatus.TO_SHIP } };
  if (command === SALE_COMMAND.UNPACK) return { eventType: resolveHistoryEventType(command), patch: { packedAt: null, shippingStatus: OrderShippingStatus.TO_PACK } };
  if (command === SALE_COMMAND.SHIP) {
    if (!options.carrier || !options.trackingCode) throw new SaleTransitionError(command, "Shipping requires a carrier and tracking code.");
    return { eventType: resolveHistoryEventType(command), patch: { shippedAt: now, shippingCarrier: options.carrier, shippingStatus: OrderShippingStatus.SHIPPED, shippingTrackingCode: options.trackingCode, ...(options.trackingUrl === undefined ? {} : { shippingTrackingUrl: options.trackingUrl }) } };
  }
  if (command === SALE_COMMAND.DELIVER) return { eventType: resolveHistoryEventType(command), patch: { deliveredAt: now, shippingStatus: OrderShippingStatus.DELIVERED } };
  if (command === SALE_COMMAND.CANCEL) return { eventType: resolveHistoryEventType(command), patch: { cancelledAt: now, cancellationReason: options.cancellationReason ?? null, previousPaymentStatus: state.paymentStatus, previousShippingStatus: state.shippingStatus, previousStatus: state.status, shippingStatus: OrderShippingStatus.CANCELLED, status: OrderStatus.CANCELLED } };
  if (command === SALE_COMMAND.REOPEN) return { eventType: resolveHistoryEventType(command), patch: { cancelledAt: null, cancellationReason: null, previousPaymentStatus: null, previousShippingStatus: null, previousStatus: null, shippingStatus: state.previousShippingStatus ?? OrderShippingStatus.TO_PACK, status: state.previousStatus ?? OrderStatus.PENDING } };
  if (command === SALE_COMMAND.ARCHIVE) return { eventType: resolveHistoryEventType(command), patch: { archivedAt: now, isArchived: true } };
  return { eventType: resolveHistoryEventType(command), patch: { archivedAt: null, isArchived: false } };
}

export const isEligibleForArchive = canArchiveSale;
export const isSaleArchivable = canArchiveSale;
export const isSaleEditable = canEditSale;
export const isSalePackable = canPackSale;
export const validateSaleTransition = assertSaleTransition;
