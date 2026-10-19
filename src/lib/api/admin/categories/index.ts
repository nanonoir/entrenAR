import { DATA_SOURCE, getCatalogDataSource, type DataSource } from "@/lib/api/config";
import { ApiAdminCategoriesRepository } from "./api-categories.repository";
import { MockAdminCategoriesRepository } from "./mock-categories.repository";
import type { AdminCategoriesRepository } from "./repository";

export { ApiAdminCategoriesRepository } from "./api-categories.repository";
export { MockAdminCategoriesRepository } from "./mock-categories.repository";
export type { AdminCategoriesRepository } from "./repository";
export * from "./types";

let apiRepository: AdminCategoriesRepository | undefined;
let mockRepository: AdminCategoriesRepository | undefined;

/** Follows `NEXT_PUBLIC_DATA_SOURCE` so category reads and writes always target the same backend. */
export function getAdminCategoriesRepository(source: DataSource = getCatalogDataSource()): AdminCategoriesRepository {
  if (source === DATA_SOURCE.API) return apiRepository ??= new ApiAdminCategoriesRepository();
  return mockRepository ??= new MockAdminCategoriesRepository();
}
