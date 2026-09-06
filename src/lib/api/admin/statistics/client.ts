import { clearAccountAccessToken, getAccountAccessToken } from "@/lib/api/account/access-token";
import { z } from "zod";

import {
  couponsResponseSchema,
  customersResponseSchema,
  overviewResponseSchema,
  productsResponseSchema,
  statisticsQuerySchema,
  salesResponseSchema,
  toValidationIssues,
} from "./contracts";
import { statisticsApiConfig, type StatisticsApiConfig } from "./statistics-api-config";
import {
  StatisticsApiError,
  type StatisticsApiIssue,
  type StatisticsCouponsResponse,
  type StatisticsCustomersResponse,
  type StatisticsOverviewResponse,
  type StatisticsProductsResponse,
  type StatisticsQuery,
  type StatisticsSalesResponse,
} from "./types";

const STATISTICS_API_HTTP_METHOD = { GET: "GET" } as const;
type StatisticsApiHttpMethod = (typeof STATISTICS_API_HTTP_METHOD)[keyof typeof STATISTICS_API_HTTP_METHOD];
type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface StatisticsApiRequestOptions {
  headers?: HeadersInit;
  includeAuthorization?: boolean;
  method?: StatisticsApiHttpMethod;
  retryOnTransient?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type StatisticsApiMethodOptions = Omit<StatisticsApiRequestOptions, "method">;

export class StatisticsApiClient {
  constructor(
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly baseUrl = statisticsApiConfig.baseUrl,
    private readonly config: StatisticsApiConfig = statisticsApiConfig,
  ) {}

  get<T>(path: string, options: StatisticsApiMethodOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: STATISTICS_API_HTTP_METHOD.GET });
  }

  getOverview(query: StatisticsQuery = {}, options: StatisticsApiMethodOptions = {}): Promise<StatisticsOverviewResponse> {
    return this.getReport(this.config.endpoints.overview, query, overviewResponseSchema, options);
  }

  getSales(query: StatisticsQuery = {}, options: StatisticsApiMethodOptions = {}): Promise<StatisticsSalesResponse> {
    return this.getReport(this.config.endpoints.sales, query, salesResponseSchema, options);
  }

  getProducts(query: StatisticsQuery = {}, options: StatisticsApiMethodOptions = {}): Promise<StatisticsProductsResponse> {
    return this.getReport(this.config.endpoints.products, query, productsResponseSchema, options);
  }

  getCustomers(query: StatisticsQuery = {}, options: StatisticsApiMethodOptions = {}): Promise<StatisticsCustomersResponse> {
    return this.getReport(this.config.endpoints.customers, query, customersResponseSchema, options);
  }

  getCoupons(query: StatisticsQuery = {}, options: StatisticsApiMethodOptions = {}): Promise<StatisticsCouponsResponse> {
    return this.getReport(this.config.endpoints.coupons, query, couponsResponseSchema, options);
  }

  async request<T>(path: string, options: StatisticsApiRequestOptions = {}): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        const response = await this.execute(path, options);
        const payload = await readJson(response);
        if (!response.ok || (isRecord(payload) && payload.ok === false)) {
          if (response.status === 401 && options.includeAuthorization !== false) clearAccountAccessToken();
          throw responseError(response.status, payload);
        }
        return payload as T;
      } catch (error) {
        const apiError = toStatisticsApiError(error);
        if (!shouldRetry(apiError, attempt, options, this.config)) throw apiError;
        await delay(this.config.retryPolicy.baseDelayMs * 2 ** attempt);
        attempt += 1;
      }
    }
  }

  private async getReport<T>(
    path: string,
    query: StatisticsQuery,
    schema: z.ZodType<T>,
    options: StatisticsApiMethodOptions,
  ): Promise<T> {
    const parsedQuery = parseQuery(query);
    const payload = await this.get<unknown>(withQuery(path, parsedQuery), options);
    const result = schema.safeParse(payload);
    if (result.success) return result.data;
    throw new StatisticsApiError({
      code: "STATISTICS_API_INVALID_RESPONSE",
      issues: toValidationIssues(result.error),
      message: "The statistics API returned an invalid response.",
      status: 502,
    });
  }

  private async execute(path: string, options: StatisticsApiRequestOptions): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    const token = getAccountAccessToken();
    if (token && options.includeAuthorization !== false) headers.set("Authorization", `Bearer ${token}`);

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? this.config.timeoutMs);
    const abort = () => controller.abort();
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener("abort", abort, { once: true });

    try {
      return await this.fetchImplementation(`${this.baseUrl}${normalizePath(path)}`, {
        cache: "no-store",
        credentials: "include",
        headers,
        method: options.method ?? STATISTICS_API_HTTP_METHOD.GET,
        signal: controller.signal,
      });
    } catch {
      if (options.signal?.aborted) throw new StatisticsApiError({ code: "STATISTICS_API_ABORTED", message: "The statistics request was aborted.", status: 499 });
      if (timedOut) throw new StatisticsApiError({ code: "STATISTICS_API_TIMEOUT", message: "The statistics API request timed out.", status: 504 });
      throw unavailableError();
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  }
}

export class FetchStatisticsApiClient extends StatisticsApiClient {}

export function toStatisticsApiError(error: unknown): StatisticsApiError {
  if (error instanceof StatisticsApiError) return error;
  return new StatisticsApiError({
    code: "STATISTICS_API_ERROR",
    message: error instanceof Error ? error.message : "The statistics request failed.",
    status: 500,
  });
}

export { STATISTICS_API_HTTP_METHOD };

function parseQuery(query: StatisticsQuery) {
  const result = statisticsQuerySchema.safeParse(query);
  if (result.success) return result.data;
  throw new StatisticsApiError({
    code: "VALIDATION_ERROR",
    issues: toValidationIssues(result.error),
    message: "The statistics query is invalid.",
    status: 400,
  });
}

function withQuery(path: string, query: ReturnType<typeof parseQuery>): string {
  const params = new URLSearchParams({ period: query.period, interval: query.interval });
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  return `${path}?${params.toString()}`;
}

function shouldRetry(error: StatisticsApiError, attempt: number, options: StatisticsApiRequestOptions, config: StatisticsApiConfig): boolean {
  if (options.retryOnTransient === false || error.status === 499) return false;
  return attempt < config.retryPolicy.maxRetries
    && (config.retryPolicy.retryableStatuses.includes(error.status) || error.code === "STATISTICS_API_UNAVAILABLE");
}

function responseError(status: number, payload: unknown): StatisticsApiError {
  const record = isRecord(payload) ? payload : {};
  const code = typeof record.code === "string" && record.code.trim() ? record.code : "STATISTICS_API_ERROR";
  const message = typeof record.message === "string" && record.message.trim() ? record.message : "The statistics API request failed.";
  return new StatisticsApiError({ code, issues: readIssues(record.issues), message, status });
}

function unavailableError(): StatisticsApiError {
  return new StatisticsApiError({ code: "STATISTICS_API_UNAVAILABLE", message: "The statistics API is unavailable.", status: 503 });
}

function readIssues(value: unknown): StatisticsApiIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      code: typeof item.code === "string" && item.code.trim() ? item.code : "INVALID_FIELD",
      field: typeof item.field === "string" && item.field.trim() ? item.field : "request",
      message: typeof item.message === "string" && item.message.trim() ? item.message : "Invalid value.",
    }];
  });
}

function normalizePath(path: string): string { return path.startsWith("/") ? path : `/${path}`; }
function delay(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
async function readJson(response: Response): Promise<unknown> { const text = await response.text().catch(() => ""); if (!text.trim()) return undefined; try { return JSON.parse(text) as unknown; } catch { return undefined; } }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
