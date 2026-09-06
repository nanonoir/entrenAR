import { StatisticsCouponsResponseSchema, StatisticsCustomersResponseSchema, StatisticsOverviewResponseSchema, StatisticsProductsResponseSchema, StatisticsSalesResponseSchema } from "./statistics.schemas";
import { STATISTICS_CALCULATED_TREND, STATISTICS_METRIC_FORMAT, formatCurrency, formatInteger, formatPercentage, mapCouponsResponse, mapCustomersResponse, mapMetadata, mapMetric, mapOverviewResponse, mapProductsResponse, mapSalesResponse } from "./statistics.mapper";

const metadata = mapMetadata("current-week", { from: new Date("2026-09-01T00:00:00.000Z"), to: new Date("2026-09-07T23:59:59.999Z") }, { from: new Date("2026-08-25T00:00:00.000Z"), to: new Date("2026-08-31T23:59:59.999Z") });
const metric = { current: 100, previous: 80, variationPct: 25, trend: STATISTICS_CALCULATED_TREND.UP } as const;

describe("statistics mapper", () => {
  it("formats currency, integer, percentage, and neutral trend values safely", () => {
    expect(formatCurrency(12.345)).toBe(12.35);
    expect(formatCurrency(Number.NaN)).toBe(0);
    expect(formatInteger(12.9)).toBe(12);
    expect(formatInteger(-2)).toBe(0);
    expect(formatPercentage(-12.345)).toBe(-12.35);
    expect(mapMetric({ ...metric, trend: STATISTICS_CALCULATED_TREND.NEUTRAL, format: STATISTICS_METRIC_FORMAT.INTEGER })).toEqual({ current: 100, previous: 80, variationPct: 25, trend: "flat" });
  });

  it("maps overview and sales aggregates into schema-compliant DTOs", () => {
    const overview = mapOverviewResponse(metadata, { revenue: { ...metric, format: STATISTICS_METRIC_FORMAT.CURRENCY } });
    const sales = mapSalesResponse(metadata, { revenue: { ...metric, format: STATISTICS_METRIC_FORMAT.CURRENCY } }, { revenue: 100, ordersCount: 2, paymentMethods: [{ method: "card", revenue: 99.999 }], shipping: [{ type: "SHIPPING", orders: 2 }], paymentStatuses: [{ status: "PAID", count: 2 }] }, [{ province: "Buenos Aires", orders: 2, revenue: 100 }]);
    expect(StatisticsOverviewResponseSchema.safeParse(overview).success).toBe(true);
    expect(StatisticsSalesResponseSchema.safeParse(sales).success).toBe(true);
    expect(sales.data.paymentMethods[0]).toEqual({ method: "card", revenue: 100 });
    expect(sales.data.provinces[0]).toEqual({ province: "Buenos Aires", orders: 2, revenue: 100 });
  });

  it("maps products, customers, and coupons while repairing empty edge values", () => {
    const products = mapProductsResponse(metadata, { unitsSold: { ...metric, format: STATISTICS_METRIC_FORMAT.INTEGER } }, [{ id: "p1", name: "Protein", category: "Supplements", unitsSold: 2, revenue: 49.995, stockAvailable: 4, stockReserved: 0 }], [{ bucket: new Date("2026-09-01T00:00:00.000Z"), unitsSold: 2, revenue: 49.995 }], [{ type: "LOW_STOCK", items: [{ id: "p1", name: "Protein", stockAvailable: 4, stockReserved: 0 }] }]);
    const customers = mapCustomersResponse(metadata, { totalSpent: metric }, [{ id: "c1", name: "Camila", email: "invalid", ordersCount: 2, totalSpent: 100 }]);
    const coupons = mapCouponsResponse(metadata, { revenue: metric }, { topCoupons: [{ code: "SAVE10", redemptions: 2, revenue: 100 }], comparison: { withCoupon: { orders: 1, revenue: 100 }, withoutCoupon: { orders: 2, revenue: 200 } } });
    expect(StatisticsProductsResponseSchema.safeParse(products).success).toBe(true);
    expect(StatisticsCustomersResponseSchema.safeParse(customers).success).toBe(true);
    expect(StatisticsCouponsResponseSchema.safeParse(coupons).success).toBe(true);
    expect(customers.data.topCustomers[0]?.email).toBe("unknown@example.com");
    expect(products.data.series[0]?.bucket).toBe("2026-09-01T00:00:00.000Z");
  });
});
