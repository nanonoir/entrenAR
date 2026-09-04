import {
  OrderDeliveryType,
  OrderHistoryEventType,
  OrderShippingStatus,
  OrderStatus,
  PaymentStatus,
} from "../../generated/prisma/enums";
import { toAdminSaleDetailDto, toAdminSaleSummaryDto, type SalesOrderRecord } from "./sales.mapper";

describe("sales mapper", () => {
  it("returns immutable customer, item, payment, and delivery snapshots", () => {
    const customerSnapshot = {
      email: "snapshot@example.com",
      firstName: "Historical",
      nested: { label: "original" },
    };
    const itemSnapshot = { color: "red", nested: { size: "M" } };
    const order = makeOrder({
      customerEmail: "current@example.com",
      customerFirstName: "Current",
      customerSnapshot,
      deliverySnapshot: { method: "shipping" },
      items: [{
        attributes: { color: "red" },
        compareAtPrice: "20.00",
        id: "item-1",
        lineSubtotal: "10.00",
        productId: "product-1",
        productName: "Historical product",
        quantity: 1,
        sku: "SKU-1",
        snapshot: itemSnapshot,
        unitPrice: "10.00",
        variantId: null,
        variantName: null,
        weightGrams: null,
      }],
      payment: {
        amount: "10.00",
        bankTransferSnapshot: null,
        currency: "ARS",
        paymentMethodId: "manual",
        paymentMethodSnapshot: { name: "Manual payment" },
        paymentOptionId: null,
        status: PaymentStatus.PAID,
      },
      shippingAddressSnapshot: { city: "Buenos Aires" },
    });

    const mapped = toAdminSaleDetailDto(order);

    expect(mapped.customer).toEqual({ email: "snapshot@example.com", firstName: "Historical", lastName: "Customer" });
    expect(mapped.customerSnapshot).toEqual(customerSnapshot);
    expect(mapped.items[0]).toEqual(expect.objectContaining({ compareAtPrice: 20, lineSubtotal: 10, snapshot: itemSnapshot, unitPrice: 10 }));
    expect(mapped.payment).toEqual(expect.objectContaining({ amount: 10, paymentMethodSnapshot: { name: "Manual payment" }, status: PaymentStatus.PAID }));
    expect(mapped.shippingAddress).toEqual({ city: "Buenos Aires" });
    expect(mapped.customerSnapshot).not.toBe(customerSnapshot);
    expect(mapped.items[0]?.snapshot).not.toBe(itemSnapshot);

    const mappedNested = (mapped.customerSnapshot as Record<string, unknown>).nested as Record<string, unknown>;
    mappedNested.label = "changed in response";
    expect((customerSnapshot.nested as Record<string, string>).label).toBe("original");
  });

  it("sorts history chronologically and uses the history id as a stable tie-breaker", () => {
    const order = makeOrder({
      history: [
        historyRecord("b", "2026-09-03T10:00:00.000Z", OrderHistoryEventType.PACKAGE_PACKED),
        historyRecord("a", "2026-09-03T10:00:00.000Z", OrderHistoryEventType.ORDER_CREATED),
        historyRecord("c", "2026-09-03T09:00:00.000Z", OrderHistoryEventType.PAYMENT_RECEIVED),
      ],
    });

    expect(toAdminSaleDetailDto(order).history.map((event) => event.id)).toEqual(["c", "a", "b"]);
  });

  it("preserves the linked customer id in sale responses", () => {
    expect(toAdminSaleSummaryDto(makeOrder({ customerId: "customer-1" })).customerId).toBe("customer-1");
  });
});

function makeOrder(overrides: Record<string, unknown> = {}): SalesOrderRecord {
  return {
    id: "sale-1",
    number: "EN-SALE-1",
    status: OrderStatus.CONFIRMED,
    shippingStatus: OrderShippingStatus.TO_PACK,
    deliveryType: OrderDeliveryType.SHIPPING,
    isArchived: false,
    currency: "ARS",
    customerEmail: "customer@example.com",
    customerFirstName: "Test",
    customerLastName: "Customer",
    customerDni: null,
    customerPhone: null,
    customerSnapshot: {},
    shippingAddressSnapshot: null,
    deliverySnapshot: {},
    discountSnapshot: {},
    subtotal: "0.00",
    discountAmount: "0.00",
    shippingCost: "0.00",
    total: "0.00",
    sourceOrderId: null,
    archivedAt: null,
    cancellationReason: null,
    previousStatus: null,
    previousPaymentStatus: null,
    previousShippingStatus: null,
    confirmedAt: null,
    packedAt: null,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    shippingTrackingCode: null,
    shippingCarrier: null,
    shippingTrackingUrl: null,
    internalNotes: null,
    userId: null,
    cartId: null,
    checkoutSessionId: null,
    couponCode: null,
    createdAt: new Date("2026-09-03T08:00:00.000Z"),
    updatedAt: new Date("2026-09-03T08:00:00.000Z"),
    items: [],
    payment: null,
    history: [],
    idempotencyRecords: [],
    couponRedemptions: [],
    ...overrides,
  } as unknown as SalesOrderRecord;
}

function historyRecord(id: string, createdAt: string, type: OrderHistoryEventType) {
  return { actorId: null, actorRole: null, createdAt: new Date(createdAt), description: null, id, metadata: null, orderId: "sale-1", title: id, type };
}
