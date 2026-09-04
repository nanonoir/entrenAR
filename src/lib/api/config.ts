import { ApiSalesRepository } from "@/lib/api/admin/sales/api-sales.repository";
import { MockSalesRepository } from "@/lib/api/admin/sales/mock-sales.repository";
import { salesApiConfig } from "@/lib/api/admin/sales/sales-api-config";
import type { SalesRepository } from "@/lib/api/admin/sales/sales.repository";

const DATA_SOURCE = {
  API: "api",
  MOCK: "mock",
} as const;

type DataSource = (typeof DATA_SOURCE)[keyof typeof DATA_SOURCE];

const configuredDataSource = process.env.NEXT_PUBLIC_DATA_SOURCE?.trim().toLowerCase();
const configuredCommerceDataSource = process.env.NEXT_PUBLIC_COMMERCE_DATA_SOURCE?.trim().toLowerCase();
const configuredCheckoutDataSource = process.env.NEXT_PUBLIC_CHECKOUT_DATA_SOURCE?.trim().toLowerCase();
const configuredAdminSalesMock = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_SALES?.trim().toLowerCase();
const defaultApiBaseUrl = "http://localhost:3001/api/v1";
const configuredAccountApiBaseUrl =
  process.env.NEXT_PUBLIC_ACCOUNT_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL ??
  defaultApiBaseUrl;
const configuredCommerceApiBaseUrl =
  process.env.NEXT_PUBLIC_COMMERCE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_ACCOUNT_API_BASE_URL ??
  process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL ??
  defaultApiBaseUrl;
const configuredCheckoutApiBaseUrl =
  process.env.NEXT_PUBLIC_CHECKOUT_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_ACCOUNT_API_BASE_URL ??
  process.env.NEXT_PUBLIC_COMMERCE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL ??
  defaultApiBaseUrl;

export const catalogApiConfig = {
  adminAccessToken: process.env.CATALOG_API_ADMIN_ACCESS_TOKEN,
  baseUrl: (process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, ""),
} as const;

export const accountApiConfig = {
  baseUrl: configuredAccountApiBaseUrl.replace(/\/$/, ""),
} as const;

export const commerceApiConfig = {
  baseUrl: normalizeBaseUrl(configuredCommerceApiBaseUrl),
} as const;

export const checkoutApiConfig = {
  baseUrl: normalizeBaseUrl(configuredCheckoutApiBaseUrl),
} as const;

export const adminSalesApiConfig = salesApiConfig;

export function getCatalogDataSource(): DataSource {
  return configuredDataSource === DATA_SOURCE.API ? DATA_SOURCE.API : DATA_SOURCE.MOCK;
}

export function getAccountDataSource(): DataSource {
  return getCatalogDataSource();
}

export function getCommerceDataSource(): DataSource {
  const source = configuredCommerceDataSource ?? configuredDataSource;
  return source === DATA_SOURCE.API ? DATA_SOURCE.API : DATA_SOURCE.MOCK;
}

export function getCheckoutDataSource(): DataSource {
  const source = configuredCheckoutDataSource ?? configuredDataSource;
  return source === DATA_SOURCE.API ? DATA_SOURCE.API : DATA_SOURCE.MOCK;
}

export function getAdminSalesDataSource(): DataSource {
  if (configuredAdminSalesMock === "true" || configuredAdminSalesMock === "1") return DATA_SOURCE.MOCK;
  if (configuredAdminSalesMock === "false" || configuredAdminSalesMock === "0") return DATA_SOURCE.API;
  return configuredDataSource === DATA_SOURCE.API ? DATA_SOURCE.API : DATA_SOURCE.MOCK;
}

export const salesRepository: SalesRepository = getAdminSalesDataSource() === DATA_SOURCE.API
  ? new ApiSalesRepository()
  : new MockSalesRepository();

export { DATA_SOURCE };
export { salesApiConfig };
export type { DataSource };

function normalizeBaseUrl(value: string): string {
  return (value.trim() || defaultApiBaseUrl).replace(/\/$/, "");
}
