import { PurchaseOrderStatus } from "../../generated/prisma/enums";
import { PURCHASE_ORDER_COMMAND, type PurchaseOrderCommand } from "./purchase-orders.schemas";

export interface PurchaseOrderState { status: PurchaseOrderStatus; }
export interface PurchaseOrderTransition { receivedAt?: Date | null; status: PurchaseOrderStatus; }
export interface PurchaseOrderTransitionOptions { now?: Date; }
export class PurchaseOrderTransitionError extends Error { constructor(public readonly command: PurchaseOrderCommand, message: string) { super(message); this.name = "PurchaseOrderTransitionError"; } }

export const canSubmitPurchaseOrder = (state: PurchaseOrderState) => state.status === PurchaseOrderStatus.DRAFT;
export const canReceivePurchaseOrder = (state: PurchaseOrderState) => state.status === PurchaseOrderStatus.ORDERED;
export const canCancelPurchaseOrder = (state: PurchaseOrderState) => state.status === PurchaseOrderStatus.DRAFT || state.status === PurchaseOrderStatus.ORDERED;
export const canEditPurchaseOrder = (state: PurchaseOrderState) => state.status === PurchaseOrderStatus.DRAFT;
export const canEditPurchaseOrderItems = canEditPurchaseOrder;

export function assertPurchaseOrderTransition(state: PurchaseOrderState, command: PurchaseOrderCommand): void {
  const allowed = command === PURCHASE_ORDER_COMMAND.SUBMIT ? canSubmitPurchaseOrder(state) : command === PURCHASE_ORDER_COMMAND.RECEIVE ? canReceivePurchaseOrder(state) : canCancelPurchaseOrder(state);
  if (!allowed) throw new PurchaseOrderTransitionError(command, `Purchase order cannot execute ${command} from ${state.status}.`);
}

export function assertPurchaseOrderEditable(state: PurchaseOrderState): void {
  if (!canEditPurchaseOrder(state)) throw new PurchaseOrderTransitionError(PURCHASE_ORDER_COMMAND.SUBMIT, "Purchase orders cannot be edited after submission.");
}

export function transitionPurchaseOrder(state: PurchaseOrderState, command: PurchaseOrderCommand, options: PurchaseOrderTransitionOptions = {}): PurchaseOrderTransition {
  assertPurchaseOrderTransition(state, command);
  if (command === PURCHASE_ORDER_COMMAND.SUBMIT) return { status: PurchaseOrderStatus.ORDERED };
  if (command === PURCHASE_ORDER_COMMAND.RECEIVE) return { receivedAt: options.now ?? new Date(), status: PurchaseOrderStatus.RECEIVED };
  return { receivedAt: null, status: PurchaseOrderStatus.CANCELLED };
}

export const transition = transitionPurchaseOrder;
export const assertTransition = assertPurchaseOrderTransition;
