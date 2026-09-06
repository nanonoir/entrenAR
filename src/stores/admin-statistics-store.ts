import { create } from "zustand";

import { statisticsRepository } from "@/lib/api/config";
import { statisticsQuerySchema, toValidationIssues } from "@/lib/api/admin/statistics/contracts";
import type { StatisticsRepository } from "@/lib/api/admin/statistics/repository";
import {
  STATISTICS_PERIOD,
  StatisticsApiError,
  type AdminStatisticsCouponsResult,
  type AdminStatisticsCustomersResult,
  type AdminStatisticsOverviewResult,
  type AdminStatisticsProductsResult,
  type AdminStatisticsSalesResult,
  type StatisticsPeriod,
} from "@/lib/api/admin/statistics/types";

export interface StatisticsCustomRange {
  from: string;
  to: string;
}

export interface StatisticsReportState<TData> {
  data: TData | null;
  error: StatisticsApiError | null;
  isLoading: boolean;
}

interface StatisticsReportDataMap {
  overview: AdminStatisticsOverviewResult;
  sales: AdminStatisticsSalesResult;
  products: AdminStatisticsProductsResult;
  customers: AdminStatisticsCustomersResult;
  coupons: AdminStatisticsCouponsResult;
}

type StatisticsReportKey = keyof StatisticsReportDataMap;

export interface AdminStatisticsState {
  period: StatisticsPeriod;
  customRange?: StatisticsCustomRange;
  overview: StatisticsReportState<AdminStatisticsOverviewResult>;
  sales: StatisticsReportState<AdminStatisticsSalesResult>;
  products: StatisticsReportState<AdminStatisticsProductsResult>;
  customers: StatisticsReportState<AdminStatisticsCustomersResult>;
  coupons: StatisticsReportState<AdminStatisticsCouponsResult>;
  setPeriod: (period: StatisticsPeriod, customRange?: StatisticsCustomRange) => Promise<void>;
  fetchOverview: (forceRefresh?: boolean) => Promise<AdminStatisticsOverviewResult | null>;
  fetchSales: (forceRefresh?: boolean) => Promise<AdminStatisticsSalesResult | null>;
  fetchProducts: (forceRefresh?: boolean) => Promise<AdminStatisticsProductsResult | null>;
  fetchCustomers: () => Promise<AdminStatisticsCustomersResult | null>;
  fetchCoupons: (forceRefresh?: boolean) => Promise<AdminStatisticsCouponsResult | null>;
  refreshAll: () => Promise<void>;
}

export interface AdminStatisticsStoreOptions {
  repository?: StatisticsRepository;
}

const initialReportState = <TData>(): StatisticsReportState<TData> => ({
  data: null,
  error: null,
  isLoading: false,
});

export function createAdminStatisticsStore(options: AdminStatisticsStoreOptions = {}) {
  const repository = options.repository ?? statisticsRepository;
  const requestVersions = new Map<StatisticsReportKey, number>();

  return create<AdminStatisticsState>()((set, get) => {
    const nextVersion = (key: StatisticsReportKey): number => {
      const version = (requestVersions.get(key) ?? 0) + 1;
      requestVersions.set(key, version);
      return version;
    };

    const isCurrentRequest = (key: StatisticsReportKey, version: number): boolean => requestVersions.get(key) === version;

    const updateReport = <TKey extends StatisticsReportKey>(
      key: TKey,
      report: StatisticsReportState<StatisticsReportDataMap[TKey]>,
    ): Pick<AdminStatisticsState, TKey> => ({ [key]: report } as unknown as Pick<AdminStatisticsState, TKey>);

    const runReport = async <TKey extends StatisticsReportKey>(
      key: TKey,
      fetcher: (query: ReturnType<typeof buildQuery>) => Promise<StatisticsReportDataMap[TKey]>,
    ): Promise<StatisticsReportDataMap[TKey] | null> => {
      const version = nextVersion(key);
      set(updateReport(key, { data: null, error: null, isLoading: true }));

      try {
        const result = await fetcher(buildQuery(get().period, get().customRange));
        if (isCurrentRequest(key, version)) {
          set(updateReport(key, { data: result, error: null, isLoading: false }));
        }
        return result;
      } catch (error) {
        const normalizedError = toStatisticsStoreError(error);
        if (isCurrentRequest(key, version)) {
          set(updateReport(key, { data: null, error: normalizedError, isLoading: false }));
        }
        return null;
      }
    };

    return {
      period: STATISTICS_PERIOD.CURRENT_WEEK,
      customRange: undefined,
      overview: initialReportState<AdminStatisticsOverviewResult>(),
      sales: initialReportState<AdminStatisticsSalesResult>(),
      products: initialReportState<AdminStatisticsProductsResult>(),
      customers: initialReportState<AdminStatisticsCustomersResult>(),
      coupons: initialReportState<AdminStatisticsCouponsResult>(),

      setPeriod: (period, customRange) => {
        set({ period, customRange: period === STATISTICS_PERIOD.CUSTOM ? customRange : undefined });
        return get().refreshAll();
      },

      fetchOverview: () => runReport("overview", (query) => repository.getOverview(query)),
      fetchSales: () => runReport("sales", (query) => repository.getSales(query)),
      fetchProducts: () => runReport("products", (query) => repository.getProducts(query)),
      fetchCustomers: () => runReport("customers", (query) => repository.getCustomers(query)),
      fetchCoupons: () => runReport("coupons", (query) => repository.getCoupons(query)),

      refreshAll: async () => {
        await Promise.all([
          get().fetchOverview(),
          get().fetchSales(),
          get().fetchProducts(),
          get().fetchCustomers(),
          get().fetchCoupons(),
        ]);
      },
    } satisfies AdminStatisticsState;
  });
}

export const useAdminStatisticsStore = createAdminStatisticsStore();

function buildQuery(period: StatisticsPeriod, customRange?: StatisticsCustomRange) {
  const candidate = period === STATISTICS_PERIOD.CUSTOM
    ? { period, ...customRange }
    : { period };
  const result = statisticsQuerySchema.safeParse(candidate);
  if (result.success) return result.data;

  throw new StatisticsApiError({
    code: "VALIDATION_ERROR",
    issues: toValidationIssues(result.error),
    message: "The statistics period and date range are invalid.",
    status: 400,
  });
}

function toStatisticsStoreError(error: unknown): StatisticsApiError {
  if (error instanceof StatisticsApiError) return error;
  return new StatisticsApiError({
    code: "STATISTICS_REPORT_FAILED",
    message: error instanceof Error && error.message.trim() ? error.message : "The statistics report could not be loaded.",
    status: 500,
  });
}
