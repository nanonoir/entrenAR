import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { MutationGate } from "../../common/prisma/mutation-gate";
import { Prisma } from "../../generated/prisma/client";
import { CatalogVisibility, StockMode } from "../../generated/prisma/enums";
import {
  catalogProductInclude,
  checkoutProductSelect,
  toCheckoutCatalogProduct,
  type CatalogProduct,
  type CheckoutCatalogProduct,
} from "./catalog.mapper";

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

export type UpdateCategoryRecord = Omit<CreateCategoryRecord, "sortOrder">;

export interface CreateCatalogVariantRecord {
  attributes: Prisma.InputJsonValue;
  id?: string;
  name: string;
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
  isBestSeller: boolean;
  isFeatured: boolean;
  lengthCm?: number;
  manualOrder: number;
  missingLogistics: boolean;
  name: string;
  promotionalPrice?: number;
  publicSlug: string;
  price: number;
  seoDescription?: string;
  seoTitle?: string;
  shippingRequired: boolean;
  slug: string;
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
  private readonly mutationGate = new MutationGate();

  constructor(private readonly prisma: PrismaService) {}

  async transaction<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T> {
    return this.mutationGate.runShared(this.prisma, callback);
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

  async checkoutProductById(transaction: TransactionClient, id: string): Promise<CheckoutCatalogProduct | null> {
    const product = await transaction.product.findUnique({ select: checkoutProductSelect, where: { id } });

    return product ? toCheckoutCatalogProduct(product) : null;
  }

  async checkoutProductByIdForUpdate(transaction: TransactionClient, id: string): Promise<CheckoutCatalogProduct | null> {
    await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${id} FOR UPDATE`,
    );
    await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "ProductVariant" WHERE "productId" = ${id} ORDER BY "id" FOR UPDATE`,
    );

    return this.checkoutProductById(transaction, id);
  }

  async productForCheckout(transaction: TransactionClient, id: string): Promise<CheckoutCatalogProduct | null> {
    return this.checkoutProductById(transaction, id);
  }

  async checkoutCategoryVisibility(transaction: TransactionClient): Promise<CheckoutCategoryVisibilityRecord[]> {
    return transaction.category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, parentId: true, visibility: true },
    });
  }

  async publicCheckoutCategoryIds(transaction: TransactionClient): Promise<ReadonlySet<string>> {
    const categories = await this.checkoutCategoryVisibility(transaction);
    const byId = new Map(categories.map((category) => [category.id, category]));
    const publicIds = new Set<string>();

    for (const category of categories) {
      if (isPublicCategory(category, byId)) publicIds.add(category.id);
    }

    return publicIds;
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
    const slug = values.slug
      ? await transaction.product.findFirst({ select: { id: true }, where: { slug: values.slug, ...(ignoredProductId ? { id: { not: ignoredProductId } } : {}) } })
      : null;
    const publicSlug = values.publicSlug
      ? await transaction.product.findFirst({ select: { id: true }, where: { publicSlug: values.publicSlug, ...(ignoredProductId ? { id: { not: ignoredProductId } } : {}) } })
      : null;
    const variants = values.skus && values.skus.length > 0
      ? await transaction.productVariant.findMany({ select: { sku: true }, where: { sku: { in: [...values.skus] }, ...(ignoredProductId ? { productId: { not: ignoredProductId } } : {}) } })
      : [];
    const conflictingSku = variants[0]?.sku;

    return {
      ...(slug ? { slug: values.slug } : {}),
      ...(publicSlug ? { publicSlug: values.publicSlug } : {}),
      ...(conflictingSku ? { sku: conflictingSku } : {}),
    };
  }

  async allSkus(transaction: TransactionClient): Promise<Set<string>> {
    const variants = await transaction.productVariant.findMany({ select: { sku: true } });
    return new Set(variants.map((record) => record.sku));
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
    const currentVariants = await transaction.productVariant.findMany({ where: { productId: data.id }, select: { id: true, sku: true } });
    const matched = new Set<string>();
    for (const variant of data.variants) {
      const current = currentVariants.find((candidate) => candidate.id === variant.id || candidate.sku === variant.sku);
      const variantData = {
        attributes: variant.attributes,
        name: variant.name,
        quantity: variant.quantity,
        sku: variant.sku,
        stockMode: variant.stockMode,
      };
      if (current) {
        matched.add(current.id);
        await transaction.productVariant.update({ data: variantData, where: { id: current.id } });
      } else {
        await transaction.productVariant.create({ data: { ...variantData, productId: data.id } });
      }
    }
    for (const current of currentVariants) {
      if (matched.has(current.id)) continue;
      const [historyCount, cartCount] = await Promise.all([
        transaction.inventoryHistory.count({ where: { variantId: current.id } }),
        transaction.cartItem.count({ where: { variantId: current.id } }),
      ]);
      if (historyCount === 0 && cartCount === 0) await transaction.productVariant.delete({ where: { id: current.id } });
    }
    return transaction.product.findUniqueOrThrow({ include: catalogProductInclude, where: { id: data.id } });
  }

  async updateProductPrices(
    transaction: TransactionClient,
    id: string,
    data: Pick<CreateCatalogProductRecord, "price"> & Partial<Pick<CreateCatalogProductRecord, "compareAtPrice" | "promotionalPrice">>,
  ): Promise<CatalogProduct> {
    await transaction.product.update({
      data: {
        compareAtPrice: data.compareAtPrice ?? null,
        price: data.price,
        promotionalPrice: data.promotionalPrice ?? null,
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

export type CheckoutCategoryVisibilityRecord = Pick<Prisma.CategoryGetPayload<Record<string, never>>, "id" | "parentId" | "visibility">;

function isPublicCategory(
  category: CheckoutCategoryVisibilityRecord,
  byId: ReadonlyMap<string, CheckoutCategoryVisibilityRecord>,
): boolean {
  const visited = new Set<string>();
  let current: CheckoutCategoryVisibilityRecord | undefined = category;

  while (current) {
    if (visited.has(current.id) || current.visibility !== CatalogVisibility.VISIBLE) return false;
    visited.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return true;
}

function productData(data: CreateCatalogProductRecord): Prisma.ProductUncheckedCreateInput {
  return {
    brand: data.brand,
    compareAtPrice: data.compareAtPrice,
    description: data.description,
    heightCm: data.heightCm,
    highlightSections: data.highlightSections,
    isBestSeller: data.isBestSeller,
    isFeatured: data.isFeatured,
    lengthCm: data.lengthCm,
    manualOrder: data.manualOrder,
    missingLogistics: data.missingLogistics,
    name: data.name,
    price: data.price,
    promotionalPrice: data.promotionalPrice,
    publicSlug: data.publicSlug,
    seoDescription: data.seoDescription,
    seoTitle: data.seoTitle,
    shippingRequired: data.shippingRequired,
    slug: data.slug,
    subcategorySlugs: data.subcategorySlugs,
    tags: data.tags,
    variantProperties: data.variantProperties,
    visibility: data.visibility,
    weightGrams: data.weightGrams,
    widthCm: data.widthCm,
  };
}
