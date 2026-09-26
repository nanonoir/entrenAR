import { Inject, Injectable } from "@nestjs/common";

import type { ObjectExistencePort } from "./ports/object-existence.port";
import {
  CatalogManifestValidationError,
  normalizeCatalogImportManifest,
  type CatalogImportIssue,
  type CatalogImportPlan,
} from "./manifest-validator";
import type { CatalogImportRepository } from "./catalog-import.repository";
import { CATALOG_IMPORT_REPOSITORY } from "./catalog-import.repository";
import { OBJECT_EXISTENCE_PORT } from "./ports/object-existence.port";

export interface CatalogImportReport {
  ok: boolean;
  runId?: string;
  counts?: { products: number; variants: number; images: number };
  issues?: CatalogImportIssue[];
}

@Injectable()
export class CatalogImportService {
  constructor(
    @Inject(CATALOG_IMPORT_REPOSITORY) private readonly repository: CatalogImportRepository,
    @Inject(OBJECT_EXISTENCE_PORT) private readonly objectExistence: ObjectExistencePort,
  ) {}

  async preflight(input: unknown): Promise<CatalogImportPlan> {
    let plan: CatalogImportPlan;
    try {
      plan = normalizeCatalogImportManifest(input);
    } catch (error) {
      if (error instanceof CatalogManifestValidationError) throw error;
      throw error;
    }

    const [productSlugs, publicSlugs, variantSkus, categorySlugs] = await Promise.all([
      this.repository.existingProductSlugs(),
      this.repository.existingPublicSlugs(),
      this.repository.existingVariantSkus(),
      this.repository.existingCategorySlugs(),
    ]);
    const issues: CatalogImportIssue[] = [];
    const referencedKeys = plan.products.flatMap((product) => product.images.map((image) => ({ productSlug: product.slug, key: image.storageKey })));

    for (const product of plan.products) {
      if (productSlugs.has(product.slug)) issues.push(conflict(product.slug, "slug", "PRODUCT_SLUG_CONFLICT"));
      if (publicSlugs.has(product.publicSlug)) issues.push(conflict(product.slug, "publicSlug", "PUBLIC_SLUG_CONFLICT"));
      for (const category of product.categorySlugs) {
        if (!categorySlugs.has(category)) issues.push({ productSlug: product.slug, field: "categorySlugs", key: category, code: "UNKNOWN_CATEGORY", message: "Category slug does not exist." });
      }
      for (const variant of product.variants) {
        if (variantSkus.has(variant.sku)) issues.push(conflict(product.slug, "variants.sku", "VARIANT_SKU_CONFLICT", variant.sku));
      }
    }

    let existence: Array<{ productSlug: string; key: string; exists: boolean }>;
    try {
      const keys = referencedKeys.map(({ key }) => key);
      const results = this.objectExistence.existsMany
        ? await this.objectExistence.existsMany(keys)
        : new Map(await Promise.all(referencedKeys.map(async ({ key }) => [key, await this.objectExistence.exists(key)] as const)));
      existence = referencedKeys.map(({ productSlug, key }) => ({ productSlug, key, exists: results.get(key) ?? false }));
    } catch {
      throw new CatalogManifestValidationError([{ code: "R2_PREFLIGHT_FAILED", field: "images", message: "Referenced media could not be verified." }]);
    }
    for (const reference of existence) {
      if (!reference.exists) issues.push({ productSlug: reference.productSlug, field: "images", key: reference.key, code: "MISSING_OBJECT", message: "Referenced media object does not exist." });
    }
    if (issues.length > 0) throw new CatalogManifestValidationError(issues);
    return plan;
  }

  async importCatalog(input: unknown): Promise<CatalogImportReport> {
    try {
      const plan = await this.preflight(input);
      const counts = await this.repository.persist(plan);
      return { ok: true, runId: createRunId(), counts };
    } catch (error) {
      if (error instanceof CatalogManifestValidationError) return { ok: false, issues: [...error.issues] };
      return { ok: false, issues: [{ code: "PERSISTENCE_FAILURE", message: "Catalog import could not be completed." }] };
    }
  }
}

function conflict(productSlug: string, field: string, code: string, key?: string): CatalogImportIssue {
  return { productSlug, field, ...(key ? { key } : {}), code, message: "Catalog identity already exists." };
}

function createRunId(): string {
  return `catalog-import-${Date.now().toString(36)}`;
}
