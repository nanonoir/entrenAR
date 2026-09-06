import { Injectable } from "@nestjs/common";

import type { StatisticsQueryDto } from "./dto/statistics-openapi.dto";
import { STATISTICS_CALCULATED_TREND, STATISTICS_METRIC_FORMAT, type StatisticsCalculatedTrend, type StatisticsMetricFormat, mapCouponsResponse, mapCustomersResponse, mapMetadata, mapOverviewResponse, mapProductsResponse, mapSalesResponse, type StatisticsMetricInput } from "./statistics.mapper";
import { StatisticsRepository, type CouponStats, type SalesTimeSeriesPoint, type TopCustomerAggregate } from "./statistics.repository";
import { STATISTICS_PERIOD, StatisticsQuerySchema, type StatisticsCouponsResponse, type StatisticsCustomersResponse, type StatisticsOverviewResponse, type StatisticsProductsResponse, type StatisticsSalesResponse, type StatisticsQuery } from "./statistics.schemas";

const DAY_MS = 86_400_000;
const DEFAULT_LIMIT = 10;

export interface StatisticsDateWindow { from: Date; to: Date; }
export interface StatisticsComparisonWindows { current: StatisticsDateWindow; previous: StatisticsDateWindow; allTime: boolean; query: StatisticsQuery; }

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function calculateTrend(current: number, previous: number): StatisticsCalculatedTrend {
  if (current > previous) return STATISTICS_CALCULATED_TREND.UP;
  if (current < previous) return STATISTICS_CALCULATED_TREND.DOWN;
  return STATISTICS_CALCULATED_TREND.NEUTRAL;
}

export function calculateAverageTicket(revenue: number, orderCount: number): number { return orderCount > 0 ? revenue / orderCount : 0; }
export function calculateConversionRate(orders: number, carts: number): number { return carts > 0 ? (orders / carts) * 100 : 0; }

export function resolveStatisticsWindows(query: StatisticsQueryDto, referenceDate = new Date()): StatisticsComparisonWindows {
  const parsed = StatisticsQuerySchema.parse(query);
  if (Number.isNaN(referenceDate.getTime())) throw new RangeError("referenceDate must be valid.");
  const reference = new Date(referenceDate);
  const current = resolveCurrentWindow(parsed, reference);
  if (parsed.period === STATISTICS_PERIOD.ALL_TIME) return { current, previous: current, allTime: true, query: parsed };
  const duration = current.to.getTime() - current.from.getTime();
  const previousTo = new Date(current.from.getTime() - 1);
  return { current, previous: { from: new Date(previousTo.getTime() - duration), to: previousTo }, allTime: false, query: parsed };
}

@Injectable()
export class StatisticsService {
  constructor(private readonly statisticsRepository: StatisticsRepository) {}

  async getOverview(query: StatisticsQueryDto): Promise<StatisticsOverviewResponse> {
    const context = this.context(query);
    const pair = await this.loadPair(context, (window) => this.statisticsRepository.getOverviewKpis(window.from, window.to));
    return mapOverviewResponse(this.metadata(context), {
      revenue: this.metric(pair.current.grossRevenue, pair.previous.grossRevenue, STATISTICS_METRIC_FORMAT.CURRENCY),
      orders: this.metric(pair.current.paidOrders, pair.previous.paidOrders, STATISTICS_METRIC_FORMAT.INTEGER),
      averageTicket: this.metric(calculateAverageTicket(pair.current.grossRevenue, pair.current.paidOrders), calculateAverageTicket(pair.previous.grossRevenue, pair.previous.paidOrders), STATISTICS_METRIC_FORMAT.CURRENCY),
      conversionRate: this.metric(calculateConversionRate(pair.current.paidOrders, pair.current.checkoutSessions), calculateConversionRate(pair.previous.paidOrders, pair.previous.checkoutSessions), STATISTICS_METRIC_FORMAT.PERCENTAGE),
    });
  }

  async getSales(query: StatisticsQueryDto): Promise<StatisticsSalesResponse> {
    const context = this.context(query);
    const pair = await this.loadPair(context, (window) => this.statisticsRepository.getSalesAggregates(window.from, window.to));
    return mapSalesResponse(this.metadata(context), {
      revenue: this.metric(pair.current.revenue, pair.previous.revenue, STATISTICS_METRIC_FORMAT.CURRENCY),
      orders: this.metric(pair.current.ordersCount, pair.previous.ordersCount, STATISTICS_METRIC_FORMAT.INTEGER),
      averageTicket: this.metric(calculateAverageTicket(pair.current.revenue, pair.current.ordersCount), calculateAverageTicket(pair.previous.revenue, pair.previous.ordersCount), STATISTICS_METRIC_FORMAT.CURRENCY),
    }, pair.current, await this.statisticsRepository.getTopProvinces(context.current.from, context.current.to, this.limit(context)));
  }

  async getProducts(query: StatisticsQueryDto): Promise<StatisticsProductsResponse> {
    const context = this.context(query);
    const seriesPair = await this.loadPair(context, (window) => this.statisticsRepository.getSalesTimeSeries(window.from, window.to, context.query.interval));
    const [products, alerts] = await Promise.all([this.statisticsRepository.getTopProducts(context.current.from, context.current.to, this.limit(context)), this.statisticsRepository.getInventoryAlerts()]);
    const currentTotals = totals(seriesPair.current);
    const previousTotals = totals(seriesPair.previous);
    return mapProductsResponse(this.metadata(context), {
      unitsSold: this.metric(currentTotals.unitsSold, previousTotals.unitsSold, STATISTICS_METRIC_FORMAT.INTEGER),
      revenue: this.metric(currentTotals.revenue, previousTotals.revenue, STATISTICS_METRIC_FORMAT.CURRENCY),
    }, products, seriesPair.current, alerts);
  }

  async getCustomers(query: StatisticsQueryDto): Promise<StatisticsCustomersResponse> {
    const context = this.context(query);
    const pair = await this.loadPair(context, (window) => this.statisticsRepository.getTopCustomers(window.from, window.to, this.limit(context)));
    const currentTotals = customerTotals(pair.current);
    const previousTotals = customerTotals(pair.previous);
    return mapCustomersResponse(this.metadata(context), {
      totalSpent: this.metric(currentTotals.totalSpent, previousTotals.totalSpent, STATISTICS_METRIC_FORMAT.CURRENCY),
      orders: this.metric(currentTotals.orders, previousTotals.orders, STATISTICS_METRIC_FORMAT.INTEGER),
    }, pair.current);
  }

  async getCoupons(query: StatisticsQueryDto): Promise<StatisticsCouponsResponse> {
    const context = this.context(query);
    const pair = await this.loadPair(context, (window) => this.statisticsRepository.getCouponStats(window.from, window.to));
    const currentTotals = couponTotals(pair.current);
    const previousTotals = couponTotals(pair.previous);
    return mapCouponsResponse(this.metadata(context), {
      revenue: this.metric(currentTotals.revenue, previousTotals.revenue, STATISTICS_METRIC_FORMAT.CURRENCY),
      orders: this.metric(currentTotals.orders, previousTotals.orders, STATISTICS_METRIC_FORMAT.INTEGER),
    }, pair.current);
  }

  private context(query: StatisticsQueryDto): StatisticsComparisonWindows { return resolveStatisticsWindows(query); }
  private metadata(context: StatisticsComparisonWindows) { return mapMetadata(context.query.period, context.current, context.previous); }
  private limit(context: StatisticsComparisonWindows): number { return context.query.limit ?? DEFAULT_LIMIT; }
  private metric(current: number, previous: number, format: StatisticsMetricFormat): StatisticsMetricInput { return { current, previous, variationPct: calculatePercentageChange(current, previous), trend: calculateTrend(current, previous), format }; }
  private async loadPair<T>(context: StatisticsComparisonWindows, loader: (window: StatisticsDateWindow) => Promise<T>): Promise<{ current: T; previous: T }> {
    const current = await loader(context.current);
    if (context.allTime) return { current, previous: current };
    return { current, previous: await loader(context.previous) };
  }
}

function resolveCurrentWindow(query: StatisticsQuery, reference: Date): StatisticsDateWindow {
  const end = endOfDay(reference);
  switch (query.period) {
    case STATISTICS_PERIOD.TODAY: return { from: startOfDay(reference), to: end };
    case STATISTICS_PERIOD.CURRENT_WEEK: return { from: addDays(startOfDay(reference), -((reference.getUTCDay() + 6) % 7)), to: end };
    case STATISTICS_PERIOD.LAST_30_DAYS: return { from: addDays(startOfDay(reference), -29), to: end };
    case STATISTICS_PERIOD.LAST_90_DAYS: return { from: addDays(startOfDay(reference), -89), to: end };
    case STATISTICS_PERIOD.LAST_12_MONTHS: return { from: startOfMonth(addMonths(reference, -11)), to: end };
    case STATISTICS_PERIOD.CUSTOM: return { from: new Date(`${query.from}T00:00:00.000Z`), to: new Date(`${query.to}T23:59:59.999Z`) };
    case STATISTICS_PERIOD.ALL_TIME: return { from: new Date(0), to: end };
  }
}

function totals(points: SalesTimeSeriesPoint[]) { return points.reduce((result, point) => ({ unitsSold: result.unitsSold + point.unitsSold, revenue: result.revenue + point.revenue }), { unitsSold: 0, revenue: 0 }); }
function customerTotals(customers: TopCustomerAggregate[]) { return customers.reduce((result, customer) => ({ orders: result.orders + customer.ordersCount, totalSpent: result.totalSpent + customer.totalSpent }), { orders: 0, totalSpent: 0 }); }
function couponTotals(stats: CouponStats) { return { orders: stats.comparison.withCoupon.orders + stats.comparison.withoutCoupon.orders, revenue: stats.comparison.withCoupon.revenue + stats.comparison.withoutCoupon.revenue }; }
function startOfDay(value: Date): Date { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())); }
function endOfDay(value: Date): Date { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999)); }
function startOfMonth(value: Date): Date { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)); }
function addDays(value: Date, days: number): Date { return new Date(value.getTime() + days * DAY_MS); }
function addMonths(value: Date, months: number): Date { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, value.getUTCDate(), value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), value.getUTCMilliseconds())); }
