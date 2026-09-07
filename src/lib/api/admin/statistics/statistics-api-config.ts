const defaultApiBaseUrl = "http://localhost:3001/api/v1";
const configuredBaseUrl = process.env.NEXT_PUBLIC_ADMIN_STATISTICS_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_ACCOUNT_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL
  ?? defaultApiBaseUrl;

const defaultTimeoutMs = 10_000;
const defaultMaxRetries = 2;
const defaultRetryDelayMs = 250;

export const statisticsApiConfig = {
  baseUrl: normalizeBaseUrl(configuredBaseUrl),
  timeoutMs: parseInteger(process.env.NEXT_PUBLIC_ADMIN_STATISTICS_API_TIMEOUT_MS, defaultTimeoutMs, 1),
  retryPolicy: {
    baseDelayMs: parseInteger(process.env.NEXT_PUBLIC_ADMIN_STATISTICS_API_RETRY_DELAY_MS, defaultRetryDelayMs, 0),
    maxRetries: parseInteger(process.env.NEXT_PUBLIC_ADMIN_STATISTICS_API_MAX_RETRIES, defaultMaxRetries, 0),
    retryableStatuses: [408, 425, 429, 500, 502, 503, 504] as readonly number[],
  },
  fallbackToMock: parseBoolean(process.env.NEXT_PUBLIC_ADMIN_STATISTICS_FALLBACK_TO_MOCK ?? "true"),
  useMock: parseBoolean(process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_STATISTICS ?? "false"),
  endpoints: {
    overview: "/admin/statistics/overview",
    sales: "/admin/statistics/sales",
    products: "/admin/statistics/products",
    customers: "/admin/statistics/customers",
    coupons: "/admin/statistics/coupons",
  },
} as const;

export const adminStatisticsApiConfig = statisticsApiConfig;
export type StatisticsApiConfig = typeof statisticsApiConfig;

function normalizeBaseUrl(value: string): string {
  return (value.trim() || defaultApiBaseUrl).replace(/\/$/, "");
}

function parseBoolean(value: string): boolean {
  return value.trim().toLowerCase() !== "false" && value.trim() !== "0";
}

function parseInteger(value: string | undefined, fallback: number, minimum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}
