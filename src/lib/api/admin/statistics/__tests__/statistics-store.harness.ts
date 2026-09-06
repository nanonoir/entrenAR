import { createAdminStatisticsStore } from "@/stores/admin-statistics-store";

import { MockStatisticsRepository } from "../mock-statistics-repository";
import { STATISTICS_DATA_SOURCE, type StatisticsRepository } from "../repository";
import {
  STATISTICS_PERIOD,
  type StatisticsQuery,
} from "../types";

async function run(): Promise<void> {
  const repository = new CountingStatisticsRepository();
  const store = createAdminStatisticsStore({ repository });
  const initial = store.getState();

  assert(initial.period === STATISTICS_PERIOD.CURRENT_WEEK, "The default statistics period is incorrect.");
  assert(initial.customRange === undefined, "The default custom range must be empty.");
  assert(initial.overview.data === null && !initial.overview.isLoading && initial.overview.error === null, "The default overview state is incorrect.");

  await store.getState().setPeriod(STATISTICS_PERIOD.LAST_90_DAYS);
  assert(store.getState().period === STATISTICS_PERIOD.LAST_90_DAYS, "Preset period selection was not stored.");
  assert(repository.calls.overview > 0 && repository.calls.coupons > 0, "Preset period selection did not refresh reports.");

  await store.getState().setPeriod(STATISTICS_PERIOD.CUSTOM, { from: "2026-01-01", to: "2026-01-31" });
  const customRange = store.getState().customRange;
  assert(customRange?.from === "2026-01-01" && customRange.to === "2026-01-31", "Custom range was not stored.");
  assert(store.getState().overview.data?.metadata.period === STATISTICS_PERIOD.CUSTOM, "Custom period was not forwarded to reports.");

  await Promise.all([
    store.getState().fetchOverview(),
    store.getState().fetchSales(),
    store.getState().fetchProducts(),
    store.getState().fetchCustomers(),
    store.getState().fetchCoupons(),
  ]);
  const populated = store.getState();
  assert(populated.overview.data !== null && populated.sales.data !== null && populated.products.data !== null, "Core report fetches did not populate state.");
  assert(populated.customers.data !== null && populated.coupons.data !== null, "Customer and coupon report fetches did not populate state.");

  const previousOverview = populated.overview.data;
  const previousCalls = repository.calls.overview;
  await store.getState().refreshAll();
  assert(repository.calls.overview > previousCalls, "refreshAll did not refetch the overview report.");
  assert(store.getState().overview.data !== null && store.getState().overview.data !== previousOverview, "refreshAll did not invalidate and replace cached data.");

  await store.getState().setPeriod(STATISTICS_PERIOD.CUSTOM);
  assert(store.getState().overview.error?.code === "VALIDATION_ERROR", "Incomplete custom ranges must expose a controlled validation error.");
  assert(repository.calls.overview === previousCalls + 1, "Incomplete custom ranges must not request a report.");

  console.log("statistics store harness: defaults, period changes, custom ranges, report fetching, validation, and refresh passed");
}

class CountingStatisticsRepository implements StatisticsRepository {
  readonly source = STATISTICS_DATA_SOURCE.MOCK;
  readonly delegate = new MockStatisticsRepository();
  readonly calls = { coupons: 0, customers: 0, overview: 0, products: 0, sales: 0 };

  getOverview(query?: StatisticsQuery) { this.calls.overview += 1; return this.delegate.getOverview(query); }
  getSales(query?: StatisticsQuery) { this.calls.sales += 1; return this.delegate.getSales(query); }
  getProducts(query?: StatisticsQuery) { this.calls.products += 1; return this.delegate.getProducts(query); }
  getCustomers(query?: StatisticsQuery) { this.calls.customers += 1; return this.delegate.getCustomers(query); }
  getCoupons(query?: StatisticsQuery) { this.calls.coupons += 1; return this.delegate.getCoupons(query); }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
