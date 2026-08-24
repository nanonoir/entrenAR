const DATA_SOURCE = {
  API: "api",
  MOCK: "mock",
} as const;

type DataSource = (typeof DATA_SOURCE)[keyof typeof DATA_SOURCE];

const configuredDataSource = process.env.NEXT_PUBLIC_DATA_SOURCE?.toLowerCase();

export const catalogApiConfig = {
  adminAccessToken: process.env.CATALOG_API_ADMIN_ACCESS_TOKEN,
  baseUrl: (process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL ?? "http://localhost:3001/api/v1").replace(/\/$/, ""),
} as const;

export function getCatalogDataSource(): DataSource {
  return configuredDataSource === DATA_SOURCE.API ? DATA_SOURCE.API : DATA_SOURCE.MOCK;
}

export { DATA_SOURCE };
export type { DataSource };
