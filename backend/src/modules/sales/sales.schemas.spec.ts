import {
  OrderDeliveryType,
  OrderShippingStatus,
  OrderStatus,
  PaymentStatus,
} from "../../generated/prisma/enums";
import {
  SALE_COMMAND,
  cancelSaleSchema,
  convertOrderToSaleSchema,
  createManualSaleSchema,
  salesCommandSchema,
  salesListQuerySchema,
  shipSaleSchema,
} from "./sales.schemas";

describe("sales schemas", () => {
  it("coerces list query values, applies defaults, and preserves an inclusive date range", () => {
    const parsed = salesListQuerySchema.parse({
      dateRange: { from: "2026-09-01", to: "2026-09-03" },
      isArchived: "true",
      limit: "10",
      page: "2",
      paymentStatus: "paid",
      search: "  customer@example.com  ",
      shippingStatus: "to_ship",
      sortBy: "total",
      sortOrder: "asc",
      status: "confirmed",
    });

    expect(parsed).toMatchObject({
      isArchived: true,
      limit: 10,
      page: 2,
      paymentStatus: PaymentStatus.PAID,
      search: "customer@example.com",
      shippingStatus: OrderShippingStatus.TO_SHIP,
      sortBy: "total",
      sortOrder: "asc",
      status: OrderStatus.CONFIRMED,
    });
    expect(parsed.dateRange).toEqual({
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-03T00:00:00.000Z"),
    });

    expect(salesListQuerySchema.parse({})).toEqual({
      limit: 20,
      page: 1,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("rejects invalid ranges and unsupported transport fields", () => {
    expect(salesListQuerySchema.safeParse({
      dateRange: { from: "2026-09-04", to: "2026-09-03" },
    }).success).toBe(false);
    expect(salesListQuerySchema.safeParse({ isArchived: "yes" }).success).toBe(false);
    expect(salesListQuerySchema.safeParse({ status: "unknown" }).success).toBe(false);
    expect(salesListQuerySchema.safeParse({ unexpected: true }).success).toBe(false);
  });

  it("normalizes manual sale items and applies safe defaults", () => {
    const parsed = createManualSaleSchema.parse({
      customer: {
        email: "customer@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      },
      items: [{
        name: "  Product one  ",
        productId: "product-1",
        quantity: 2,
        unitPrice: 12.5,
      }],
      subtotal: 25,
      total: 25,
    });

    expect(parsed).toMatchObject({
      currency: "ARS",
      deliveryType: OrderDeliveryType.SHIPPING,
      discountAmount: 0,
      paymentMethodId: "manual",
      paymentStatus: PaymentStatus.PENDING,
      shippingCost: 0,
    });
    expect(parsed.items).toEqual([expect.objectContaining({
      attributes: {},
      lineSubtotal: 25,
      productId: "product-1",
      productName: "Product one",
      quantity: 2,
      sku: "product-1",
      snapshot: {},
      unitPrice: 12.5,
    })]);
  });

  it("requires valid sale item, payment, and command input", () => {
    expect(createManualSaleSchema.safeParse({
      customer: { email: "invalid", firstName: "A", lastName: "Customer" },
      items: [],
      subtotal: -1,
      total: 0,
    }).success).toBe(false);
    expect(createManualSaleSchema.safeParse({
      customer: { email: "customer@example.com", firstName: "Ada", lastName: "Lovelace" },
      items: [{ productId: "product-1", quantity: 1, unitPrice: 10 }],
      subtotal: 10,
      total: 10,
    }).success).toBe(false);
    expect(shipSaleSchema.safeParse({ carrier: "Carrier", trackingCode: "TRACK-1", unknown: true }).success).toBe(false);
    expect(cancelSaleSchema.safeParse({ cancellationReason: "Reason" }).success).toBe(false);

    expect(salesCommandSchema.parse({ payload: {}, type: SALE_COMMAND.PACK })).toEqual({
      payload: {},
      type: SALE_COMMAND.PACK,
    });
    expect(salesCommandSchema.safeParse({ payload: { unexpected: true }, type: SALE_COMMAND.PACK }).success).toBe(false);
  });

  it("requires one consistent source identifier for conversion", () => {
    expect(convertOrderToSaleSchema.parse({ orderId: "order-1" })).toEqual({ orderId: "order-1" });
    expect(convertOrderToSaleSchema.parse({ sourceOrderId: "order-1" })).toEqual({ sourceOrderId: "order-1" });
    expect(convertOrderToSaleSchema.safeParse({}).success).toBe(false);
    expect(convertOrderToSaleSchema.safeParse({ orderId: "order-1", sourceOrderId: "order-2" }).success).toBe(false);
  });
});
