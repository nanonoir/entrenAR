import {
  OrderDeliveryType,
  OrderHistoryEventType,
  OrderShippingStatus,
  OrderStatus,
  PaymentStatus,
} from "../../generated/prisma/enums";
import { SALE_COMMAND } from "./sales.schemas";
import {
  canArchiveSale,
  canEditSale,
  SaleTransitionError,
  resolveHistoryEventType,
  transitionSale,
  type SaleState,
} from "./sales.state-machine";

const confirmed: SaleState = {
  deliveryType: OrderDeliveryType.SHIPPING,
  isArchived: false,
  paymentStatus: PaymentStatus.PAID,
  shippingStatus: OrderShippingStatus.TO_PACK,
  status: OrderStatus.CONFIRMED,
};

describe("sales.state-machine", () => {
  it("allows the fulfillment path and records deterministic timestamps", () => {
    const now = new Date("2026-09-03T15:00:00.000Z");
    const packed = transitionSale(confirmed, SALE_COMMAND.PACK, { now });
    const shipped = transitionSale({ ...confirmed, ...packed.patch }, SALE_COMMAND.SHIP, {
      carrier: "Carrier",
      now,
      trackingCode: "TRACK-1",
    });

    expect(packed.patch).toEqual({ packedAt: now, shippingStatus: OrderShippingStatus.TO_SHIP });
    expect(shipped.patch).toEqual(expect.objectContaining({
      shippedAt: now,
      shippingCarrier: "Carrier",
      shippingStatus: OrderShippingStatus.SHIPPED,
      shippingTrackingCode: "TRACK-1",
    }));
  });

  it("rejects shipment before packing and requires shipment data", () => {
    expect(() => transitionSale(confirmed, SALE_COMMAND.SHIP, {
      carrier: "Carrier",
      trackingCode: "TRACK-1",
    })).toThrow(SaleTransitionError);
    expect(() => transitionSale({ ...confirmed, shippingStatus: OrderShippingStatus.TO_SHIP }, SALE_COMMAND.SHIP)).toThrow(
      "Shipping requires a carrier and tracking code",
    );
  });

  it("protects edits and archives only terminal sales", () => {
    expect(canEditSale(confirmed)).toBe(true);
    expect(canEditSale({ ...confirmed, shippingStatus: OrderShippingStatus.TO_SHIP })).toBe(false);
    expect(canArchiveSale(confirmed)).toBe(false);
    expect(canArchiveSale({ ...confirmed, shippingStatus: OrderShippingStatus.DELIVERED })).toBe(true);
    expect(canArchiveSale({ ...confirmed, status: OrderStatus.CANCELLED })).toBe(true);
  });

  it("resolves every persisted lifecycle event", () => {
    const commands = [SALE_COMMAND.PACK, SALE_COMMAND.UNPACK, SALE_COMMAND.SHIP, SALE_COMMAND.DELIVER, SALE_COMMAND.CANCEL, SALE_COMMAND.REOPEN, SALE_COMMAND.ARCHIVE, SALE_COMMAND.UNARCHIVE] as const;
    expect(commands.map(resolveHistoryEventType)).toEqual([
      OrderHistoryEventType.PACKAGE_PACKED, OrderHistoryEventType.PACKAGE_UNPACKED, OrderHistoryEventType.PACKAGE_SHIPPED, OrderHistoryEventType.PACKAGE_DELIVERED,
      OrderHistoryEventType.ORDER_CANCELLED, OrderHistoryEventType.ORDER_REOPENED, OrderHistoryEventType.ORDER_ARCHIVED, OrderHistoryEventType.ORDER_UNARCHIVED,
    ]);
  });
});
