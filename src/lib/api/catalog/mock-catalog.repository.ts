import {
  getAdminProductById,
  getAdminProductCategories,
  getAdminProducts,
  type AdminProduct,
  type AdminProductCategory,
} from "@/lib/data/admin/sales-flow/mock-products";
import { getCategories } from "@/lib/data/categories";
import { getAllProductDetails, getProductBySlug } from "@/lib/data/products";
import type {
  CatalogInventoryHistoryEntry,
  CatalogReadResult,
  CatalogRepository,
} from "@/lib/api/catalog/catalog.repository";
import type { CategoryNavItem } from "@/types/navigation";
import type { ProductDetail } from "@/types/product";

export class MockCatalogRepository implements CatalogRepository {
  async getAdminCategories(): Promise<CatalogReadResult<AdminProductCategory[]>> {
    return { data: await getAdminProductCategories(), status: "success" };
  }

  async getAdminProductById(id: string): Promise<CatalogReadResult<AdminProduct | null>> {
    const product = await getAdminProductById(id);
    return product ? { data: product, status: "success" } : { data: null, status: "empty" };
  }

  async getAdminProducts(): Promise<CatalogReadResult<AdminProduct[]>> {
    const products = await getAdminProducts();
    return products.length > 0 ? { data: products, status: "success" } : { data: products, status: "empty" };
  }

  async getInventoryHistory(productId: string): Promise<CatalogReadResult<CatalogInventoryHistoryEntry[]>> {
    void productId;
    return { data: [], status: "empty" };
  }

  async getPublicCategories(): Promise<CatalogReadResult<CategoryNavItem[]>> {
    const categories = getCategories();
    return categories.length > 0 ? { data: categories, status: "success" } : { data: categories, status: "empty" };
  }

  async getPublicProductBySlug(slug: string): Promise<CatalogReadResult<ProductDetail | null>> {
    const product = getProductBySlug(slug);
    return product ? { data: product, status: "success" } : { data: null, status: "empty" };
  }

  async getPublicProducts(): Promise<CatalogReadResult<ProductDetail[]>> {
    const products = getAllProductDetails();
    return products.length > 0 ? { data: products, status: "success" } : { data: products, status: "empty" };
  }
}
