import { Injectable, NotFoundException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { CatalogVisibility } from "../../generated/prisma/enums";
import {
  toAdminCatalogProduct,
  toAdminCategoryTree,
  toPublicCatalogProduct,
  toPublicCategories,
  type AdminCatalogCategory,
  type AdminCatalogProduct,
  type CatalogProduct,
  type PublicCatalogCategory,
  type PublicCatalogProduct,
} from "./catalog.mapper";
import { CATALOG_ADMIN_PRODUCT_SORT, CATALOG_PUBLIC_PRODUCT_SORT } from "./catalog.constants";
import { CatalogRepository } from "./catalog.repository";
import type { AdminProductListQuery, PublicProductListQuery } from "./catalog.schemas";
import { filterPublicListing, publicBrandDirectory, publicListingMetadata, publicListingScope } from "./public-listing";
import type { PublicListingMetadata } from "./public-listing";

export interface CatalogPage<T> {
  items: T[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
  facets?: PublicListingMetadata["facets"];
  priceBounds?: PublicListingMetadata["priceBounds"];
}

@Injectable()
export class CatalogQueryService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async adminCategories(): Promise<AdminCatalogCategory[]> {
    return toAdminCategoryTree(await this.catalogRepository.allCategoriesWithClient());
  }

  async adminProducts(query: AdminProductListQuery): Promise<CatalogPage<AdminCatalogProduct>> {
    const records = await this.catalogRepository.allProductsWithClient();
    const search = query.search?.toLocaleLowerCase();
    const filtered = records.filter((product) => {
      if (query.categoryId && !product.categories.some((entry) => entry.categoryId === query.categoryId)) return false;
      if (query.visibility && product.visibility !== visibility(query.visibility)) return false;
      if (!search) return true;
      return [product.brand, product.name, ...product.variants.map((variant) => variant.sku), product.slug, product.publicSlug]
        .some((value) => value?.toLocaleLowerCase().includes(search));
    });
    const mapped = filtered.map(toAdminCatalogProduct);
    mapped.sort((left, right) => this.compareAdminProducts(left, right, query.sort));
    return page(mapped, query.page, query.limit);
  }

  async publicCategories(): Promise<PublicCatalogCategory[]> {
    return toPublicCategories(await this.catalogRepository.allCategoriesWithClient());
  }

  async publicBrands() {
    const [products, categories] = await Promise.all([
      this.catalogRepository.allProductsWithClient(),
      this.catalogRepository.allCategoriesWithClient(),
    ]);
    return publicBrandDirectory(publicListingScope(products, toPublicCategories(categories)));
  }

  async publicProduct(publicSlug: string): Promise<PublicCatalogProduct> {
    const [product, categories] = await Promise.all([
      this.catalogRepository.productByPublicSlugWithClient(publicSlug),
      this.catalogRepository.allCategoriesWithClient(),
    ]);
    if (!product || !this.isPublicProduct(product, toPublicCategories(categories))) throw this.notFound();
    return toPublicCatalogProduct(product);
  }

  async publicProducts(query: PublicProductListQuery): Promise<CatalogPage<PublicCatalogProduct>> {
    const [products, categories] = await Promise.all([
      this.catalogRepository.allProductsWithClient(),
      this.catalogRepository.allCategoriesWithClient(),
    ]);
    const publicCategories = toPublicCategories(categories);
    const routeScope = publicListingScope(products, publicCategories, query.categorySlug, query.brandSlug);
    const metadata = publicListingMetadata(routeScope, publicCategories, query.categorySlug);
    const filtered = filterPublicListing(routeScope, query, publicCategories);
    filtered.sort((left, right) => this.comparePublicProducts(left, right, query.sort));
    const mapped = filtered.map(toPublicCatalogProduct);
    return { ...page(mapped, query.page, query.limit), ...metadata };
  }

  private compareAdminProducts(
    left: AdminCatalogProduct,
    right: AdminCatalogProduct,
    sort: AdminProductListQuery["sort"],
  ): number {
    if (sort === CATALOG_ADMIN_PRODUCT_SORT.PRICE_ASC) return left.salePrice - right.salePrice || left.id.localeCompare(right.id);
    if (sort === CATALOG_ADMIN_PRODUCT_SORT.PRICE_DESC) return right.salePrice - left.salePrice || left.id.localeCompare(right.id);
    if (sort === CATALOG_ADMIN_PRODUCT_SORT.NEWEST) return right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id);
    return left.manualOrder - right.manualOrder || left.id.localeCompare(right.id);
  }

  private comparePublicProducts(
    left: CatalogProduct,
    right: CatalogProduct,
    sort: PublicProductListQuery["sort"],
  ): number {
    const leftPrice = Number(left.price);
    const rightPrice = Number(right.price);
    if (sort === CATALOG_PUBLIC_PRODUCT_SORT.PRICE_ASC) return leftPrice - rightPrice || left.id.localeCompare(right.id);
    if (sort === CATALOG_PUBLIC_PRODUCT_SORT.PRICE_DESC) return rightPrice - leftPrice || left.id.localeCompare(right.id);
    if (sort === CATALOG_PUBLIC_PRODUCT_SORT.NEWEST) return right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id);
    if (sort === CATALOG_PUBLIC_PRODUCT_SORT.BEST_SELLING) {
      return Number(right.isBestSeller) - Number(left.isBestSeller)
        || right.salesCount - left.salesCount
        || left.id.localeCompare(right.id);
    }
    return Number(right.isFeatured) - Number(left.isFeatured) || left.manualOrder - right.manualOrder || left.id.localeCompare(right.id);
  }

  private isPublicProduct(
    product: Awaited<ReturnType<CatalogRepository["productByPublicSlugWithClient"]>> & {},
    categories: readonly PublicCatalogCategory[],
  ): boolean {
    return product.visibility === CatalogVisibility.VISIBLE && product.categories.some((entry) => categories.some((category) => category.id === entry.categoryId));
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message: "The requested public product was not found.", ok: false });
  }
}

function page<T>(items: readonly T[], currentPage: number, limit: number): CatalogPage<T> {
  return {
    items: items.slice((currentPage - 1) * limit, currentPage * limit),
    limit,
    page: currentPage,
    total: items.length,
    totalPages: Math.ceil(items.length / limit),
  };
}

function visibility(value: "hidden" | "visible"): CatalogVisibility {
  return value === "hidden" ? CatalogVisibility.HIDDEN : CatalogVisibility.VISIBLE;
}
