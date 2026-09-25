import { Prisma } from "../../../generated/prisma/client";
import type { ShowcaseResetReport } from "../showcase-reset.report";
import type { FixtureRestorer } from "../fixtures/fixture-restorer";
import {
  CATALOG_PRODUCTS,
  CATALOG_SETTINGS_ID,
  CATEGORIES,
  inferredProperties,
  productSku,
  stockFields,
  variantAttributes,
} from "../fixtures/catalog-commerce-baseline";

export class CatalogFixtureRestorer implements FixtureRestorer {
  readonly family = "catalog" as const;

  async restore(transaction: Prisma.TransactionClient, report: ShowcaseResetReport): Promise<void> {
    const preserved = await this.countPreserved(transaction);
    let created = 0;
    let updated = 0;

    for (const category of CATEGORIES) {
      const exists = await transaction.category.findUnique({ where: { id: category.id }, select: { id: true } });
      await transaction.category.upsert({
        where: { id: category.id },
        create: { ...category, visibility: category.visibility ?? "VISIBLE" },
        update: { ...category, visibility: category.visibility ?? "VISIBLE" },
      });
      exists ? updated++ : created++;
    }

    for (const product of CATALOG_PRODUCTS) {
      const productExists = await transaction.product.findUnique({ where: { id: product.id }, select: { id: true } });
      const productData = {
        brand: product.brand,
        compareAtPrice: product.compareAtPrice,
        description: product.description,
        highlightSections: [],
        imageTone: product.imageTone,
        legacySourceId: product.legacySourceId,
        manualOrder: product.manualOrder,
        name: product.name,
        promotionalPrice: product.promotionalPrice,
        publicSlug: product.publicSlug,
        salePrice: product.salePrice,
        sku: productSku(product),
        slug: product.slug,
        subcategorySlugs: [],
        tags: [...(product.tags ?? [])],
        variantProperties: inferredProperties(product),
        visibility: product.visibility ?? "VISIBLE" as const,
      };
      await transaction.product.upsert({
        where: { id: product.id },
        create: { id: product.id, ...stockFields(product.stock), ...productData },
        update: productData,
      });
      productExists ? updated++ : created++;

      const relationshipExists = await transaction.productCategory.findUnique({
        where: { productId_categoryId: { productId: product.id, categoryId: product.categoryId } },
        select: { productId: true },
      });
      await transaction.productCategory.upsert({
        where: { productId_categoryId: { productId: product.id, categoryId: product.categoryId } },
        create: { productId: product.id, categoryId: product.categoryId },
        update: {},
      });
      relationshipExists ? updated++ : created++;

      for (const variant of product.variants) {
        const variantExists = await transaction.productVariant.findUnique({ where: { id: variant.id }, select: { id: true } });
        const variantData = {
          attributes: variantAttributes(product, variant),
          compareAtPrice: variant.compareAtPrice,
          isDefault: product.variants.length === 1,
          name: variant.name,
          price: variant.price,
          productId: product.id,
          sku: variant.sku ?? `${productSku(product)}-${variant.id.toUpperCase()}`,
        };
        await transaction.productVariant.upsert({ where: { id: variant.id }, create: { id: variant.id, ...stockFields(variant.stock), ...variantData }, update: variantData });
        variantExists ? updated++ : created++;
      }
    }

    const settingsExists = await transaction.catalogSettings.findUnique({ where: { id: CATALOG_SETTINGS_ID }, select: { id: true } });
    await transaction.catalogSettings.upsert({
      where: { id: CATALOG_SETTINGS_ID },
      create: { id: CATALOG_SETTINGS_ID, persistOrder: true, showOutOfStockAtEnd: true },
      update: { persistOrder: true, showOutOfStockAtEnd: true },
    });
    settingsExists ? updated++ : created++;
    report.recordFamily(this.family, { created, preserved, updated });
  }

  private async countPreserved(transaction: Prisma.TransactionClient): Promise<number> {
    const categoryIds = CATEGORIES.map(({ id }) => id);
    const productIds = CATALOG_PRODUCTS.map(({ id }) => id);
    const variantIds = CATALOG_PRODUCTS.flatMap((product) => product.variants.map(({ id }) => id));
    const requiredPairs = CATALOG_PRODUCTS.map(({ id: productId, categoryId }) => ({ productId, categoryId }));
    const [categories, products, variants, relationships, settings] = await Promise.all([
      transaction.category.count({ where: { id: { notIn: categoryIds } } }),
      transaction.product.count({ where: { id: { notIn: productIds } } }),
      transaction.productVariant.count({ where: { id: { notIn: variantIds } } }),
      transaction.productCategory.count({ where: { NOT: { OR: requiredPairs } } }),
      transaction.catalogSettings.count({ where: { id: { not: CATALOG_SETTINGS_ID } } }),
    ]);
    return categories + products + variants + relationships + settings;
  }
}
