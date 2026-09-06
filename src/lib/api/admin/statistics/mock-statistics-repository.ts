import { z } from "zod";

import { overviewKpis, visitorBehaviorBlocks } from "@/lib/data/admin/statistics/dashboard";
import { couponComparison, topCoupons } from "@/lib/data/admin/statistics/coupons";
import { adminPeriodOptions, defaultAdminPeriodId } from "@/lib/data/admin/statistics/periods";
import { inventoryAlerts, productSalesSeries, topProducts } from "@/lib/data/admin/statistics/products";
import { paymentMethodRevenue, paymentStatusData, salesMetrics, shippingSplit, topCustomers, topProvinces } from "@/lib/data/admin/statistics/sales";

import {
  couponsResponseSchema,
  customersResponseSchema,
  overviewResponseSchema,
  productsResponseSchema,
  salesResponseSchema,
  statisticsQuerySchema,
  toValidationIssues,
  type StatisticsCouponsResponseContract,
  type StatisticsCustomersResponseContract,
  type StatisticsOverviewResponseContract,
  type StatisticsProductsResponseContract,
  type StatisticsQueryContract,
  type StatisticsSalesResponseContract,
} from "./contracts";
import { StatisticsApiError, STATISTICS_PERIOD, type StatisticsMetric, type StatisticsMetadata, type StatisticsQuery } from "./types";
import { STATISTICS_DATA_SOURCE, type StatisticsRepository } from "./repository";

const DAY_MS = 86_400_000;
const MOCK_REFERENCE_DATE = new Date("2026-06-30T23:59:59.999Z");
const METRIC_FORMAT = { CURRENCY: "currency", INTEGER: "integer", PERCENTAGE: "percentage" } as const;

type StatisticsPeriod = (typeof STATISTICS_PERIOD)[keyof typeof STATISTICS_PERIOD];
type MetricFormat = (typeof METRIC_FORMAT)[keyof typeof METRIC_FORMAT];

const PERIOD_SCALES: Record<StatisticsPeriod, number> = {
  [STATISTICS_PERIOD.TODAY]: 1 / 7,
  [STATISTICS_PERIOD.CURRENT_WEEK]: 1,
  [STATISTICS_PERIOD.LAST_30_DAYS]: 30 / 7,
  [STATISTICS_PERIOD.LAST_90_DAYS]: 90 / 7,
  [STATISTICS_PERIOD.LAST_12_MONTHS]: 365 / 7,
  [STATISTICS_PERIOD.ALL_TIME]: 52,
  [STATISTICS_PERIOD.CUSTOM]: 1 / 7,
};

interface MockWindow {
  from: Date;
  to: Date;
}

interface MockContext {
  allTime: boolean;
  limit: number;
  metadata: StatisticsMetadata;
  scale: number;
}

export class MockStatisticsRepository implements StatisticsRepository {
  readonly source = STATISTICS_DATA_SOURCE.MOCK;

  async getOverview(query: StatisticsQuery = {}): Promise<StatisticsOverviewResponseContract["data"]> {
    const context = createContext(query);
    return validateData(overviewResponseSchema, {
      ok: true,
      data: {
        metadata: context.metadata,
        metrics: overviewMetrics(context),
      },
    });
  }

  async getSales(query: StatisticsQuery = {}): Promise<StatisticsSalesResponseContract["data"]> {
    const context = createContext(query);
    return validateData(salesResponseSchema, {
      ok: true,
      data: {
        metadata: context.metadata,
        metrics: salesMetricsFor(context),
        paymentMethods: paymentMethodRevenue.map((item) => ({ method: item.method, revenue: money(item.ingresos, context.scale) })),
        paymentStatuses: paymentStatusData.map((item) => ({ count: count(item.value, context.scale), status: item.name })),
        provinces: limited(topProvinces, context.limit).map((item) => ({ orders: count(item.pedidos, context.scale), province: item.provincia, revenue: money(item.facturacion, context.scale) })),
        shipping: shippingSplit.map((item) => ({ orders: count(item.value, context.scale), type: item.label })),
      },
    });
  }

  async getProducts(query: StatisticsQuery = {}): Promise<StatisticsProductsResponseContract["data"]> {
    const context = createContext(query);
    const selected = limited(topProducts, context.limit);
    return validateData(productsResponseSchema, {
      ok: true,
      data: {
        inventoryAlerts: inventoryAlerts.map((group) => ({
          items: group.items.map((name) => inventoryItem(name)),
          type: alertType(group.id),
        })),
        metadata: context.metadata,
        metrics: {
          revenue: metric(sum(selected.map((item) => item.ventasBrutas)), sum(selected.map((item) => item.ventasBrutas)) * 0.93, context, METRIC_FORMAT.CURRENCY),
          unitsSold: metric(sum(selected.map((item) => item.unidadesVendidas)), sum(selected.map((item) => item.unidadesVendidas)) * 0.93, context, METRIC_FORMAT.INTEGER),
        },
        series: productSalesSeries.map((item, index) => ({
          bucket: seriesBucket(context.metadata, index, productSalesSeries.length),
          revenue: money(item.facturacion, context.scale),
          unitsSold: count(item.unidades, context.scale),
        })),
        topProducts: selected.map((item) => ({
          category: item.categoria,
          id: item.id,
          name: item.producto,
          revenue: money(item.ventasBrutas, context.scale),
          stockAvailable: item.stockActual,
          stockReserved: item.stockReservado,
          unitsSold: count(item.unidadesVendidas, context.scale),
        })),
      },
    });
  }

  async getCustomers(query: StatisticsQuery = {}): Promise<StatisticsCustomersResponseContract["data"]> {
    const context = createContext(query);
    const selected = limited(topCustomers, context.limit);
    const totalSpent = sum(selected.map((item) => item.totalGastado));
    const orders = sum(selected.map((item) => item.pedidos));
    return validateData(customersResponseSchema, {
      ok: true,
      data: {
        metadata: context.metadata,
        metrics: {
          orders: metric(orders, orders * 0.93, context, METRIC_FORMAT.INTEGER),
          totalSpent: metric(totalSpent, totalSpent * 0.93, context, METRIC_FORMAT.CURRENCY),
        },
        topCustomers: selected.map((item) => ({
          email: item.mail,
          id: item.id,
          name: item.nombre,
          ordersCount: count(item.pedidos, context.scale),
          totalSpent: money(item.totalGastado, context.scale),
        })),
      },
    });
  }

  async getCoupons(query: StatisticsQuery = {}): Promise<StatisticsCouponsResponseContract["data"]> {
    const context = createContext(query);
    const withCoupon = couponComparison.find((item) => item.label.toLowerCase().includes("con cupón"));
    const withoutCoupon = couponComparison.find((item) => item.label.toLowerCase().includes("sin cupón"));
    const withCouponComparison = { orders: count(withCoupon?.pedidos ?? 0, context.scale), revenue: money(withCoupon?.facturacion ?? 0, context.scale) };
    const withoutCouponComparison = { orders: count(withoutCoupon?.pedidos ?? 0, context.scale), revenue: money(withoutCoupon?.facturacion ?? 0, context.scale) };
    return validateData(couponsResponseSchema, {
      ok: true,
      data: {
        comparison: { withCoupon: withCouponComparison, withoutCoupon: withoutCouponComparison },
        metadata: context.metadata,
        metrics: {
          orders: metric((withCoupon?.pedidos ?? 0) + (withoutCoupon?.pedidos ?? 0), ((withCoupon?.pedidos ?? 0) + (withoutCoupon?.pedidos ?? 0)) * 0.93, context, METRIC_FORMAT.INTEGER),
          revenue: metric((withCoupon?.facturacion ?? 0) + (withoutCoupon?.facturacion ?? 0), ((withCoupon?.facturacion ?? 0) + (withoutCoupon?.facturacion ?? 0)) * 0.93, context, METRIC_FORMAT.CURRENCY),
        },
        topCoupons: limited(topCoupons, context.limit).map((item) => ({ code: item.code, redemptions: count(item.usos, context.scale), revenue: money(item.ventas, context.scale) })),
      },
    });
  }
}

function createContext(query: StatisticsQuery): MockContext {
  const parsed = parseQuery(query);
  const current = currentWindow(parsed);
  const allTime = parsed.period === STATISTICS_PERIOD.ALL_TIME;
  const duration = current.to.getTime() - current.from.getTime();
  const previousTo = new Date(current.from.getTime() - 1);
  const previous = allTime ? current : { from: new Date(previousTo.getTime() - duration), to: previousTo };
  const days = (duration + 1) / DAY_MS;
  return {
    allTime,
    limit: parsed.limit ?? 10,
    metadata: { comparisonWindow: toWindow(previous), period: parsed.period, window: toWindow(current) },
    scale: periodScale(parsed.period, days),
  };
}

function currentWindow(query: StatisticsQueryContract): MockWindow {
  const reference = MOCK_REFERENCE_DATE;
  switch (query.period) {
    case STATISTICS_PERIOD.TODAY: return { from: startOfDay(reference), to: endOfDay(reference) };
    case STATISTICS_PERIOD.CURRENT_WEEK: return { from: addDays(startOfDay(reference), -((reference.getUTCDay() + 6) % 7)), to: endOfDay(reference) };
    case STATISTICS_PERIOD.LAST_30_DAYS: return { from: addDays(startOfDay(reference), -29), to: endOfDay(reference) };
    case STATISTICS_PERIOD.LAST_90_DAYS: return { from: addDays(startOfDay(reference), -89), to: endOfDay(reference) };
    case STATISTICS_PERIOD.LAST_12_MONTHS: return { from: startOfMonth(addMonths(reference, -11)), to: endOfDay(reference) };
    case STATISTICS_PERIOD.ALL_TIME: return { from: new Date(0), to: endOfDay(reference) };
    case STATISTICS_PERIOD.CUSTOM: return { from: new Date(`${query.from}T00:00:00.000Z`), to: new Date(`${query.to}T23:59:59.999Z`) };
  }
}

function periodScale(period: StatisticsPeriod, days: number): number {
  if (period === STATISTICS_PERIOD.CUSTOM) return Math.max(1 / 7, days / 7);
  const knownPeriod = adminPeriodOptions.some((option) => option.id === period);
  return knownPeriod ? PERIOD_SCALES[period] : PERIOD_SCALES[defaultAdminPeriodId];
}

function overviewMetrics(context: MockContext): Record<string, StatisticsMetric> {
  const sales = kpiValue("sales");
  const revenue = kpiValue("billing");
  const averageTicket = kpiValue("average-ticket");
  const createdCarts = fixtureNumber(visitorBehaviorBlocks, "created-carts");
  const conversionRate = createdCarts > 0 ? (sales.current / createdCarts) * 100 : 0;
  return {
    averageTicket: metric(averageTicket.current, averageTicket.previous, context, METRIC_FORMAT.CURRENCY),
    conversionRate: metric(conversionRate, kpiValue("cart-conversion").previous, context, METRIC_FORMAT.PERCENTAGE),
    orders: metric(sales.current, sales.previous, context, METRIC_FORMAT.INTEGER),
    revenue: metric(revenue.current, revenue.previous, context, METRIC_FORMAT.CURRENCY),
  };
}

function salesMetricsFor(context: MockContext): Record<string, StatisticsMetric> {
  const revenue = sum(paymentMethodRevenue.map((item) => item.ingresos));
  const orders = { current: fixtureNumber(salesMetrics, "orders"), previous: kpiValue("sales").previous };
  return {
    averageTicket: metric(revenue / Math.max(orders.current, 1), kpiValue("average-ticket").previous, context, METRIC_FORMAT.CURRENCY),
    orders: metric(orders.current, orders.previous, context, METRIC_FORMAT.INTEGER),
    revenue: metric(revenue, kpiValue("billing").previous, context, METRIC_FORMAT.CURRENCY),
  };
}

function kpiValue(id: string): { current: number; previous: number } {
  const item = overviewKpis.find((entry) => entry.id === id);
  return item ? { current: parseFixtureNumber(item.value), previous: parseFixtureNumber(item.previousValue) } : { current: 0, previous: 0 };
}

function fixtureNumber(items: readonly { id: string; value: string }[], id: string): number {
  const item = items.find((entry) => entry.id === id);
  return item ? parseFixtureNumber(item.value) : 0;
}

function parseQuery(query: StatisticsQuery): StatisticsQueryContract {
  const result = statisticsQuerySchema.safeParse({ ...query, period: query.period ?? defaultAdminPeriodId });
  if (result.success) return result.data;
  throw new StatisticsApiError({ code: "VALIDATION_ERROR", issues: toValidationIssues(result.error), message: "The statistics query is invalid.", status: 400 });
}

function validateData<T>(schema: z.ZodType<{ ok: true; data: T }>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (result.success) return result.data.data;
  throw new StatisticsApiError({ code: "STATISTICS_MOCK_INVALID_RESPONSE", issues: toValidationIssues(result.error), message: "The statistics mock returned an invalid response.", status: 502 });
}

function metric(currentValue: number, previousValue: number, context: MockContext, format: MetricFormat): StatisticsMetric {
  const current = scaleMetric(currentValue, context.scale, format);
  const previous = context.allTime ? current : scaleMetric(previousValue, context.scale, format);
  const variationPct = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  return { current, previous, trend: current > previous ? "up" : current < previous ? "down" : "flat", variationPct: round(variationPct, 2) };
}

function scaleMetric(value: number, scale: number, format: MetricFormat): number {
  const scaled = Math.max(0, value * scale);
  return format === METRIC_FORMAT.INTEGER ? Math.round(scaled) : round(scaled, 2);
}

function count(value: number, scale: number): number { return Math.max(0, Math.round(value * scale)); }
function money(value: number, scale: number): number { return round(Math.max(0, value * scale), 2); }
function sum(values: readonly number[]): number { return values.reduce((total, value) => total + value, 0); }
function limited<T>(items: readonly T[], limit: number): T[] { return items.slice(0, limit); }

function inventoryItem(name: string) {
  const product = topProducts.find((item) => item.producto === name);
  return { id: product?.id ?? slug(name), name, stockAvailable: product?.stockActual ?? 0, stockReserved: product?.stockReservado ?? 0 };
}

function alertType(id: string): string {
  if (id === "no-stock") return "OUT_OF_STOCK";
  if (id === "low-stock") return "LOW_STOCK";
  return id.replace(/-/g, "_").toUpperCase();
}

function seriesBucket(metadata: StatisticsMetadata, index: number, length: number): string {
  const from = Date.parse(metadata.window.from);
  const to = Date.parse(metadata.window.to);
  const ratio = length <= 1 ? 0 : index / (length - 1);
  return new Date(from + (to - from) * ratio).toISOString();
}

function toWindow(window: MockWindow) { return { from: window.from.toISOString(), to: window.to.toISOString() }; }
function startOfDay(value: Date): Date { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())); }
function endOfDay(value: Date): Date { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999)); }
function startOfMonth(value: Date): Date { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)); }
function addDays(value: Date, days: number): Date { return new Date(value.getTime() + days * DAY_MS); }
function addMonths(value: Date, months: number): Date { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, value.getUTCDate(), value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), value.getUTCMilliseconds())); }
function parseFixtureNumber(value: string): number { const raw = value.replace(/[^\d,.-]/g, ""); const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/\./g, ""); const result = Number(normalized); return Number.isFinite(result) ? result : 0; }
function round(value: number, decimals: number): number { const factor = 10 ** decimals; return Math.round((value + Number.EPSILON) * factor) / factor; }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
