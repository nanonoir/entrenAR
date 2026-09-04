import { PurchaseOrderStatus } from "../../generated/prisma/enums";
import { PURCHASE_ORDER_COMMAND } from "./purchase-orders.schemas";
import {
  PurchaseOrderTransitionError,
  assertPurchaseOrderEditable,
  assertPurchaseOrderTransition,
  canCancelPurchaseOrder,
  canEditPurchaseOrder,
  canReceivePurchaseOrder,
  canSubmitPurchaseOrder,
  transitionPurchaseOrder,
} from "./purchase-orders.state-machine";

describe("purchase-order state machine", () => {
  it.each([
    [PurchaseOrderStatus.DRAFT, true, false, true, true],
    [PurchaseOrderStatus.ORDERED, false, true, true, false],
    [PurchaseOrderStatus.RECEIVED, false, false, false, false],
    [PurchaseOrderStatus.CANCELLED, false, false, false, false],
  ])("exposes the valid guard matrix for %s", (status, canSubmit, canReceive, canCancel, canEdit) => {
    const state = { status };

    expect(canSubmitPurchaseOrder(state)).toBe(canSubmit);
    expect(canReceivePurchaseOrder(state)).toBe(canReceive);
    expect(canCancelPurchaseOrder(state)).toBe(canCancel);
    expect(canEditPurchaseOrder(state)).toBe(canEdit);
  });

  it("returns deterministic transitions and preserves the receipt timestamp", () => {
    const now = new Date("2026-09-03T16:00:00.000Z");

    expect(transitionPurchaseOrder({ status: PurchaseOrderStatus.DRAFT }, PURCHASE_ORDER_COMMAND.SUBMIT)).toEqual({
      status: PurchaseOrderStatus.ORDERED,
    });
    expect(transitionPurchaseOrder({ status: PurchaseOrderStatus.ORDERED }, PURCHASE_ORDER_COMMAND.RECEIVE, { now })).toEqual({
      receivedAt: now,
      status: PurchaseOrderStatus.RECEIVED,
    });
    expect(transitionPurchaseOrder({ status: PurchaseOrderStatus.DRAFT }, PURCHASE_ORDER_COMMAND.CANCEL)).toEqual({
      receivedAt: null,
      status: PurchaseOrderStatus.CANCELLED,
    });
  });

  it("rejects illegal transitions and edits after submission", () => {
    expect(() => assertPurchaseOrderTransition(
      { status: PurchaseOrderStatus.DRAFT },
      PURCHASE_ORDER_COMMAND.RECEIVE,
    )).toThrow(PurchaseOrderTransitionError);
    expect(() => assertPurchaseOrderTransition(
      { status: PurchaseOrderStatus.RECEIVED },
      PURCHASE_ORDER_COMMAND.CANCEL,
    )).toThrow("Purchase order cannot execute CANCEL from RECEIVED.");
    expect(() => assertPurchaseOrderEditable({ status: PurchaseOrderStatus.ORDERED }))
      .toThrow("Purchase orders cannot be edited after submission.");
  });
});
