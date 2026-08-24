import { CatalogApiError, FetchCatalogApiClient, type CatalogApiClient } from "@/lib/api/catalog/client";
import type {
  CatalogInventoryHistoryEntry,
  CatalogReadResult,
  CatalogRepository,
} from "@/lib/api/catalog/catalog.repository";
import { getCategories } from "@/lib/data/categories";
import { getAllProductDetails } from "@/lib/data/products";
import type { AdminProduct, AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import type { CategoryNavItem } from "@/types/navigation";
import type { ProductDetail, ProductImageTone, ProductVariantOption } from "@/types/product";

const PUBLIC_INFINITE_STOCK = Number.MAX_SAFE_INTEGER;

const FALLBACK_IMAGE_TONE: ProductImageTone = "green";

type CatalogPage<T> = {
  items: T[];
  limit: number;
  page: number;
  total: number;
};

type PublicCatalogCategoryDto = {
  id: string;
  name: string;
  parentId?: string;
  slug: string;
};

type PublicCatalogVariantDto = {
  compareAtPrice?: number | string;
  id: string;
  label: string;
  optionValues: Record<string, string>;
  price: number | string;
  stock: number | string;
  stockMode?: "infinite" | "limited";
};

type PublicCatalogProductDto = {
  brand?: string;
  categoryName?: string;
  categorySlug?: string;
  compareAtPrice?: number | string;
  description?: string;
  id: string;
  imageTone?: string;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  name: string;
  price: number | string;
  shortDescription?: string;
  slug: string;
  stock: number | string;
  stockMode?: "infinite" | "limited";
  subcategorySlugs?: string[];
  tags?: string[];
  variants: PublicCatalogVariantDto[];
  variantProperties?: unknown[];
};

type AdminCatalogVariantDto = {
  attributes: Record<string, string>;
  compareAtPrice?: number | string;
  id: string;
  name: string;
  price: number | string;
  sku: string;
  stock: number | "infinite";
};

type AdminCatalogProductDto = {
  brand?: string;
  categoryId: string;
  categoryIds: string[];
  categoryName: string;
  createdAt: string;
  description?: string;
  heightCm?: number;
  highlightSections: string[];
  id: string;
  imageUrl?: string;
  lengthCm?: number;
  manualOrder: number;
  missingLogistics: boolean;
  name: string;
  promotionalPrice?: number | string;
  publicSlug: string;
  salePrice: number | string;
  salesCount: number;
  seoDescription?: string;
  seoTitle?: string;
  shippingRequired: boolean;
  sku: string;
  slug: string;
  stock: { quantity: number | string } | { type: "infinite" };
  tags: string[];
  updatedAt: string;
  variantCombinations: AdminCatalogVariantDto[];
  variantProperties: unknown[];
  visibility: "hidden" | "visible";
  weightGrams?: number;
  widthCm?: number;
};

type AdminCatalogCategoryDto = Omit<AdminProductCategory, "parentId"> & {
  children: AdminCatalogCategoryDto[];
  parentId?: string;
};

type InventoryHistoryPageDto = {
  items: CatalogInventoryHistoryEntry[];
};

export class CatalogApiRepository implements CatalogRepository {
  constructor(private readonly client: CatalogApiClient = new FetchCatalogApiClient()) {}

  async getAdminCategories(): Promise<CatalogReadResult<AdminProductCategory[]>> {
    return this.read(async () => {
      const categories = await this.client.get<AdminCatalogCategoryDto[]>("/admin/categories", { admin: true });
      return flattenAdminCategories(categories);
    });
  }

  async getAdminProductById(id: string): Promise<CatalogReadResult<AdminProduct | null>> {
    try {
      return { data: mapAdminProduct(await this.client.get<AdminCatalogProductDto>(`/admin/products/${encodeURIComponent(id)}`, { admin: true })), status: "success" };
    } catch (error) {
      return this.failureOrEmpty(error, null);
    }
  }

  async getAdminProducts(): Promise<CatalogReadResult<AdminProduct[]>> {
    return this.read(async () => {
      const page = await this.client.get<CatalogPage<AdminCatalogProductDto>>(
        "/admin/products?page=1&limit=100&sort=manual-order",
        { admin: true },
      );
      return page.items.map(mapAdminProduct);
    });
  }

  async getInventoryHistory(productId: string): Promise<CatalogReadResult<CatalogInventoryHistoryEntry[]>> {
    return this.read(async () => {
      const page = await this.client.get<InventoryHistoryPageDto>(
        `/admin/inventory/history?productId=${encodeURIComponent(productId)}&page=1&limit=100`,
        { admin: true },
      );
      return page.items;
    });
  }

  async getPublicCategories(): Promise<CatalogReadResult<CategoryNavItem[]>> {
    return this.read(async () => {
      const categories = await this.client.get<PublicCatalogCategoryDto[]>("/categories");
      return categories.map(mapPublicCategory);
    });
  }

  async getPublicProductBySlug(slug: string): Promise<CatalogReadResult<ProductDetail | null>> {
    try {
      return { data: mapPublicProduct(await this.client.get<PublicCatalogProductDto>(`/products/${encodeURIComponent(slug)}`)), status: "success" };
    } catch (error) {
      return this.failureOrEmpty(error, null);
    }
  }

  async getPublicProducts(): Promise<CatalogReadResult<ProductDetail[]>> {
    return this.read(async () => {
      const page = await this.client.get<CatalogPage<PublicCatalogProductDto>>(
        "/products?page=1&limit=100&sort=featured",
      );
      return page.items.map(mapPublicProduct);
    });
  }

  private async read<T>(read: () => Promise<T[]>): Promise<CatalogReadResult<T[]>> {
    try {
      const data = await read();
      return data.length > 0 ? { data, status: "success" } : { data, status: "empty" };
    } catch (error) {
      return this.failureOrEmpty(error, []);
    }
  }

  private failureOrEmpty<T>(error: unknown, empty: T): CatalogReadResult<T> {
    if (error instanceof CatalogApiError && error.status === 404) {
      return { data: empty, status: "empty" };
    }

    return {
      error: {
        code: error instanceof CatalogApiError ? error.code : "CATALOG_ADAPTER_ERROR",
        message: error instanceof Error ? error.message : "The catalog response could not be mapped.",
      },
      status: "error",
    };
  }
}

function mapPublicProduct(product: PublicCatalogProductDto): ProductDetail {
  const fallback = getAllProductDetails().find((item) => item.id === product.id || item.slug === product.slug);
  const imageTone = toImageTone(product.imageTone) ?? fallback?.imageTone ?? FALLBACK_IMAGE_TONE;
  const price = finiteNumber(product.price, "price");
  const stock = toPublicStock(product.stock, product.stockMode);
  const categorySlug = product.categorySlug ?? fallback?.categorySlug ?? "uncategorized";
  const categoryName = product.categoryName ?? fallback?.categoryName ?? "Uncategorized";

  return {
    brand: product.brand ?? fallback?.brand ?? "EntrenAR",
    categoryName,
    categorySlug,
    ...(product.compareAtPrice === undefined && fallback?.compareAtPrice === undefined
      ? {}
      : { compareAtPrice: finiteNumber(product.compareAtPrice ?? fallback?.compareAtPrice ?? price, "compareAtPrice") }),
    description: firstNonEmpty(product.description, fallback?.description, product.shortDescription, fallback?.shortDescription, product.name),
    id: product.id,
    imageTone,
    images: fallback?.images ?? createCompatibilityImages(product.id, product.name, imageTone),
    isBestSeller: product.isBestSeller || fallback?.isBestSeller,
    isFeatured: product.isFeatured || fallback?.isFeatured,
    name: product.name,
    price,
    rating: fallback?.rating ?? 0,
    reviews: fallback?.reviews ?? 0,
    shortDescription: firstNonEmpty(product.shortDescription, fallback?.shortDescription, product.description, fallback?.description, product.name),
    slug: product.slug,
    stock,
    subcategorySlugs: product.subcategorySlugs && product.subcategorySlugs.length > 0 ? product.subcategorySlugs : fallback?.subcategorySlugs,
    tags: product.tags ?? fallback?.tags ?? [],
    variantOptions: mapVariantOptions(product.variantProperties, fallback?.variantOptions),
    variants: product.variants.map((variant) => ({
      ...(variant.compareAtPrice === undefined ? {} : { compareAtPrice: finiteNumber(variant.compareAtPrice, "variant.compareAtPrice") }),
      id: variant.id,
      label: variant.label,
      optionValues: variant.optionValues,
      price: finiteNumber(variant.price, "variant.price"),
      stock: toPublicStock(variant.stock, variant.stockMode),
    })),
  };
}

function mapPublicCategory(category: PublicCatalogCategoryDto): CategoryNavItem {
  const fallback = getCategories().find((item) => item.slug === category.slug);

  return {
    description: fallback?.description ?? `Productos de ${category.name}.`,
    ...(fallback?.featured ? { featured: true } : {}),
    ...(fallback?.groups ? { groups: fallback.groups } : {}),
    label: category.name,
    slug: category.slug,
  };
}

function flattenAdminCategories(categories: readonly AdminCatalogCategoryDto[]): AdminProductCategory[] {
  return categories.flatMap((category) => {
    const { children, ...current } = category;
    return [current, ...flattenAdminCategories(children)];
  });
}

function mapAdminProduct(product: AdminCatalogProductDto): AdminProduct {
  return {
    ...(product.brand ? { brand: product.brand } : {}),
    categoryId: product.categoryId,
    categoryIds: product.categoryIds,
    categoryName: product.categoryName,
    createdAt: product.createdAt,
    ...(product.description ? { description: product.description } : {}),
    ...(product.heightCm === undefined ? {} : { heightCm: product.heightCm }),
    highlightSections: product.highlightSections,
    id: product.id,
    ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
    ...(product.lengthCm === undefined ? {} : { lengthCm: product.lengthCm }),
    manualOrder: product.manualOrder,
    missingLogistics: product.missingLogistics,
    name: product.name,
    ...(product.promotionalPrice === undefined ? {} : { promotionalPrice: finiteNumber(product.promotionalPrice, "promotionalPrice") }),
    publicSlug: product.publicSlug,
    salePrice: finiteNumber(product.salePrice, "salePrice"),
    salesCount: product.salesCount,
    ...(product.seoDescription ? { seoDescription: product.seoDescription } : {}),
    ...(product.seoTitle ? { seoTitle: product.seoTitle } : {}),
    shippingRequired: product.shippingRequired,
    sku: product.sku,
    slug: product.slug,
    stock: "type" in product.stock ? { type: "infinite" } : { quantity: finiteNumber(product.stock.quantity, "stock.quantity"), type: "limited" },
    tags: product.tags,
    updatedAt: product.updatedAt,
    variantCombinations: product.variantCombinations.map((variant) => ({
      id: variant.id,
      name: variant.name,
      ...(variant.price === undefined ? {} : { price: finiteNumber(variant.price, "variant.price") }),
      sku: variant.sku,
      stock: variant.stock === "infinite" ? "infinite" : finiteNumber(variant.stock, "variant.stock"),
    })),
    variantProperties: mapAdminVariantProperties(product.variantProperties),
    visibility: product.visibility,
    ...(product.weightGrams === undefined ? {} : { weightGrams: product.weightGrams }),
    ...(product.widthCm === undefined ? {} : { widthCm: product.widthCm }),
  };
}

function mapAdminVariantProperties(value: unknown[]): Array<{ name: string; values: string[] }> {
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || !("name" in item) || typeof item.name !== "string" || !("values" in item) || !Array.isArray(item.values)) {
      return [];
    }

    return [{
      name: item.name,
      values: item.values.flatMap((value) => {
        if (typeof value === "string") return [value];
        if (value && typeof value === "object" && "label" in value && typeof value.label === "string") return [value.label];
        return [];
      }),
    }];
  });
}

function mapVariantOptions(value: unknown[] | undefined, fallback: ProductVariantOption[] | undefined): ProductVariantOption[] | undefined {
  if (!value) return fallback;

  const options = value.flatMap((item) => {
    if (!item || typeof item !== "object" || !("name" in item) || typeof item.name !== "string" || !("values" in item) || !Array.isArray(item.values)) {
      return [];
    }

    return [{
      id: "id" in item && typeof item.id === "string" ? item.id : slugify(item.name),
      label: item.name,
      values: item.values.flatMap((entry) => {
        if (typeof entry === "string") return [{ id: slugify(entry), label: entry }];
        if (!entry || typeof entry !== "object") return [];
        const label = "label" in entry && typeof entry.label === "string" ? entry.label : "id" in entry && typeof entry.id === "string" ? entry.id : undefined;
        if (!label) return [];
        return [{ id: "id" in entry && typeof entry.id === "string" ? entry.id : slugify(label), label }];
      }),
    }];
  });

  return options.length > 0 ? options : fallback;
}

function createCompatibilityImages(id: string, name: string, tone: ProductImageTone): ProductDetail["images"] {
  return [{ alt: name, id: `${id}-compatibility-image`, label: "Principal", tone }];
}

function finiteNumber(value: number | string, field: string): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) throw new Error(`Catalog ${field} must be a finite number.`);
  return normalized;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => value?.trim()) ?? "";
}

function toImageTone(value: string | undefined): ProductImageTone | undefined {
  return value === "green" || value === "black" || value === "red" || value === "amber" || value === "blue" ? value : undefined;
}

function toPublicStock(value: number | string, mode: "infinite" | "limited" | undefined): number {
  if (mode === "infinite" || value === "infinite") return PUBLIC_INFINITE_STOCK;
  return Math.max(0, finiteNumber(value, "stock"));
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
