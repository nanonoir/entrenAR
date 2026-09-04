const defaultApiBaseUrl = "http://localhost:3001/api/v1";
const configuredBaseUrl = process.env.NEXT_PUBLIC_ADMIN_CUSTOMERS_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_API_BASE_URL
  ?? defaultApiBaseUrl;

export const customersApiConfig = {
  baseUrl: normalizeBaseUrl(configuredBaseUrl),
  fallbackToMock: parseBoolean(process.env.NEXT_PUBLIC_ADMIN_CUSTOMERS_FALLBACK_TO_MOCK ?? "true"),
  endpoints: {
    collection: "/admin/customers",
    availability: "/admin/customers/availability",
    export: "/admin/customers/export",
  },
} as const;

export const adminCustomersApiConfig = customersApiConfig;

function normalizeBaseUrl(value: string): string {
  return (value.trim() || defaultApiBaseUrl).replace(/\/$/, "");
}

function parseBoolean(value: string): boolean {
  return value.trim().toLowerCase() !== "false" && value.trim() !== "0";
}
