import { clearAccountAccessToken, setAccountAccessToken } from "@/lib/api/account/access-token";

import { ApiStatisticsRepository } from "../api-statistics-repository";
import { FetchStatisticsApiClient, StatisticsApiClient } from "../client";
import { couponsResponseSchema, customersResponseSchema, overviewResponseSchema, productsResponseSchema, salesResponseSchema } from "../contracts";
import { MockStatisticsRepository } from "../mock-statistics-repository";
import { statisticsApiConfig, type StatisticsApiConfig } from "../statistics-api-config";
import { StatisticsApiError, type StatisticsCouponsResponse, type StatisticsCustomersResponse, type StatisticsOverviewResponse, type StatisticsProductsResponse, type StatisticsSalesResponse } from "../types";

async function run(): Promise<void> {
  const mockReports = await runMockScenario();
  const apiReports = await runApiScenario(mockReports);
  await runFallbackScenario();
  assert(JSON.stringify(structure(mockReports)) === JSON.stringify(structure(apiReports)), "Repository result shapes are not in parity.");
  console.log("statistics adapter harness: mock validation, period sensitivity, authenticated API parsing, fallback recovery, and parity passed");
}

async function runMockScenario(): Promise<ReportSet> {
  const repository = new MockStatisticsRepository();
  const current = await reports(repository, { period: "current-week", limit: 5 });
  const longRange = await repository.getOverview({ period: "last-90-days" });
  const custom = await repository.getSales({ period: "custom", from: "2026-01-01", to: "2026-01-31" });
  assert(current.overview.metadata.period === "current-week", "Mock default period was not preserved.");
  assert(longRange.metadata.period === "last-90-days" && longRange.metrics.orders.current !== current.overview.metrics.orders.current, "Mock data is not period-sensitive.");
  assert(custom.metadata.window.from === "2026-01-01T00:00:00.000Z" && custom.metadata.window.to === "2026-01-31T23:59:59.999Z", "Mock custom range was not applied.");
  validateEnvelope(overviewResponseSchema, envelope(current.overview));
  validateEnvelope(salesResponseSchema, envelope(current.sales));
  validateEnvelope(productsResponseSchema, envelope(current.products));
  validateEnvelope(customersResponseSchema, envelope(current.customers));
  validateEnvelope(couponsResponseSchema, envelope(current.coupons));
  return current;
}

async function runApiScenario(expected: ReportSet): Promise<ReportSet> {
  const calls: FetchCall[] = [];
  const payloads: Record<string, unknown> = {
    coupons: envelope(expected.coupons),
    customers: envelope(expected.customers),
    overview: envelope(expected.overview),
    products: envelope(expected.products),
    sales: envelope(expected.sales),
  };
  const client = new FetchStatisticsApiClient(async (input, init) => {
    const call = toFetchCall(input, init);
    calls.push(call);
    const endpoint = call.path.split("/").pop()?.split("?")[0] ?? "";
    return jsonResponse(payloads[endpoint]);
  }, "https://statistics.test/api/v1");
  setAccountAccessToken("statistics-harness-token");
  try {
    const repository = new ApiStatisticsRepository(client, new MockStatisticsRepository(), false);
    const result = await reports(repository, { period: "last-90-days", limit: 5 });
    assert(calls.length === 5 && calls.every((call) => call.authorization === "Bearer statistics-harness-token"), "Statistics API calls were not authenticated.");
    assert(calls.every((call) => call.query.includes("period=last-90-days") && call.query.includes("limit=5")), "Statistics query parameters were not serialized.");
    return result;
  } finally {
    clearAccountAccessToken();
  }
}

async function runFallbackScenario(): Promise<void> {
  const noRetryConfig: StatisticsApiConfig = { ...statisticsApiConfig, retryPolicy: { ...statisticsApiConfig.retryPolicy, maxRetries: 0 } };
  const offlineClient = new FetchStatisticsApiClient(async () => { throw new Error("offline"); }, "https://offline.test/api/v1", noRetryConfig);
  const offline = new ApiStatisticsRepository(offlineClient, new MockStatisticsRepository(), true);
  assert((await offline.getOverview({ period: "today" })).metadata.period === "today", "Offline recovery did not return mock data.");

  const serverClient = new FetchStatisticsApiClient(async () => jsonResponse({ code: "INTERNAL_ERROR", message: "Server unavailable.", ok: false }, 500), "https://server.test/api/v1", noRetryConfig);
  const serverFallback = new ApiStatisticsRepository(serverClient, new MockStatisticsRepository(), true);
  assert((await serverFallback.getCoupons()).topCoupons.length > 0, "5xx recovery did not return mock data.");

  const unexpected = new ApiStatisticsRepository(new UnexpectedStatisticsClient(), new MockStatisticsRepository(), true);
  assert((await unexpected.getProducts()).topProducts.length > 0, "Unexpected error recovery did not return mock data.");

  const clientError = new FetchStatisticsApiClient(async () => jsonResponse({ code: "VALIDATION_ERROR", message: "Bad query.", ok: false }, 400), "https://client-error.test/api/v1", noRetryConfig);
  try {
    await new ApiStatisticsRepository(clientError, new MockStatisticsRepository(), true).getOverview();
    throw new Error("Controlled client errors must not recover to mocks.");
  } catch (error) {
    assert(error instanceof StatisticsApiError && error.status === 400 && error.code === "VALIDATION_ERROR", "Controlled 4xx errors were not preserved.");
  }
}

class UnexpectedStatisticsClient extends StatisticsApiClient {
  override getProducts(): Promise<StatisticsProductsResponse> { return Promise.reject(new Error("unexpected client failure")); }
}

interface ReportSet {
  coupons: StatisticsCouponsResponse["data"];
  customers: StatisticsCustomersResponse["data"];
  overview: StatisticsOverviewResponse["data"];
  products: StatisticsProductsResponse["data"];
  sales: StatisticsSalesResponse["data"];
}

async function reports(repository: { getCoupons: (query?: { limit?: number; period?: "current-week" | "last-90-days" | "custom" | "today" }) => Promise<ReportSet["coupons"]>; getCustomers: (query?: { limit?: number; period?: "current-week" | "last-90-days" | "custom" | "today" }) => Promise<ReportSet["customers"]>; getOverview: (query?: { limit?: number; period?: "current-week" | "last-90-days" | "custom" | "today" }) => Promise<ReportSet["overview"]>; getProducts: (query?: { limit?: number; period?: "current-week" | "last-90-days" | "custom" | "today" }) => Promise<ReportSet["products"]>; getSales: (query?: { limit?: number; period?: "current-week" | "last-90-days" | "custom" | "today" }) => Promise<ReportSet["sales"]> }, query: { limit?: number; period?: "current-week" | "last-90-days" | "custom" | "today" }): Promise<ReportSet> {
  const [overview, sales, products, customers, coupons] = await Promise.all([
    repository.getOverview(query),
    repository.getSales(query),
    repository.getProducts(query),
    repository.getCustomers(query),
    repository.getCoupons(query),
  ]);
  return { coupons, customers, overview, products, sales };
}

function envelope<T>(data: T): { ok: true; data: T } { return { data, ok: true }; }
function validateEnvelope<T>(schema: { safeParse: (value: unknown) => { success: boolean; data?: T } }, payload: unknown): void { assert(schema.safeParse(payload).success, "Statistics response envelope failed Zod validation."); }
function structure(value: unknown): unknown {
  if (Array.isArray(value)) return value.length === 0 ? [] : [structure(value[0])];
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, structure(entry)]));
  return typeof value;
}
function toFetchCall(input: RequestInfo | URL, init?: RequestInit): FetchCall { const value = typeof input === "string" ? input : input instanceof URL ? input.href : input.url; const url = new URL(value); return { authorization: new Headers(init?.headers).get("authorization"), method: init?.method ?? "GET", path: url.pathname.replace(/^\/api\/v1/, ""), query: url.search }; }
function jsonResponse(value: unknown, status = 200): Response { return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, status }); }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
interface FetchCall { authorization: string | null; method: string; path: string; query: string; }
void run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
