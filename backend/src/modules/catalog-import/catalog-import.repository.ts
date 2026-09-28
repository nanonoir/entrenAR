import { Injectable } from "@nestjs/common";

import { MutationGate } from "../../common/prisma/mutation-gate";
import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { CatalogVisibility, StockMode } from "../../generated/prisma/enums";
import {
  CatalogManifestValidationError,
  type CatalogImportIssue,
  type CatalogImportPlan,
} from "./manifest-validator";

type TransactionClient = Prisma.TransactionClient;

export const CATALOG_IMPORT_REPOSITORY = "catalog-import-repository";

@Injectable()
export class PrismaCatalogImportRepository implements CatalogImportRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mutationGate: MutationGate,
  ) {}

  async existingProductSlugs(): Promise<ReadonlySet<string>> {
    const rows = await this.prisma.product.findMany({ select: { slug: true } });
    return new Set(rows.map((row) => row.slug));
  }

  async existingPublicSlugs(): Promise<ReadonlySet<string>> {
    const rows = await this.prisma.product.findMany({ select: { publicSlug: true } });
    return new Set(rows.map((row) => row.publicSlug));
  }

  async existingVariantSkus(): Promise<ReadonlySet<string>> {
    const rows = await this.prisma.productVariant.findMany({ select: { sku: true } });
    return new Set(rows.map((row) => row.sku));
  }

  async existingCategorySlugs(): Promise<ReadonlySet<string>> {
    const rows = await this.prisma.category.findMany({ select: { slug: true } });
    return new Set(rows.map((row) => row.slug));
  }

  async targetProductCount(): Promise<number> {
    return this.prisma.product.count();
  }

  async persist(plan: CatalogImportPlan): Promise<ImportCounts> {
    return this.mutationGate.runExclusive(this.prisma, async (transaction) => {
      await this.assertCleanTarget(transaction, plan);
      const categoryRows = await transaction.category.findMany({
        select: { id: true, slug: true },
        where: { slug: { in: [...new Set(plan.products.flatMap((product) => product.categorySlugs))] } },
      });
      const categoryIds = new Map(categoryRows.map((category) => [category.slug, category.id]));
      const productRecords = await transaction.product.createManyAndReturn({
        data: plan.products.map((product) => ({
            brand: product.brand,
            compareAtPrice: product.compareAtPrice,
            description: product.descriptionHtml,
            name: product.name,
            price: product.price,
            promotionalPrice: null,
            publicSlug: product.publicSlug,
            shippingRequired: product.shippingRequired,
            slug: product.slug,
            tags: product.tags as Prisma.InputJsonValue,
            variantProperties: product.variantProperties as Prisma.InputJsonValue,
            missingLogistics: product.missingLogistics,
            weightGrams: product.weightGrams,
            heightCm: product.heightCm,
            widthCm: product.widthCm,
            lengthCm: product.lengthCm,
            visibility: CatalogVisibility.VISIBLE,
        })),
        select: { id: true, slug: true },
      });
      const productIds = new Map(productRecords.map((record) => [record.slug, record.id]));
      const imageRows = await transaction.productImage.createManyAndReturn({
        data: plan.products.flatMap((product) => product.images.map((image) => ({
          altText: image.alt,
          position: image.position,
          productId: productIds.get(product.slug) as string,
          storageKey: image.storageKey,
        }))),
        select: { id: true, productId: true, storageKey: true },
      });
      const imageIds = new Map(imageRows.map((image) => [`${image.productId}:${image.storageKey}`, image.id]));
      await transaction.productCategory.createMany({
        data: plan.products.flatMap((product) => product.categorySlugs.map((slug) => ({
          categoryId: categoryIds.get(slug) as string,
          productId: productIds.get(product.slug) as string,
        }))),
      });
      await transaction.productVariant.createMany({
        data: plan.products.flatMap((product) => product.variants.map((variant) => ({
          attributes: variant.attributes as Prisma.InputJsonValue,
          name: variant.name ?? variant.sku,
          primaryImageId: variant.primaryImageStorageKey ? imageIds.get(`${productIds.get(product.slug)}:${variant.primaryImageStorageKey}`) : null,
          productId: productIds.get(product.slug) as string,
          quantity: variant.stockMode === "INFINITE" ? null : variant.quantity ?? 0,
          sku: variant.sku,
          stockMode: variant.stockMode === "INFINITE" ? StockMode.INFINITE : StockMode.TRACKED,
        }))),
      });
      return {
        images: imageRows.length,
        products: productRecords.length,
        variants: plan.products.reduce((total, product) => total + product.variants.length, 0),
      };
    }, { timeout: 30_000 });
  }

  private async assertCleanTarget(transaction: TransactionClient, plan: CatalogImportPlan): Promise<void> {
    const targetCount = await transaction.product.count();
    if (targetCount > 0) {
      throw new CatalogManifestValidationError([{
        code: "TARGET_NOT_CLEAN",
        field: "Product",
        message: "Catalog import requires an empty Product table.",
      }]);
    }
    const slugs = plan.products.map((product) => product.slug);
    const publicSlugs = plan.products.map((product) => product.publicSlug);
    const skus = [...plan.skuSet];
    const [products, variants] = await Promise.all([
      transaction.product.findMany({ select: { slug: true, publicSlug: true }, where: { OR: [{ slug: { in: slugs } }, { publicSlug: { in: publicSlugs } }] } }),
      transaction.productVariant.findMany({ select: { sku: true }, where: { sku: { in: skus } } }),
    ]);
    const issues: CatalogImportIssue[] = [];
    for (const product of products) {
      if (slugs.includes(product.slug)) issues.push({ field: "slug", code: "PRODUCT_SLUG_CONFLICT", message: "Product identity already exists." });
      if (publicSlugs.includes(product.publicSlug)) issues.push({ field: "publicSlug", code: "PUBLIC_SLUG_CONFLICT", message: "Product identity already exists." });
    }
    for (const variant of variants) {
      if (skus.includes(variant.sku)) issues.push({ field: "variants.sku", key: variant.sku, code: "VARIANT_SKU_CONFLICT", message: "Variant identity already exists." });
    }
    if (issues.length > 0) throw new CatalogManifestValidationError(issues);
  }
}

export interface ImportCounts {
  products: number;
  variants: number;
  images: number;
}

export interface CatalogImportRepository {
  existingProductSlugs(): Promise<ReadonlySet<string>>;
  existingPublicSlugs(): Promise<ReadonlySet<string>>;
  existingVariantSkus(): Promise<ReadonlySet<string>>;
  existingCategorySlugs(): Promise<ReadonlySet<string>>;
  targetProductCount?(): Promise<number>;
  persist(plan: CatalogImportPlan): Promise<ImportCounts>;
}
