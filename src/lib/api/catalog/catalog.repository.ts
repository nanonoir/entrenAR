import { DATA_SOURCE, getCatalogDataSource, type DataSource } from "@/lib/api/config";
import { CatalogApiRepository } from "@/lib/api/catalog/catalog-api.repository";
import { MockCatalogRepository } from "@/lib/api/catalog/mock-catalog.repository";
import type { AdminProduct, AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import type { CategoryNavItem } from "@/types/navigation";
import type { ProductDetail } from "@/types/product";

const CATALOG_READ_STATUS = {
  EMPTY: "empty",
  ERROR: "error",
  LOADING: "loading",
  SUCCESS: "success",
} as const;

type CatalogReadStatus = (typeof CATALOG_READ_STATUS)[keyof typeof CATALOG_READ_STATUS];

export type CatalogReadError = {
  code: string;
  message: string;
};

export type CatalogReadResult<T> =
  | { status: typeof CATALOG_READ_STATUS.LOADING }
  | { status: typeof CATALOG_READ_STATUS.SUCCESS; data: T }
  | { status: typeof CATALOG_READ_STATUS.EMPTY; data: T }
  | { status: typeof CATALOG_READ_STATUS.ERROR; error: CatalogReadError };

export type CatalogInventoryHistoryEntry = {
  actor: string;
  change: string;
  createdAt: string;
  id: string;
  origin: string;
  productId: string;
  productName: string;
  reason?: string;
  resultingStock: string;
  type: "stock-edit";
  variantId?: string;
  variantName?: string;
};

export interface CatalogRepository {
  getAdminCategories(): Promise<CatalogReadResult<AdminProductCategory[]>>;
  getAdminProductById(id: string): Promise<CatalogReadResult<AdminProduct | null>>;
  getAdminProducts(): Promise<CatalogReadResult<AdminProduct[]>>;
  getInventoryHistory(productId: string): Promise<CatalogReadResult<CatalogInventoryHistoryEntry[]>>;
  getPublicCategories(): Promise<CatalogReadResult<CategoryNavItem[]>>;
  getPublicProductBySlug(slug: string): Promise<CatalogReadResult<ProductDetail | null>>;
  getPublicProducts(): Promise<CatalogReadResult<ProductDetail[]>>;
}

const mockCatalogRepository = new MockCatalogRepository();
const apiCatalogRepository = new CatalogApiRepository();

export function getCatalogRepository(source = getCatalogDataSource()): CatalogRepository {
  return source === DATA_SOURCE.API ? apiCatalogRepository : mockCatalogRepository;
}

export function catalogLoading<T>(): CatalogReadResult<T> {
  return { status: CATALOG_READ_STATUS.LOADING };
}

export function catalogData<T>(result: CatalogReadResult<T>, empty: T): T {
  if (result.status === CATALOG_READ_STATUS.SUCCESS || result.status === CATALOG_READ_STATUS.EMPTY) {
    return result.data;
  }

  if (result.status === CATALOG_READ_STATUS.ERROR) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }

  return empty;
}

export { CATALOG_READ_STATUS };
export type { CatalogReadStatus, DataSource };
