import {
  getAdminProductById,
  getAdminProductCategories,
  getAdminProducts,
  type AdminProduct,
  type AdminProductCategory,
} from "@/lib/data/admin/sales-flow/mock-products";
import { getCategories } from "@/lib/data/categories";
import { getAllProductDetails, getProductBySlug } from "@/lib/data/products";
import { productBelongsToCategory } from "@/lib/category-membership";
import type {
  CatalogListingFacet,
  CatalogListingPage,
  CatalogListingQuery,
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

  async getPublicListing(query: CatalogListingQuery): Promise<CatalogReadResult<CatalogListingPage>> {
    const categories = getCategories();
    const products = getAllProductDetails().filter((product) => {
      if (query.categorySlug && !productInScope(product, query.categorySlug)) return false;
      if (query.brandSlug && slugify(product.brand) !== query.brandSlug) return false;
      if (query.brandSlugs?.length && !query.brandSlugs.includes(slugify(product.brand))) return false;
      if (query.categorySlugs?.length && !query.categorySlugs.some((slug) => productBelongsToCategory(product, slug))) return false;
      if (query.subcategorySlugs?.length && !query.subcategorySlugs.some((slug) => product.subcategorySlugs?.includes(slug))) return false;
      if (query.minPrice !== undefined && product.price < query.minPrice) return false;
      if (query.maxPrice !== undefined && product.price > query.maxPrice) return false;
      if (query.offersOnly && !(product.compareAtPrice !== undefined && product.compareAtPrice > product.price)) return false;
      return !query.search || `${product.name} ${product.brand} ${product.description} ${product.tags.join(" ")}`.toLocaleLowerCase().includes(query.search.toLocaleLowerCase());
    });
    const brandScope = getAllProductDetails().filter((product) =>
      (!query.categorySlug || productInScope(product, query.categorySlug))
      && (!query.brandSlug || slugify(product.brand) === query.brandSlug));
    products.sort((left, right) => {
      if (query.sort === "price-asc") return left.price - right.price || left.id.localeCompare(right.id);
      if (query.sort === "price-desc") return right.price - left.price || left.id.localeCompare(right.id);
      if (query.sort === "best-selling") return Number(right.isBestSeller) - Number(left.isBestSeller) || left.id.localeCompare(right.id);
      return Number(right.isFeatured) - Number(left.isFeatured) || left.id.localeCompare(right.id);
    });
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const facets = listingFacets(brandScope, categories);
    const start = (page - 1) * limit;
    const data: CatalogListingPage = {
      facets,
      items: products.slice(start, start + limit),
      limit,
      page,
      priceBounds: brandScope.length ? {
        min: Math.min(...brandScope.map(({ price }) => price)),
        max: Math.max(...brandScope.map(({ price }) => price)),
      } : { min: 0, max: 0 },
      total: products.length,
      totalPages: Math.ceil(products.length / limit),
    };
    return { data, status: products.length > 0 ? "success" : "empty" };
  }

  async getPublicBrands(): Promise<CatalogReadResult<CatalogListingFacet[]>> {
    const counts = new Map<string, CatalogListingFacet>();
    for (const product of getAllProductDetails()) {
      const slug = slugify(product.brand);
      const current = counts.get(slug);
      if (current) current.count += 1;
      else counts.set(slug, { count: 1, label: product.brand, slug });
    }
    const data = [...counts.values()].sort((left, right) => left.label.localeCompare(right.label));
    return { data, status: data.length > 0 ? "success" : "empty" };
  }
}

function listingFacets(products: ProductDetail[], categories: ReturnType<typeof getCategories>): CatalogListingPage["facets"] {
  const brands = new Map<string, CatalogListingFacet>();
  const categoryCounts = new Map<string, CatalogListingFacet>();
  const subcategories = new Map<string, CatalogListingFacet>();
  for (const product of products) {
    increment(brands, slugify(product.brand), product.brand);
    for (const slug of new Set(product.categorySlugs ?? [product.categorySlug])) {
      increment(categoryCounts, slug, categories.find((category) => category.slug === slug)?.label ?? slug);
    }
    for (const slug of new Set(product.subcategorySlugs ?? [])) increment(subcategories, slug, slug);
  }
  const sort = (items: Map<string, CatalogListingFacet>) => [...items.values()].sort((left, right) => left.label.localeCompare(right.label));
  return { brands: sort(brands), categories: sort(categoryCounts), subcategories: sort(subcategories) };
}

function increment(items: Map<string, CatalogListingFacet>, slug: string, label: string): void {
  const item = items.get(slug);
  if (item) item.count += 1;
  else items.set(slug, { count: 1, label, slug });
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function productInScope(product: ProductDetail, categorySlug: string): boolean {
  if (categorySlug === "suplementos") {
    return ["proteinas", "creatina-y-pre", "vitaminas", "performance", "control-de-peso"]
      .some((slug) => productBelongsToCategory(product, slug));
  }
  return productBelongsToCategory(product, categorySlug);
}
