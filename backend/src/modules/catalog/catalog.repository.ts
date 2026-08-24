import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import type { Prisma } from "../../generated/prisma/client";
import { CatalogVisibility, StockMode } from "../../generated/prisma/enums";
import { catalogProductInclude, type CatalogProduct } from "./catalog.mapper";

export interface CreateCategoryRecord {
  description?: string;
  googleShoppingCategory?: string;
  imageUrl?: string;
  name: string;
  parentId?: string;
  seoDescription?: string;
  seoTitle?: string;
  slug: string;
  sortOrder: number;
  visibility: CatalogVisibility;
}

export interface UpdateCategoryRecord extends Omit<CreateCategoryRecord, "sortOrder"> {}

export interface CreateCatalogVariantRecord {
  attributes: Prisma.InputJsonValue;
  compareAtPrice?: number;
  id?: string;
  isDefault: boolean;
  name: string;
  price?: number;
  quantity: number | null;
  sku: string;
  stockMode: StockMode;
}

export interface CreateCatalogProductRecord {
  brand?: string;
  categoryIds: readonly string[];
  compareAtPrice?: number;
  description: string;
  heightCm?: number;
  highlightSections: Prisma.InputJsonValue;
  imageTone?: string;
  imageUrl?: string;
  isBestSeller: boolean;
  isFeatured: boolean;
  lengthCm?: number;
  manualOrder: number;
  missingLogistics: boolean;
  name: string;
  promotionalPrice?: number;
  publicSlug: string;
  salePrice: number;
  seoDescription?: string;
  seoTitle?: string;
  shippingRequired: boolean;
  sku: string;
  slug: string;
  stockMode: StockMode;
  quantity: number | null;
  subcategorySlugs: Prisma.InputJsonValue;
  tags: Prisma.InputJsonValue;
  variantProperties: Prisma.InputJsonValue;
  variants: readonly CreateCatalogVariantRecord[];
  visibility: CatalogVisibility;
  weightGrams?: number;
  widthCm?: number;
}

export interface UpdateCatalogProductRecord extends CreateCatalogProductRecord {
  id: string;
}

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async transaction<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  async categoryById(transaction: TransactionClient, id: string) {
    return transaction.category.findUnique({ where: { id } });
  }

  async categoryBySlug(transaction: TransactionClient, slug: string) {
    return transaction.category.findUnique({ where: { slug } });
  }

  async allCategories(transaction: TransactionClient) {
    return transaction.category.findMany({ orderBy: { id: "asc" } });
  }

  async allCategoriesWithClient() {
    return this.prisma.category.findMany({ orderBy: { id: "asc" } });
  }

  async createCategory(transaction: TransactionClient, data: CreateCategoryRecord) {
    return transaction.category.create({ data });
  }

  async updateCategory(transaction: TransactionClient, id: string, data: UpdateCategoryRecord) {
    return transaction.category.update({ data, where: { id } });
  }

  async setCategoryVisibility(transaction: TransactionClient, ids: readonly string[], visibility: CatalogVisibility): Promise<void> {
    await transaction.category.updateMany({
      data: { visibility },
      where: { id: { in: [...ids] } },
    });
  }

  async countCategoryReferences(transaction: TransactionClient, categoryIds: readonly string[]): Promise<number> {
    return transaction.productCategory.count({ where: { categoryId: { in: [...categoryIds] } } });
  }

  async deleteCategories(transaction: TransactionClient, idsByDescendingDepth: readonly string[]): Promise<void> {
    for (const id of idsByDescendingDepth) {
      await transaction.category.delete({ where: { id } });
    }
  }

  async setCategoryOrder(transaction: TransactionClient, categoryIds: readonly string[]): Promise<void> {
    for (const [index, id] of categoryIds.entries()) {
      await transaction.category.update({ data: { sortOrder: index + 1 }, where: { id } });
    }
  }

  async productById(transaction: TransactionClient, id: string): Promise<CatalogProduct | null> {
    return transaction.product.findUnique({ include: catalogProductInclude, where: { id } });
  }

  async productByIdWithClient(id: string): Promise<CatalogProduct | null> {
    return this.prisma.product.findUnique({ include: catalogProductInclude, where: { id } });
  }

  async productByPublicSlugWithClient(publicSlug: string): Promise<CatalogProduct | null> {
    return this.prisma.product.findUnique({ include: catalogProductInclude, where: { publicSlug } });
  }

  async allProductsWithClient(): Promise<CatalogProduct[]> {
    return this.prisma.product.findMany({ include: catalogProductInclude });
  }

  async countProducts(transaction: TransactionClient): Promise<number> {
    return transaction.product.count();
  }

  async findIdentityConflicts(
    transaction: TransactionClient,
    values: { publicSlug?: string; skus?: readonly string[]; slug?: string },
    ignoredProductId?: string,
  ): Promise<{ publicSlug?: string; sku?: string; slug?: string }> {
    const [slug, publicSlug, products, variants] = await Promise.all([
      values.slug ? transaction.product.findFirst({ select: { id: true }, where: { slug: values.slug, ...(ignoredProductId ? { id: { not: ignoredProductId } } : {}) } }) : null,
      values.publicSlug ? transaction.product.findFirst({ select: { id: true }, where: { publicSlug: values.publicSlug, ...(ignoredProductId ? { id: { not: ignoredProductId } } : {}) } }) : null,
      values.skus && values.skus.length > 0 ? transaction.product.findMany({ select: { sku: true }, where: { sku: { in: [...values.skus] }, ...(ignoredProductId ? { id: { not: ignoredProductId } } : {}) } }) : [],
      values.skus && values.skus.length > 0 ? transaction.productVariant.findMany({ select: { sku: true }, where: { sku: { in: [...values.skus] }, ...(ignoredProductId ? { productId: { not: ignoredProductId } } : {}) } }) : [],
    ]);
    const conflictingSku = [...products, ...variants][0]?.sku;

    return {
      ...(slug ? { slug: values.slug } : {}),
      ...(publicSlug ? { publicSlug: values.publicSlug } : {}),
      ...(conflictingSku ? { sku: conflictingSku } : {}),
    };
  }

  async allSkus(transaction: TransactionClient): Promise<Set<string>> {
    const [products, variants] = await Promise.all([
      transaction.product.findMany({ select: { sku: true } }),
      transaction.productVariant.findMany({ select: { sku: true } }),
    ]);
    return new Set([...products, ...variants].map((record) => record.sku));
  }

  async createProduct(transaction: TransactionClient, data: CreateCatalogProductRecord): Promise<CatalogProduct> {
    const product = await transaction.product.create({
      data: productData(data),
      include: catalogProductInclude,
    });
    await transaction.productCategory.createMany({
      data: data.categoryIds.map((categoryId) => ({ categoryId, productId: product.id })),
    });
    await transaction.productVariant.createMany({
      data: data.variants.map((variant) => ({ ...variant, productId: product.id })),
    });
    return transaction.product.findUniqueOrThrow({ include: catalogProductInclude, where: { id: product.id } });
  }

  async updateProduct(transaction: TransactionClient, data: UpdateCatalogProductRecord): Promise<CatalogProduct> {
    await transaction.product.update({ data: productData(data), where: { id: data.id } });
    await transaction.productCategory.deleteMany({ where: { productId: data.id } });
    await transaction.productCategory.createMany({
      data: data.categoryIds.map((categoryId) => ({ categoryId, productId: data.id })),
    });
    await transaction.productVariant.deleteMany({ where: { productId: data.id } });
    await transaction.productVariant.createMany({
      data: data.variants.map((variant) => ({ ...variant, productId: data.id })),
    });
    return transaction.product.findUniqueOrThrow({ include: catalogProductInclude, where: { id: data.id } });
  }

  async updateProductPrices(
    transaction: TransactionClient,
    id: string,
    data: Pick<CreateCatalogProductRecord, "salePrice"> & Partial<Pick<CreateCatalogProductRecord, "compareAtPrice" | "promotionalPrice">>,
  ): Promise<CatalogProduct> {
    await transaction.product.update({
      data: {
        compareAtPrice: data.compareAtPrice ?? null,
        promotionalPrice: data.promotionalPrice ?? null,
        salePrice: data.salePrice,
      },
      where: { id },
    });
    return transaction.product.findUniqueOrThrow({ include: catalogProductInclude, where: { id } });
  }

  async deleteProduct(transaction: TransactionClient, id: string): Promise<void> {
    await transaction.productCategory.deleteMany({ where: { productId: id } });
    await transaction.product.delete({ where: { id } });
  }
}

function productData(data: CreateCatalogProductRecord): Prisma.ProductUncheckedCreateInput {
  return {
    brand: data.brand,
    compareAtPrice: data.compareAtPrice,
    description: data.description,
    heightCm: data.heightCm,
    highlightSections: data.highlightSections,
    imageTone: data.imageTone,
    imageUrl: data.imageUrl,
    isBestSeller: data.isBestSeller,
    isFeatured: data.isFeatured,
    lengthCm: data.lengthCm,
    manualOrder: data.manualOrder,
    missingLogistics: data.missingLogistics,
    name: data.name,
    promotionalPrice: data.promotionalPrice,
    publicSlug: data.publicSlug,
    quantity: data.quantity,
    salePrice: data.salePrice,
    seoDescription: data.seoDescription,
    seoTitle: data.seoTitle,
    shippingRequired: data.shippingRequired,
    sku: data.sku,
    slug: data.slug,
    stockMode: data.stockMode,
    subcategorySlugs: data.subcategorySlugs,
    tags: data.tags,
    variantProperties: data.variantProperties,
    visibility: data.visibility,
    weightGrams: data.weightGrams,
    widthCm: data.widthCm,
  };
}
