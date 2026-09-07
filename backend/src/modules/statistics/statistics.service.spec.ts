import type { StatisticsRepository } from "./statistics.repository";
import { STATISTICS_PERIOD, type StatisticsPeriod } from "./statistics.schemas";
import { StatisticsService, calculateAverageTicket, calculateConversionRate, calculatePercentageChange, calculateTrend, resolveStatisticsWindows } from "./statistics.service";

const referenceDate = new Date("2026-09-06T12:30:00.000Z");

describe("statistics period and business math", () => {
  afterEach(() => jest.useRealTimers());

  it("resolves UTC preset and custom windows", () => {
    expect(windowIso(STATISTICS_PERIOD.TODAY)).toEqual(["2026-09-06T00:00:00.000Z", "2026-09-06T23:59:59.999Z"]);
    expect(windowIso(STATISTICS_PERIOD.CURRENT_WEEK)).toEqual(["2026-08-31T00:00:00.000Z", "2026-09-06T23:59:59.999Z"]);
    expect(windowIso(STATISTICS_PERIOD.LAST_30_DAYS)).toEqual(["2026-08-08T00:00:00.000Z", "2026-09-06T23:59:59.999Z"]);
    expect(windowIso(STATISTICS_PERIOD.LAST_90_DAYS)).toEqual(["2026-06-09T00:00:00.000Z", "2026-09-06T23:59:59.999Z"]);
    expect(windowIso(STATISTICS_PERIOD.LAST_12_MONTHS)).toEqual(["2025-10-01T00:00:00.000Z", "2026-09-06T23:59:59.999Z"]);
    expect(windowIso(STATISTICS_PERIOD.CUSTOM, { from: "2026-05-10", to: "2026-05-12" })).toEqual(["2026-05-10T00:00:00.000Z", "2026-05-12T23:59:59.999Z"]);
  });

  it("creates an equal-length immediately preceding window and isolates all-time", () => {
    const windows = resolveStatisticsWindows({ period: STATISTICS_PERIOD.LAST_30_DAYS }, referenceDate);
    expect(windows.previous).toEqual({ from: new Date("2026-07-09T00:00:00.000Z"), to: new Date("2026-08-07T23:59:59.999Z") });
    expect(windows.current.to.getTime() - windows.current.from.getTime()).toBe(windows.previous.to.getTime() - windows.previous.from.getTime());
    const allTime = resolveStatisticsWindows({ period: STATISTICS_PERIOD.ALL_TIME }, referenceDate);
    expect(allTime.allTime).toBe(true);
    expect(allTime.previous).toEqual(allTime.current);
  });

  it("keeps divisions safe and returns explicit neutral trends", () => {
    expect(calculatePercentageChange(10, 0)).toBe(100);
    expect(calculatePercentageChange(0, 0)).toBe(0);
    expect(calculateAverageTicket(100, 0)).toBe(0);
    expect(calculateConversionRate(4, 0)).toBe(0);
    expect(calculateConversionRate(4, 20)).toBe(20);
    expect(calculateTrend(10, 5)).toBe("up");
    expect(calculateTrend(5, 10)).toBe("down");
    expect(calculateTrend(5, 5)).toBe("neutral");
  });
});

describe("StatisticsService", () => {
  afterEach(() => jest.useRealTimers());

  it("maps overview KPIs and compares the current period with the previous period", async () => {
    const { repository, mocks } = createRepositoryHarness();
    mocks.getOverviewKpis.mockResolvedValueOnce({ paidOrders: 4, grossRevenue: 1_000, checkoutSessions: 20 }).mockResolvedValueOnce({ paidOrders: 2, grossRevenue: 800, checkoutSessions: 20 });
    const service = new StatisticsService(repository);
    const response = await service.getOverview({ period: STATISTICS_PERIOD.CUSTOM, from: "2026-09-01", to: "2026-09-05" });
    expect(response.ok).toBe(true);
    expect(response.data.metrics).toMatchObject({
      revenue: { current: 1_000, previous: 800, variationPct: 25, trend: "up" },
      orders: { current: 4, previous: 2, variationPct: 100, trend: "up" },
      averageTicket: { current: 250, previous: 400, variationPct: -37.5, trend: "down" },
      conversionRate: { current: 20, previous: 10, variationPct: 100, trend: "up" },
    });
    expect(mocks.getOverviewKpis).toHaveBeenCalledTimes(2);
  });

  it("coordinates the sales, products, customers, and coupon report loaders", async () => {
    const { repository, mocks } = createRepositoryHarness();
    mocks.getSalesAggregates.mockResolvedValue(salesAggregates());
    mocks.getTopProvinces.mockResolvedValue([{ province: "Buenos Aires", orders: 1, revenue: 100 }]);
    mocks.getSalesTimeSeries.mockResolvedValue([{ bucket: referenceDate, unitsSold: 2, revenue: 100 }]);
    mocks.getTopProducts.mockResolvedValue([{ id: "p1", name: "Protein", category: "Supplements", unitsSold: 2, revenue: 100, stockAvailable: 4, stockReserved: 0 }]);
    mocks.getInventoryAlerts.mockResolvedValue([{ type: "LOW_STOCK", items: [] }]);
    mocks.getTopCustomers.mockResolvedValue([{ id: "c1", name: "Camila", email: "camila@example.com", ordersCount: 1, totalSpent: 100 }]);
    mocks.getCouponStats.mockResolvedValue({ topCoupons: [], comparison: { withCoupon: { orders: 1, revenue: 100 }, withoutCoupon: { orders: 0, revenue: 0 } } });
    const service = new StatisticsService(repository);
    const query = { period: STATISTICS_PERIOD.ALL_TIME };
    await expect(service.getSales(query)).resolves.toMatchObject({ ok: true });
    await expect(service.getProducts(query)).resolves.toMatchObject({ ok: true });
    await expect(service.getCustomers(query)).resolves.toMatchObject({ ok: true });
    await expect(service.getCoupons(query)).resolves.toMatchObject({ ok: true });
    expect(mocks.getSalesAggregates).toHaveBeenCalled();
    expect(mocks.getSalesTimeSeries).toHaveBeenCalled();
    expect(mocks.getTopCustomers).toHaveBeenCalled();
    expect(mocks.getCouponStats).toHaveBeenCalled();
  });
});

function windowIso(period: StatisticsPeriod, bounds: { from?: string; to?: string } = {}) {
  return [resolveStatisticsWindows({ period, ...bounds }, referenceDate).current.from.toISOString(), resolveStatisticsWindows({ period, ...bounds }, referenceDate).current.to.toISOString()];
}

function salesAggregates() {
  return { revenue: 100, ordersCount: 1, paymentMethods: [], shipping: [], paymentStatuses: [] };
}

function createRepositoryHarness() {
  const mocks = {
    getCouponStats: jest.fn() as jest.MockedFunction<StatisticsRepository["getCouponStats"]>,
    getInventoryAlerts: jest.fn() as jest.MockedFunction<StatisticsRepository["getInventoryAlerts"]>,
    getOverviewKpis: jest.fn() as jest.MockedFunction<StatisticsRepository["getOverviewKpis"]>,
    getSalesAggregates: jest.fn() as jest.MockedFunction<StatisticsRepository["getSalesAggregates"]>,
    getSalesTimeSeries: jest.fn() as jest.MockedFunction<StatisticsRepository["getSalesTimeSeries"]>,
    getTopCustomers: jest.fn() as jest.MockedFunction<StatisticsRepository["getTopCustomers"]>,
    getTopProducts: jest.fn() as jest.MockedFunction<StatisticsRepository["getTopProducts"]>,
    getTopProvinces: jest.fn() as jest.MockedFunction<StatisticsRepository["getTopProvinces"]>,
  };
  return { mocks, repository: mocks as unknown as StatisticsRepository };
}
