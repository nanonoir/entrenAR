import {
  StatisticsCouponsResponseSchema,
  StatisticsCustomersResponseSchema,
  StatisticsOverviewResponseSchema,
  StatisticsProductsResponseSchema,
  StatisticsQuerySchema,
  StatisticsSalesResponseSchema,
  STATISTICS_INTERVAL,
  STATISTICS_PERIOD,
} from "./statistics.schemas";

const metric = { current: 10, previous: 5, variationPct: 100, trend: "up" as const };
const metadata = {
  period: STATISTICS_PERIOD.CURRENT_WEEK,
  window: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-07T23:59:59.999Z" },
  comparisonWindow: { from: "2026-08-25T00:00:00.000Z", to: "2026-08-31T23:59:59.999Z" },
};

describe("statistics query schemas", () => {
  it("parses a custom query and applies the interval default", () => {
    expect(StatisticsQuerySchema.parse({ period: "custom", from: "2026-09-01", to: "2026-09-30", limit: "25" })).toEqual({
      period: "custom", from: "2026-09-01", to: "2026-09-30", limit: 25, interval: STATISTICS_INTERVAL.DAY,
    });
  });

  it("defaults the period and interval for an empty query", () => {
    expect(StatisticsQuerySchema.parse({})).toEqual({ period: STATISTICS_PERIOD.CURRENT_WEEK, interval: STATISTICS_INTERVAL.DAY });
  });

  it.each([
    { period: "yesterday" }, { period: "7d" }, { interval: "year" }, { limit: "0" }, { limit: "1.5" }, { limit: "-1" },
    { from: "2026-02-30" }, { to: "not-a-date" }, { unexpected: true },
  ])("rejects invalid query values: %o", (query) => {
    expect(StatisticsQuerySchema.safeParse(query).success).toBe(false);
  });

  it("requires both custom bounds and an ascending range", () => {
    expect(StatisticsQuerySchema.safeParse({ period: "custom", from: "2026-09-01" }).success).toBe(false);
    expect(StatisticsQuerySchema.safeParse({ period: "custom", to: "2026-09-30" }).success).toBe(false);
    expect(StatisticsQuerySchema.safeParse({ period: "custom", from: "2026-10-01", to: "2026-09-30" }).success).toBe(false);
    expect(StatisticsQuerySchema.parse({ period: "today", from: "2026-09-01", to: "2026-09-01" })).toMatchObject({ period: "today" });
  });
});

describe("statistics response schemas", () => {
  const responses = {
    overview: { ok: true, data: { metadata, metrics: { revenue: metric } } },
    sales: { ok: true, data: { metadata, metrics: { revenue: metric }, paymentStatuses: [], paymentMethods: [], shipping: [], provinces: [] } },
    products: { ok: true, data: { metadata, metrics: { revenue: metric }, topProducts: [], series: [], inventoryAlerts: [] } },
    customers: { ok: true, data: { metadata, metrics: { totalSpent: metric }, topCustomers: [] } },
    coupons: { ok: true, data: { metadata, metrics: { revenue: metric }, topCoupons: [], comparison: { withCoupon: { orders: 1, revenue: 10 }, withoutCoupon: { orders: 2, revenue: 20 } } } },
  };

  it("accepts every success envelope and preserves metadata", () => {
    const parsed = [
      StatisticsOverviewResponseSchema.parse(responses.overview), StatisticsSalesResponseSchema.parse(responses.sales),
      StatisticsProductsResponseSchema.parse(responses.products), StatisticsCustomersResponseSchema.parse(responses.customers),
      StatisticsCouponsResponseSchema.parse(responses.coupons),
    ];
    expect(parsed.every((response) => response.ok)).toBe(true);
    expect(parsed.map((response) => response.data.metadata.period)).toEqual(Array(5).fill(STATISTICS_PERIOD.CURRENT_WEEK));
  });

  it("rejects non-success envelopes and incomplete metadata", () => {
    expect(StatisticsOverviewResponseSchema.safeParse({ ok: false, data: responses.overview.data }).success).toBe(false);
    expect(StatisticsOverviewResponseSchema.safeParse({ ok: true, data: { metrics: {} } }).success).toBe(false);
    expect(StatisticsSalesResponseSchema.safeParse({ ...responses.sales, extra: true }).success).toBe(false);
  });
});
