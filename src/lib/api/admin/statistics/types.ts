export const STATISTICS_PERIOD = {
  TODAY: "today",
  CURRENT_WEEK: "current-week",
  LAST_30_DAYS: "last-30-days",
  LAST_90_DAYS: "last-90-days",
  LAST_12_MONTHS: "last-12-months",
  ALL_TIME: "all-time",
  CUSTOM: "custom",
} as const;

export type StatisticsPeriod = (typeof STATISTICS_PERIOD)[keyof typeof STATISTICS_PERIOD];
export const STATISTICS_TREND = {
  UP: "up",
  DOWN: "down",
  FLAT: "flat",
} as const;

export type StatisticsTrend = (typeof STATISTICS_TREND)[keyof typeof STATISTICS_TREND];
export const STATISTICS_INTERVAL = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
} as const;

export type StatisticsInterval = (typeof STATISTICS_INTERVAL)[keyof typeof STATISTICS_INTERVAL];
export interface StatisticsQuery {
  from?: string;
  interval?: StatisticsInterval;
  limit?: number;
  period?: StatisticsPeriod;
  to?: string;
}

export interface StatisticsWindow {
  from: string;
  to: string;
}
export interface StatisticsMetadata {
  comparisonWindow: StatisticsWindow;
  period: StatisticsPeriod;
  window: StatisticsWindow;
}
export interface StatisticsMetric {
  current: number;
  previous: number;
  trend: StatisticsTrend;
  variationPct: number;
}

export type StatisticsMetrics = Record<string, StatisticsMetric>;

export interface StatisticsPaymentStatus {
  count: number;
  status: string;
}

export interface StatisticsPaymentMethod {
  method: string;
  revenue: number;
}

export interface StatisticsShippingBreakdown {
  orders: number;
  type: string;
}

export interface StatisticsProvinceBreakdown {
  orders: number;
  province: string;
  revenue: number;
}

export interface StatisticsProduct {
  category: string;
  id: string;
  name: string;
  revenue: number;
  stockAvailable: number;
  stockReserved: number;
  unitsSold: number;
}

export interface StatisticsProductSeriesPoint {
  bucket: string;
  revenue: number;
  unitsSold: number;
}

export interface StatisticsInventoryAlertItem {
  id: string;
  name: string;
  stockAvailable: number;
  stockReserved: number;
}

export interface StatisticsInventoryAlertGroup {
  items: StatisticsInventoryAlertItem[];
  type: string;
}

export interface StatisticsCustomer {
  email: string;
  id: string;
  name: string;
  ordersCount: number;
  totalSpent: number;
}

export interface StatisticsCoupon {
  code: string;
  redemptions: number;
  revenue: number;
}

export interface StatisticsCouponComparison {
  orders: number;
  revenue: number;
}

export interface StatisticsOverviewData {
  behavior?: StatisticsOverviewBehavior;
  metadata: StatisticsMetadata;
  metrics: StatisticsMetrics;
}

export interface StatisticsOverviewBehavior {
  createdCarts?: number;
  paidOrders?: number;
}

export interface StatisticsSalesData extends StatisticsOverviewData {
  paymentMethods: StatisticsPaymentMethod[];
  paymentStatuses: StatisticsPaymentStatus[];
  provinces: StatisticsProvinceBreakdown[];
  shipping: StatisticsShippingBreakdown[];
}

export interface StatisticsProductsData extends StatisticsOverviewData {
  inventoryAlerts: StatisticsInventoryAlertGroup[];
  series: StatisticsProductSeriesPoint[];
  topProducts: StatisticsProduct[];
}

export interface StatisticsCustomersData extends StatisticsOverviewData {
  topCustomers: StatisticsCustomer[];
}

export interface StatisticsCouponsData extends StatisticsOverviewData {
  comparison: {
    withCoupon: StatisticsCouponComparison;
    withoutCoupon: StatisticsCouponComparison;
  };
  topCoupons: StatisticsCoupon[];
}

export interface StatisticsOverviewResponse {
  data: StatisticsOverviewData;
  ok: true;
}

export interface StatisticsSalesResponse {
  data: StatisticsSalesData;
  ok: true;
}

export interface StatisticsProductsResponse {
  data: StatisticsProductsData;
  ok: true;
}

export interface StatisticsCustomersResponse {
  data: StatisticsCustomersData;
  ok: true;
}

export interface StatisticsCouponsResponse {
  data: StatisticsCouponsData;
  ok: true;
}

export type AdminStatisticsOverviewResult = StatisticsOverviewData;
export type AdminStatisticsSalesResult = StatisticsSalesData;
export type AdminStatisticsProductsResult = StatisticsProductsData;
export type AdminStatisticsCustomersResult = StatisticsCustomersData;
export type AdminStatisticsCouponsResult = StatisticsCouponsData;

export interface StatisticsApiIssue {
  code: string;
  field: string;
  message: string;
}

export class StatisticsApiError extends Error {
  readonly code: string;
  readonly issues: readonly StatisticsApiIssue[];
  readonly ok = false as const;
  readonly status: number;

  constructor({ code, issues = [], message, status }: { code: string; issues?: readonly StatisticsApiIssue[]; message: string; status: number }) {
    super(message);
    this.code = code;
    this.issues = issues;
    this.name = "StatisticsApiError";
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
