const DATA_SOURCE = {
  API: "api",
  MOCK: "mock",
} as const;

type DataSource = (typeof DATA_SOURCE)[keyof typeof DATA_SOURCE];

const configuredDataSource = process.env.NEXT_PUBLIC_DATA_SOURCE?.toLowerCase();
const defaultApiBaseUrl = "http://localhost:3001/api/v1";
const configuredAccountApiBaseUrl =
  process.env.NEXT_PUBLIC_ACCOUNT_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL ??
  defaultApiBaseUrl;

export const catalogApiConfig = {
  adminAccessToken: process.env.CATALOG_API_ADMIN_ACCESS_TOKEN,
  baseUrl: (process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, ""),
} as const;

export const accountApiConfig = {
  baseUrl: configuredAccountApiBaseUrl.replace(/\/$/, ""),
} as const;

export function getCatalogDataSource(): DataSource {
  return configuredDataSource === DATA_SOURCE.API ? DATA_SOURCE.API : DATA_SOURCE.MOCK;
}

export function getAccountDataSource(): DataSource {
  return getCatalogDataSource();
}

export { DATA_SOURCE };
export type { DataSource };
