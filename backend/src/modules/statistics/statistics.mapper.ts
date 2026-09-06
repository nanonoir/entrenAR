import { Injectable } from "@nestjs/common";

import { STATISTICS_TREND, type StatisticsCouponsResponse, type StatisticsCustomersResponse, type StatisticsMetric, type StatisticsMetadata, type StatisticsOverviewResponse, type StatisticsProductsResponse, type StatisticsSalesResponse, type StatisticsPeriod } from "./statistics.schemas";
import type { CouponStats, InventoryAlertGroup, SalesAggregates, SalesTimeSeriesPoint, TopCustomerAggregate, TopProductAggregate } from "./statistics.repository";

export const STATISTICS_METRIC_FORMAT = { CURRENCY: "currency", INTEGER: "integer", PERCENTAGE: "percentage" } as const;
export type StatisticsMetricFormat = (typeof STATISTICS_METRIC_FORMAT)[keyof typeof STATISTICS_METRIC_FORMAT];

export const STATISTICS_CALCULATED_TREND = { UP: "up", DOWN: "down", NEUTRAL: "neutral" } as const;
export type StatisticsCalculatedTrend = (typeof STATISTICS_CALCULATED_TREND)[keyof typeof STATISTICS_CALCULATED_TREND];

export interface StatisticsMetricInput {
  current: number;
  previous: number;
  variationPct: number;
  trend: StatisticsCalculatedTrend;
  format?: StatisticsMetricFormat;
}

export interface StatisticsMapperWindow { from: Date; to: Date; }

export function formatCurrency(value: number): number {
  return round(Math.max(0, finite(value)), 2);
}

export function formatInteger(value: number): number {
  return Math.max(0, Math.trunc(finite(value)));
}

export function formatPercentage(value: number): number {
  return round(finite(value), 2);
}

export function mapMetric(input: StatisticsMetricInput): StatisticsMetric {
  const format = input.format ?? STATISTICS_METRIC_FORMAT.CURRENCY;
  const formatter = format === STATISTICS_METRIC_FORMAT.INTEGER ? formatInteger : format === STATISTICS_METRIC_FORMAT.PERCENTAGE ? formatPercentage : formatCurrency;
  return {
    current: formatter(input.current),
    previous: formatter(input.previous),
    variationPct: formatPercentage(input.variationPct),
    trend: input.trend === STATISTICS_CALCULATED_TREND.NEUTRAL ? STATISTICS_TREND.FLAT : input.trend,
  };
}

export function mapMetrics(inputs: Record<string, StatisticsMetricInput>): Record<string, StatisticsMetric> {
  return Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, mapMetric(input)])) as Record<string, StatisticsMetric>;
}

export function mapMetadata(period: StatisticsPeriod, window: StatisticsMapperWindow, comparisonWindow: StatisticsMapperWindow): StatisticsMetadata {
  return { period, window: mapWindow(window), comparisonWindow: mapWindow(comparisonWindow) };
}

export function mapOverviewResponse(metadata: StatisticsMetadata, metrics: Record<string, StatisticsMetricInput>): StatisticsOverviewResponse {
  return { ok: true, data: { metadata, metrics: mapMetrics(metrics) } };
}

export function mapSalesResponse(metadata: StatisticsMetadata, metrics: Record<string, StatisticsMetricInput>, aggregates: SalesAggregates, provinces: Array<{ province: string; orders: number; revenue: number }> = []): StatisticsSalesResponse {
  return { ok: true, data: { metadata, metrics: mapMetrics(metrics), paymentStatuses: aggregates.paymentStatuses.map((item) => ({ status: nonEmpty(item.status, "UNSPECIFIED"), count: formatInteger(item.count) })), paymentMethods: aggregates.paymentMethods.map((item) => ({ method: nonEmpty(item.method, "UNSPECIFIED"), revenue: formatCurrency(item.revenue) })), shipping: aggregates.shipping.map((item) => ({ type: nonEmpty(item.type, "UNSPECIFIED"), orders: formatInteger(item.orders) })), provinces: provinces.map((item) => ({ province: nonEmpty(item.province, "UNSPECIFIED"), orders: formatInteger(item.orders), revenue: formatCurrency(item.revenue) })) } };
}

export function mapProductsResponse(metadata: StatisticsMetadata, metrics: Record<string, StatisticsMetricInput>, products: TopProductAggregate[], series: SalesTimeSeriesPoint[], inventoryAlerts: InventoryAlertGroup[]): StatisticsProductsResponse {
  return { ok: true, data: { metadata, metrics: mapMetrics(metrics), topProducts: products.map((item) => ({ id: nonEmpty(item.id, "unknown"), name: nonEmpty(item.name, "Unknown product"), category: nonEmpty(item.category, "Uncategorized"), unitsSold: formatInteger(item.unitsSold), revenue: formatCurrency(item.revenue), stockAvailable: formatInteger(item.stockAvailable), stockReserved: formatInteger(item.stockReserved) })), series: series.map((item) => ({ bucket: toIso(item.bucket), unitsSold: formatInteger(item.unitsSold), revenue: formatCurrency(item.revenue) })), inventoryAlerts: inventoryAlerts.map((group) => ({ type: nonEmpty(group.type, "UNSPECIFIED"), items: group.items.map((item) => ({ id: nonEmpty(item.id, "unknown"), name: nonEmpty(item.name, "Unknown product"), stockAvailable: formatInteger(item.stockAvailable), stockReserved: formatInteger(item.stockReserved) })) })) } };
}

export function mapCustomersResponse(metadata: StatisticsMetadata, metrics: Record<string, StatisticsMetricInput>, customers: TopCustomerAggregate[]): StatisticsCustomersResponse {
  return { ok: true, data: { metadata, metrics: mapMetrics(metrics), topCustomers: customers.map((item) => ({ id: nonEmpty(item.id, "unknown"), name: nonEmpty(item.name, "Unknown customer"), email: validEmail(item.email), ordersCount: formatInteger(item.ordersCount), totalSpent: formatCurrency(item.totalSpent) })) } };
}

export function mapCouponsResponse(metadata: StatisticsMetadata, metrics: Record<string, StatisticsMetricInput>, stats: CouponStats): StatisticsCouponsResponse {
  return { ok: true, data: { metadata, metrics: mapMetrics(metrics), topCoupons: stats.topCoupons.map((item) => ({ code: nonEmpty(item.code, "UNSPECIFIED"), redemptions: formatInteger(item.redemptions), revenue: formatCurrency(item.revenue) })), comparison: { withCoupon: mapComparison(stats.comparison.withCoupon), withoutCoupon: mapComparison(stats.comparison.withoutCoupon) } } };
}

@Injectable()
export class StatisticsMapper {
  mapOverviewResponse(...args: Parameters<typeof mapOverviewResponse>): ReturnType<typeof mapOverviewResponse> {
    return mapOverviewResponse(...args);
  }

  mapSalesResponse(...args: Parameters<typeof mapSalesResponse>): ReturnType<typeof mapSalesResponse> {
    return mapSalesResponse(...args);
  }

  mapProductsResponse(...args: Parameters<typeof mapProductsResponse>): ReturnType<typeof mapProductsResponse> {
    return mapProductsResponse(...args);
  }

  mapCustomersResponse(...args: Parameters<typeof mapCustomersResponse>): ReturnType<typeof mapCustomersResponse> {
    return mapCustomersResponse(...args);
  }

  mapCouponsResponse(...args: Parameters<typeof mapCouponsResponse>): ReturnType<typeof mapCouponsResponse> {
    return mapCouponsResponse(...args);
  }
}

function mapComparison(value: { orders: number; revenue: number }) { return { orders: formatInteger(value.orders), revenue: formatCurrency(value.revenue) }; }
function mapWindow(value: StatisticsMapperWindow) { return { from: toIso(value.from), to: toIso(value.to) }; }
function toIso(value: Date): string { return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString(); }
function nonEmpty(value: string, fallback: string): string { return value.trim() || fallback; }
function validEmail(value: string): string { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim() : "unknown@example.com"; }
function finite(value: number): number { return Number.isFinite(value) ? value : 0; }
function round(value: number, decimals: number): number { const factor = 10 ** decimals; return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor; }
