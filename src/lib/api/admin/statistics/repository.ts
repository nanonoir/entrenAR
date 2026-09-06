import type {
  AdminStatisticsCouponsResult,
  AdminStatisticsCustomersResult,
  AdminStatisticsOverviewResult,
  AdminStatisticsProductsResult,
  AdminStatisticsSalesResult,
  StatisticsQuery,
} from "./types";

export const STATISTICS_DATA_SOURCE = {
  API: "api",
  MOCK: "mock",
} as const;

export type StatisticsDataSource = (typeof STATISTICS_DATA_SOURCE)[keyof typeof STATISTICS_DATA_SOURCE];

export interface StatisticsRepository {
  readonly source: StatisticsDataSource;
  getOverview(query?: StatisticsQuery): Promise<AdminStatisticsOverviewResult>;
  getSales(query?: StatisticsQuery): Promise<AdminStatisticsSalesResult>;
  getProducts(query?: StatisticsQuery): Promise<AdminStatisticsProductsResult>;
  getCustomers(query?: StatisticsQuery): Promise<AdminStatisticsCustomersResult>;
  getCoupons(query?: StatisticsQuery): Promise<AdminStatisticsCouponsResult>;
}
