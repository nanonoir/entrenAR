const defaultApiBaseUrl = "http://localhost:3001/api/v1";
const configuredSalesApiBaseUrl =
  process.env.NEXT_PUBLIC_ADMIN_SALES_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_ACCOUNT_API_BASE_URL ??
  process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL ??
  defaultApiBaseUrl;

export const salesApiConfig = {
  baseUrl: normalizeBaseUrl(configuredSalesApiBaseUrl),
} as const;

function normalizeBaseUrl(value: string): string {
  return (value.trim() || defaultApiBaseUrl).replace(/\/$/, "");
}
