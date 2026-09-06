import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { OrderStatus, PaymentStatus, StockMode, type OrderDeliveryType } from "../../generated/prisma/enums";
import type { StatisticsInterval } from "./statistics.schemas";

const LOW_STOCK_THRESHOLD = 5;
const UNSPECIFIED_PROVINCE = "UNSPECIFIED";
const TOP_COUPONS_LIMIT = 10;
export const STATISTICS_INVENTORY_ALERT_TYPE = { OUT_OF_STOCK: "OUT_OF_STOCK", LOW_STOCK: "LOW_STOCK" } as const;
export type StatisticsInventoryAlertType = (typeof STATISTICS_INVENTORY_ALERT_TYPE)[keyof typeof STATISTICS_INVENTORY_ALERT_TYPE];

export interface StatisticsPaymentMethodAggregate { method: string; revenue: number; }
export interface StatisticsShippingAggregate { type: OrderDeliveryType; orders: number; }
export interface StatisticsPaymentStatusAggregate { status: PaymentStatus; count: number; }
export interface SalesAggregates {
  revenue: number;
  ordersCount: number;
  paymentMethods: StatisticsPaymentMethodAggregate[];
  shipping: StatisticsShippingAggregate[];
  paymentStatuses: StatisticsPaymentStatusAggregate[];
}

export interface SalesTimeSeriesPoint { bucket: Date; unitsSold: number; revenue: number; }
export interface TopProductAggregate {
  id: string;
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
  stockAvailable: number;
  stockReserved: number;
}
export interface InventoryAlertItem { id: string; name: string; stockAvailable: number; stockReserved: number; }
export interface InventoryAlertGroup { type: StatisticsInventoryAlertType; items: InventoryAlertItem[]; }
export interface TopCustomerAggregate { id: string; name: string; email: string; ordersCount: number; totalSpent: number; }
export interface TopProvinceAggregate { province: string; orders: number; revenue: number; }
export interface CouponAggregate { code: string; redemptions: number; revenue: number; }
export interface CouponComparison { orders: number; revenue: number; }
export interface CouponStats {
  topCoupons: CouponAggregate[];
  comparison: { withCoupon: CouponComparison; withoutCoupon: CouponComparison };
}
export interface OverviewKpis { paidOrders: number; grossRevenue: number; checkoutSessions: number; }

interface RawSalesTimeSeriesRow { bucket: unknown; unitsSold: unknown; revenue: unknown; }
interface RawProvinceRow { province: unknown; orders: unknown; revenue: unknown; }

@Injectable()
export class StatisticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesAggregates(startDate: Date, endDate: Date): Promise<SalesAggregates> {
    assertDateRange(startDate, endDate);
    const qualifyingWhere = qualifyingOrderWhere(startDate, endDate);
    const [totals, paymentMethods, shipping, paymentStatuses] = await Promise.all([
      this.prisma.order.aggregate({ where: qualifyingWhere, _count: { _all: true }, _sum: { total: true } }),
      this.prisma.orderPayment.groupBy({
        by: ["paymentMethodId"],
        where: { order: { is: qualifyingWhere }, status: PaymentStatus.PAID },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      }),
      this.prisma.order.groupBy({
        by: ["deliveryType"],
        where: qualifyingWhere,
        _count: { _all: true },
        orderBy: { deliveryType: "asc" },
      }),
      this.prisma.orderPayment.groupBy({
        by: ["status"],
        where: { order: { is: { createdAt: dateRange(startDate, endDate) } } },
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
    ]);

    return {
      revenue: toNumber(totals._sum?.total),
      ordersCount: totals._count?._all ?? 0,
      paymentMethods: paymentMethods.map((row) => ({ method: row.paymentMethodId, revenue: toNumber(row._sum.amount) })),
      shipping: shipping.map((row) => ({ type: row.deliveryType, orders: row._count._all })),
      paymentStatuses: paymentStatuses.map((row) => ({ status: row.status, count: row._count._all })),
    };
  }

  async getSalesTimeSeries(startDate: Date, endDate: Date, interval: StatisticsInterval): Promise<SalesTimeSeriesPoint[]> {
    assertDateRange(startDate, endDate);
    const rows = await this.prisma.$queryRaw<RawSalesTimeSeriesRow[]>(Prisma.sql`
      SELECT date_trunc(${interval}, o."createdAt") AS "bucket",
             COALESCE(SUM(oi."quantity"), 0)::int AS "unitsSold",
             COALESCE(SUM(oi."lineSubtotal"), 0)::numeric AS "revenue"
      FROM "Order" o
      INNER JOIN "OrderPayment" op ON op."orderId" = o."id"
      INNER JOIN "OrderItem" oi ON oi."orderId" = o."id"
      WHERE o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
        AND o."status" <> ${OrderStatus.CANCELLED}
        AND op."status" = ${PaymentStatus.PAID}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return rows.map((row) => ({ bucket: toDate(row.bucket), unitsSold: toNumber(row.unitsSold), revenue: toNumber(row.revenue) }));
  }

  async getTopProducts(startDate: Date, endDate: Date, limit: number): Promise<TopProductAggregate[]> {
    assertDateRange(startDate, endDate);
    const groups = await this.prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { is: qualifyingOrderWhere(startDate, endDate) } },
      _sum: { quantity: true, lineSubtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: normalizeLimit(limit),
    });
    if (groups.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: groups.map((group) => group.productId) } },
      select: {
        id: true,
        name: true,
        quantity: true,
        categories: {
          orderBy: { categoryId: "asc" },
          take: 1,
          select: { category: { select: { name: true } } },
        },
      },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));

    return groups.flatMap((group) => {
      const product = productsById.get(group.productId);
      if (!product) return [];
      return [{
        id: product.id,
        name: product.name,
        category: product.categories[0]?.category.name ?? "Uncategorized",
        unitsSold: group._sum.quantity ?? 0,
        revenue: toNumber(group._sum.lineSubtotal),
        stockAvailable: Math.max(product.quantity ?? 0, 0),
        stockReserved: 0,
      }];
    });
  }

  async getInventoryAlerts(): Promise<InventoryAlertGroup[]> {
    const products = await this.prisma.product.findMany({
      where: {
        stockMode: StockMode.TRACKED,
        OR: [{ quantity: { lte: 0 } }, { quantity: { gt: 0, lte: LOW_STOCK_THRESHOLD } }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, quantity: true },
    });
    const items = products.map((product) => ({
      id: product.id,
      name: product.name,
      stockAvailable: Math.max(product.quantity ?? 0, 0),
      stockReserved: 0,
    }));
    return [
      { type: STATISTICS_INVENTORY_ALERT_TYPE.OUT_OF_STOCK, items: items.filter((item) => item.stockAvailable === 0) },
      { type: STATISTICS_INVENTORY_ALERT_TYPE.LOW_STOCK, items: items.filter((item) => item.stockAvailable > 0 && item.stockAvailable <= LOW_STOCK_THRESHOLD) },
    ];
  }

  async getTopCustomers(startDate: Date, endDate: Date, limit: number): Promise<TopCustomerAggregate[]> {
    assertDateRange(startDate, endDate);
    const groups = await this.prisma.order.groupBy({
      by: ["customerId"],
      where: { ...qualifyingOrderWhere(startDate, endDate), customerId: { not: null } },
      _count: { _all: true },
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
      take: normalizeLimit(limit),
    });
    const customerIds = groups.map((group) => group.customerId).filter((id): id is string => id !== null);
    if (customerIds.length === 0) return [];

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, fullName: true, email: true, user: { select: { email: true } } },
    });
    const customersById = new Map(customers.map((customer) => [customer.id, customer]));
    return groups.flatMap((group) => {
      if (!group.customerId) return [];
      const customer = customersById.get(group.customerId);
      if (!customer) return [];
      return [{
        id: customer.id,
        name: customer.fullName,
        email: customer.email ?? customer.user?.email ?? "",
        ordersCount: group._count._all,
        totalSpent: toNumber(group._sum.total),
      }];
    });
  }

  async getTopProvinces(startDate: Date, endDate: Date, limit: number): Promise<TopProvinceAggregate[]> {
    assertDateRange(startDate, endDate);
    const rows = await this.prisma.$queryRaw<RawProvinceRow[]>(Prisma.sql`
      SELECT COALESCE(
               o."shippingAddressSnapshot"->>'province',
               o."shippingAddressSnapshot"->>'provinceOrState',
               ${UNSPECIFIED_PROVINCE}
             ) AS "province",
             COUNT(*)::int AS "orders",
             COALESCE(SUM(o."total"), 0)::numeric AS "revenue"
      FROM "Order" o
      INNER JOIN "OrderPayment" op ON op."orderId" = o."id"
      WHERE o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
        AND o."status" <> ${OrderStatus.CANCELLED}
        AND op."status" = ${PaymentStatus.PAID}
      GROUP BY 1
      ORDER BY "revenue" DESC, "province" ASC
      LIMIT ${normalizeLimit(limit)}
    `);
    return rows.map((row) => ({ province: String(row.province ?? UNSPECIFIED_PROVINCE), orders: toNumber(row.orders), revenue: toNumber(row.revenue) }));
  }

  async getCouponStats(startDate: Date, endDate: Date): Promise<CouponStats> {
    assertDateRange(startDate, endDate);
    const qualifyingWhere = qualifyingOrderWhere(startDate, endDate);
    const [couponGroups, orderGroups] = await Promise.all([
      this.prisma.couponRedemption.groupBy({
        by: ["couponCode"],
        where: { order: { is: qualifyingWhere } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: TOP_COUPONS_LIMIT,
      }),
      this.prisma.order.groupBy({
        by: ["couponCode"],
        where: qualifyingWhere,
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);
    const revenueByCoupon = new Map(orderGroups.map((group) => [group.couponCode, toNumber(group._sum.total)]));
    const comparison = { withCoupon: { orders: 0, revenue: 0 }, withoutCoupon: { orders: 0, revenue: 0 } };
    for (const group of orderGroups) {
      const target = group.couponCode === null ? comparison.withoutCoupon : comparison.withCoupon;
      target.orders += group._count._all;
      target.revenue += toNumber(group._sum.total);
    }
    return {
      topCoupons: couponGroups.map((group) => ({ code: group.couponCode, redemptions: group._count.id, revenue: revenueByCoupon.get(group.couponCode) ?? 0 })),
      comparison,
    };
  }

  async getOverviewKpis(startDate: Date, endDate: Date): Promise<OverviewKpis> {
    assertDateRange(startDate, endDate);
    const [sales, checkoutSessions] = await Promise.all([
      this.prisma.order.aggregate({ where: qualifyingOrderWhere(startDate, endDate), _count: { _all: true }, _sum: { total: true } }),
      this.prisma.checkoutSession.count({ where: { createdAt: dateRange(startDate, endDate) } }),
    ]);
    return { paidOrders: sales._count?._all ?? 0, grossRevenue: toNumber(sales._sum?.total), checkoutSessions };
  }
}

export function qualifyingOrderWhere(startDate: Date, endDate: Date): Prisma.OrderWhereInput {
  return {
    createdAt: dateRange(startDate, endDate),
    payment: { is: { status: PaymentStatus.PAID } },
    status: { not: OrderStatus.CANCELLED },
  };
}

function dateRange(startDate: Date, endDate: Date) {
  return { gte: startDate, lte: endDate };
}

function assertDateRange(startDate: Date, endDate: Date): void {
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    throw new RangeError("startDate must be before or equal to endDate.");
  }
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) throw new RangeError("limit must be a positive number.");
  return Math.max(1, Math.trunc(limit));
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return finiteNumber(Number(value));
  if (value && typeof value === "object" && "toString" in value) return finiteNumber(Number(value.toString()));
  return 0;
}

function finiteNumber(value: number): number { return Number.isFinite(value) ? value : 0; }

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}
