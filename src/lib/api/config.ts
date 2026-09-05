import { ApiCustomersRepository } from "@/lib/api/admin/customers/api-customers.repository";
import { MockCustomersRepository } from "@/lib/api/admin/customers/mock-customers.repository";
import { customersApiConfig } from "@/lib/api/admin/customers/customers-api-config";
import type { CustomersRepository } from "@/lib/api/admin/customers/repository";
import { ApiAbandonedCartsRepository } from "@/lib/api/admin/abandoned-carts/api-abandoned-carts-repository";
import { MockAbandonedCartsRepository } from "@/lib/api/admin/abandoned-carts/mock-abandoned-carts-repository";
import { abandonedCartsApiConfig } from "@/lib/api/admin/abandoned-carts/abandoned-carts-api-config";
import type { AbandonedCartsRepository } from "@/lib/api/admin/abandoned-carts/repository";
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
const configuredAdminCustomersSource = process.env.NEXT_PUBLIC_ADMIN_DATA_SOURCE?.trim().toLowerCase();
const configuredAdminCustomersMock = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_CUSTOMERS?.trim().toLowerCase();
const configuredAdminAbandonedCartsMock = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_ABANDONED_CARTS?.trim().toLowerCase();
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
export const adminAbandonedCartsApiConfig = abandonedCartsApiConfig;

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

export function getAdminCustomersDataSource(): DataSource {
  if (configuredAdminCustomersMock === "true" || configuredAdminCustomersMock === "1") return DATA_SOURCE.MOCK;
  if (configuredAdminCustomersMock === "false" || configuredAdminCustomersMock === "0") return DATA_SOURCE.API;
  const source = configuredAdminCustomersSource ?? configuredDataSource;
  return source === DATA_SOURCE.API ? DATA_SOURCE.API : DATA_SOURCE.MOCK;
}

export function getAdminAbandonedCartsDataSource(): DataSource {
  if (configuredAdminAbandonedCartsMock === "true" || configuredAdminAbandonedCartsMock === "1") return DATA_SOURCE.MOCK;
  if (configuredAdminAbandonedCartsMock === "false" || configuredAdminAbandonedCartsMock === "0") return DATA_SOURCE.API;
  return configuredDataSource === DATA_SOURCE.API ? DATA_SOURCE.API : DATA_SOURCE.MOCK;
}

export const salesRepository: SalesRepository = getAdminSalesDataSource() === DATA_SOURCE.API
  ? new ApiSalesRepository()
  : new MockSalesRepository();

export const customersRepository: CustomersRepository = getAdminCustomersDataSource() === DATA_SOURCE.API
  ? new ApiCustomersRepository()
  : new MockCustomersRepository();

export const abandonedCartsRepository: AbandonedCartsRepository = getAdminAbandonedCartsDataSource() === DATA_SOURCE.API
  ? new ApiAbandonedCartsRepository()
  : new MockAbandonedCartsRepository();

export { DATA_SOURCE };
export { salesApiConfig };
export { customersApiConfig };
export { abandonedCartsApiConfig };
export const adminCustomersApiConfig = customersApiConfig;
export type { DataSource };

function normalizeBaseUrl(value: string): string {
  return (value.trim() || defaultApiBaseUrl).replace(/\/$/, "");
}
