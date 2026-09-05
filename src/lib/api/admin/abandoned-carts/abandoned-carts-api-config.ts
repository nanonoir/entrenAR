const defaultApiBaseUrl = "http://localhost:3001/api/v1";
const configuredBaseUrl =
  process.env.NEXT_PUBLIC_ADMIN_ABANDONED_CARTS_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_ACCOUNT_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL
  ?? defaultApiBaseUrl;

export const abandonedCartsApiConfig = {
  baseUrl: normalizeBaseUrl(configuredBaseUrl),
  fallbackToMock: parseBoolean(process.env.NEXT_PUBLIC_ADMIN_ABANDONED_CARTS_FALLBACK_TO_MOCK ?? "true"),
  endpoints: {
    collection: "/admin/abandoned-carts",
    config: "/admin/abandoned-carts/config",
    detail: (id: string) => `/admin/abandoned-carts/${encodeURIComponent(id)}`,
    discard: (id: string) => `/admin/abandoned-carts/${encodeURIComponent(id)}/discard`,
    email: (id: string) => `/admin/abandoned-carts/${encodeURIComponent(id)}/email`,
    manual: (id: string) => `/admin/abandoned-carts/${encodeURIComponent(id)}/manual`,
    template: "/admin/abandoned-carts/template",
    convert: (id: string) => `/admin/abandoned-carts/${encodeURIComponent(id)}/convert`,
  },
} as const;

export const adminAbandonedCartsApiConfig = abandonedCartsApiConfig;

function normalizeBaseUrl(value: string): string {
  return (value.trim() || defaultApiBaseUrl).replace(/\/$/, "");
}

function parseBoolean(value: string): boolean {
  return value.trim().toLowerCase() !== "false" && value.trim() !== "0";
}
