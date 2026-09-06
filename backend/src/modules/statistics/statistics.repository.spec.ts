import { PrismaService } from "../../common/prisma/prisma.service";
import { PaymentStatus, StockMode } from "../../generated/prisma/enums";
import {
  qualifyingOrderWhere,
  StatisticsRepository,
} from "./statistics.repository";

const startDate = new Date("2026-09-01T00:00:00.000Z");
const endDate = new Date("2026-09-30T23:59:59.999Z");

describe("StatisticsRepository", () => {
  it("aggregates qualifying sales and preserves each breakdown", async () => {
    const harness = createHarness();
    harness.prisma.order.aggregate.mockResolvedValue({ _count: { _all: 2 }, _sum: { total: "250.50" } });
    harness.prisma.orderPayment.groupBy
      .mockResolvedValueOnce([{ paymentMethodId: "bank-transfer", _sum: { amount: "150.50" } }])
      .mockResolvedValueOnce([{ status: PaymentStatus.PAID, _count: { _all: 2 } }]);
    harness.prisma.order.groupBy.mockResolvedValue([{ deliveryType: "SHIPPING", _count: { _all: 2 } }]);

    await expect(harness.repository.getSalesAggregates(startDate, endDate)).resolves.toEqual({
      revenue: 250.5,
      ordersCount: 2,
      paymentMethods: [{ method: "bank-transfer", revenue: 150.5 }],
      shipping: [{ type: "SHIPPING", orders: 2 }],
      paymentStatuses: [{ status: PaymentStatus.PAID, count: 2 }],
    });
    expect(harness.prisma.order.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: qualifyingOrderWhere(startDate, endDate) }));
    expect(harness.prisma.orderPayment.groupBy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { order: { is: qualifyingOrderWhere(startDate, endDate) }, status: PaymentStatus.PAID },
    }));
    expect(harness.prisma.order.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: qualifyingOrderWhere(startDate, endDate) }));
  });

  it("uses a parameterized raw query for time-series buckets and transforms numeric values", async () => {
    const harness = createHarness();
    harness.prisma.$queryRaw.mockResolvedValue([{ bucket: new Date("2026-09-01T00:00:00.000Z"), unitsSold: "4", revenue: "99.50" }]);

    await expect(harness.repository.getSalesTimeSeries(startDate, endDate, "week")).resolves.toEqual([
      { bucket: new Date("2026-09-01T00:00:00.000Z"), unitsSold: 4, revenue: 99.5 },
    ]);
    expect(harness.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const query = harness.prisma.$queryRaw.mock.calls[0][0] as { values?: unknown[] };
    expect(query.values).toEqual(expect.arrayContaining(["week", startDate, endDate]));
  });

  it("ranks products from paid order items and joins current product metadata", async () => {
    const harness = createHarness();
    harness.prisma.orderItem.groupBy.mockResolvedValue([{ productId: "product-1", _sum: { quantity: 4, lineSubtotal: "120" } }]);
    harness.prisma.product.findMany.mockResolvedValue([{
      id: "product-1", name: "Protein", quantity: 7, categories: [{ category: { name: "Supplements" } }],
    }]);

    await expect(harness.repository.getTopProducts(startDate, endDate, 5)).resolves.toEqual([{
      id: "product-1", name: "Protein", category: "Supplements", unitsSold: 4, revenue: 120, stockAvailable: 7, stockReserved: 0,
    }]);
    expect(harness.prisma.orderItem.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      take: 5,
      where: { order: { is: qualifyingOrderWhere(startDate, endDate) } },
    }));
  });

  it("returns tracked inventory in stable OUT_OF_STOCK and LOW_STOCK groups", async () => {
    const harness = createHarness();
    harness.prisma.product.findMany.mockResolvedValue([
      { id: "product-1", name: "Empty", quantity: 0 },
      { id: "product-2", name: "Low", quantity: 3 },
    ]);

    await expect(harness.repository.getInventoryAlerts()).resolves.toEqual([
      { type: "OUT_OF_STOCK", items: [{ id: "product-1", name: "Empty", stockAvailable: 0, stockReserved: 0 }] },
      { type: "LOW_STOCK", items: [{ id: "product-2", name: "Low", stockAvailable: 3, stockReserved: 0 }] },
    ]);
    expect(harness.prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { stockMode: StockMode.TRACKED, OR: [{ quantity: { lte: 0 } }, { quantity: { gt: 0, lte: 5 } }] },
    }));
  });

  it("ranks customers by qualifying spend and maps customer identity", async () => {
    const harness = createHarness();
    harness.prisma.order.groupBy.mockResolvedValue([{ customerId: "customer-1", _count: { _all: 3 }, _sum: { total: "450" } }]);
    harness.prisma.customer.findMany.mockResolvedValue([{
      id: "customer-1", fullName: "Camila Pérez", email: null, user: { email: "camila@example.com" },
    }]);

    await expect(harness.repository.getTopCustomers(startDate, endDate, 3)).resolves.toEqual([{
      id: "customer-1", name: "Camila Pérez", email: "camila@example.com", ordersCount: 3, totalSpent: 450,
    }]);
    expect(harness.prisma.order.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      take: 3,
      where: expect.objectContaining({ customerId: { not: null } }),
    }));
  });

  it("extracts current and legacy province keys through parameterized SQL", async () => {
    const harness = createHarness();
    harness.prisma.$queryRaw.mockResolvedValue([{ province: "Córdoba", orders: "2", revenue: "300.25" }]);

    await expect(harness.repository.getTopProvinces(startDate, endDate, 10)).resolves.toEqual([
      { province: "Córdoba", orders: 2, revenue: 300.25 },
    ]);
    const query = harness.prisma.$queryRaw.mock.calls[0][0] as { values?: unknown[] };
    expect(query.values).toEqual(expect.arrayContaining([startDate, endDate, 10, "UNSPECIFIED"]));
  });

  it("combines coupon redemptions with qualifying order revenue and cohorts", async () => {
    const harness = createHarness();
    harness.prisma.couponRedemption.groupBy.mockResolvedValue([{ couponCode: "SAVE10", _count: { id: 2 } }]);
    harness.prisma.order.groupBy.mockResolvedValue([
      { couponCode: "SAVE10", _count: { _all: 2 }, _sum: { total: "200" } },
      { couponCode: null, _count: { _all: 1 }, _sum: { total: "75" } },
    ]);

    await expect(harness.repository.getCouponStats(startDate, endDate)).resolves.toEqual({
      topCoupons: [{ code: "SAVE10", redemptions: 2, revenue: 200 }],
      comparison: { withCoupon: { orders: 2, revenue: 200 }, withoutCoupon: { orders: 1, revenue: 75 } },
    });
    expect(harness.prisma.couponRedemption.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { order: { is: qualifyingOrderWhere(startDate, endDate) } },
    }));
  });

  it("returns overview KPIs and propagates database failures", async () => {
    const harness = createHarness();
    harness.prisma.order.aggregate.mockResolvedValue({ _count: { _all: 4 }, _sum: { total: "500" } });
    harness.prisma.checkoutSession.count.mockResolvedValue(9);
    await expect(harness.repository.getOverviewKpis(startDate, endDate)).resolves.toEqual({ paidOrders: 4, grossRevenue: 500, checkoutSessions: 9 });
    expect(harness.prisma.checkoutSession.count).toHaveBeenCalledWith({ where: { createdAt: { gte: startDate, lte: endDate } } });

    const error = new Error("database unavailable");
    harness.prisma.order.aggregate.mockRejectedValue(error);
    await expect(harness.repository.getOverviewKpis(startDate, endDate)).rejects.toBe(error);
  });

  it("rejects invalid date ranges before touching Prisma", async () => {
    const harness = createHarness();
    await expect(harness.repository.getSalesAggregates(endDate, startDate)).rejects.toThrow(RangeError);
    expect(harness.prisma.order.aggregate).not.toHaveBeenCalled();
  });
});

interface PrismaHarness {
  $queryRaw: jest.Mock;
  couponRedemption: { groupBy: jest.Mock };
  checkoutSession: { count: jest.Mock };
  customer: { findMany: jest.Mock };
  order: { aggregate: jest.Mock; groupBy: jest.Mock };
  orderItem: { groupBy: jest.Mock };
  orderPayment: { groupBy: jest.Mock };
  product: { findMany: jest.Mock };
}

function createHarness() {
  const prisma = {
    $queryRaw: jest.fn(),
    couponRedemption: { groupBy: jest.fn() },
    checkoutSession: { count: jest.fn() },
    customer: { findMany: jest.fn() },
    order: { aggregate: jest.fn(), groupBy: jest.fn() },
    orderItem: { groupBy: jest.fn() },
    orderPayment: { groupBy: jest.fn() },
    product: { findMany: jest.fn() },
  } as unknown as PrismaHarness;
  return { prisma, repository: new StatisticsRepository(prisma as unknown as PrismaService) };
}
