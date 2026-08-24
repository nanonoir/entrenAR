import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import type { Prisma } from "../../generated/prisma/client";
import { CatalogVisibility, StockMode } from "../../generated/prisma/enums";
import { toAdminCatalogProduct, type AdminCatalogProduct, type CatalogProduct } from "./catalog.mapper";
import {
  CatalogRepository,
  type CreateCatalogProductRecord,
  type CreateCatalogVariantRecord,
  type UpdateCatalogProductRecord,
} from "./catalog.repository";
import { CATALOG_STOCK_MODE } from "./catalog.constants";
import {
  slugify,
  type ProductCreateInput,
  type ProductUpdateInput,
  type VariantCombinationInput,
  type VariantPropertyInput,
} from "./catalog.schemas";

interface PreparedVariant {
  attributes: Record<string, string>;
  compareAtPrice?: number;
  id?: string;
  isDefault: boolean;
  name: string;
  price?: number;
  sku: string;
  stock: number | "infinite";
}

@Injectable()
export class ProductService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async create(input: ProductCreateInput): Promise<AdminCatalogProduct> {
    return this.catalogRepository.transaction(async (transaction) => {
      await this.assertCategoriesExist(transaction, input.categoryIds);
      const identities = await this.identitiesForInput(transaction, input);
      const variants = this.validateVariantConfiguration(input.variantProperties, input.variantCombinations, identities.skus, input.stockMode, input.stockQuantity);
      const product = await this.catalogRepository.createProduct(transaction, this.toCreateRecord(input, identities, variants, await this.nextManualOrder(transaction)));
      return toAdminCatalogProduct(product);
    });
  }

  async update(input: ProductUpdateInput): Promise<AdminCatalogProduct> {
    return this.catalogRepository.transaction(async (transaction) => {
      const current = await this.catalogRepository.productById(transaction, input.id);
      if (!current) throw this.notFound();
      await this.assertCategoriesExist(transaction, input.categoryIds);
      const identities = await this.identitiesForInput(transaction, input, current);
      const variants = this.validateVariantConfiguration(input.variantProperties, input.variantCombinations, identities.skus, input.stockMode, input.stockQuantity);
      const product = await this.catalogRepository.updateProduct(transaction, {
        ...this.toCreateRecord(input, identities, variants, current.manualOrder),
        id: current.id,
      });
      return toAdminCatalogProduct(product);
    });
  }

  async duplicate(id: string): Promise<AdminCatalogProduct> {
    return this.catalogRepository.transaction(async (transaction) => {
      const source = await this.catalogRepository.productById(transaction, id);
      if (!source) throw this.notFound();
      const takenSkus = await this.catalogRepository.allSkus(transaction);
      const slug = await this.nextUniqueSlug(transaction, source.slug);
      const publicSlug = await this.nextUniquePublicSlug(transaction, source.publicSlug);
      const sku = nextUniqueSku(source.sku, takenSkus);
      const variants = source.variants.map((variant) => ({
        attributes: jsonRecord(variant.attributes),
        ...(variant.compareAtPrice ? { compareAtPrice: moneyNumber(variant.compareAtPrice) } : {}),
        isDefault: variant.isDefault,
        name: variant.name,
        ...(variant.price ? { price: moneyNumber(variant.price) } : {}),
        quantity: variant.stockMode === StockMode.INFINITE ? null : variant.quantity ?? 0,
        sku: nextUniqueSku(variant.sku, takenSkus),
        stockMode: variant.stockMode === StockMode.INFINITE ? StockMode.INFINITE : StockMode.TRACKED,
      } satisfies CreateCatalogVariantRecord));
      const duplicate = await this.catalogRepository.createProduct(transaction, {
        ...(source.brand ? { brand: source.brand } : {}),
        categoryIds: source.categories.map((entry) => entry.categoryId),
        ...(source.compareAtPrice ? { compareAtPrice: moneyNumber(source.compareAtPrice) } : {}),
        description: source.description ?? "Catalog product duplicate.",
        ...(source.heightCm ? { heightCm: source.heightCm } : {}),
        highlightSections: jsonValue(source.highlightSections),
        ...(source.imageTone ? { imageTone: source.imageTone } : {}),
        ...(source.imageUrl ? { imageUrl: source.imageUrl } : {}),
        isBestSeller: source.isBestSeller,
        isFeatured: source.isFeatured,
        ...(source.lengthCm ? { lengthCm: source.lengthCm } : {}),
        manualOrder: await this.nextManualOrder(transaction),
        missingLogistics: source.missingLogistics,
        name: `${source.name} Copy`,
        ...(source.promotionalPrice ? { promotionalPrice: moneyNumber(source.promotionalPrice) } : {}),
        publicSlug,
        quantity: source.stockMode === StockMode.INFINITE ? null : source.quantity ?? 0,
        salePrice: moneyNumber(source.salePrice),
        ...(source.seoDescription ? { seoDescription: source.seoDescription } : {}),
        ...(source.seoTitle ? { seoTitle: source.seoTitle } : {}),
        shippingRequired: source.shippingRequired,
        sku,
        slug,
        stockMode: source.stockMode === StockMode.INFINITE ? StockMode.INFINITE : StockMode.TRACKED,
        subcategorySlugs: jsonValue(source.subcategorySlugs),
        tags: jsonValue(source.tags),
        variantProperties: jsonValue(source.variantProperties),
        variants,
        visibility: source.visibility,
        ...(source.weightGrams ? { weightGrams: source.weightGrams } : {}),
        ...(source.widthCm ? { widthCm: source.widthCm } : {}),
      });
      return toAdminCatalogProduct(duplicate);
    });
  }

  private async assertCategoriesExist(
    transaction: Parameters<CatalogRepository["allCategories"]>[0],
    categoryIds: readonly string[],
  ): Promise<void> {
    const categories = await this.catalogRepository.allCategories(transaction);
    if (!categoryIds.every((id) => categories.some((category) => category.id === id))) {
      throw new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message: "One or more product categories were not found.", ok: false });
    }
  }

  private async identitiesForInput(
    transaction: Parameters<CatalogRepository["allSkus"]>[0],
    input: ProductCreateInput | ProductUpdateInput,
    current?: CatalogProduct,
  ): Promise<{ publicSlug: string; sku: string; skus: Set<string>; slug: string }> {
    const takenSkus = await this.catalogRepository.allSkus(transaction);
    if (current) {
      takenSkus.delete(current.sku);
      for (const variant of current.variants) takenSkus.delete(variant.sku);
    }
    const slug = input.slug
      ? await this.assertAvailableSlug(transaction, input.slug, current?.id)
      : await this.nextUniqueSlug(transaction, input.name, current?.id);
    const publicSlug = input.publicSlug
      ? await this.assertAvailablePublicSlug(transaction, input.publicSlug, current?.id)
      : await this.nextUniquePublicSlug(transaction, slug, current?.id);
    const sku = input.sku ? this.assertAvailableSku(input.sku, takenSkus) : nextUniqueSku(`SKU-${slug}`, takenSkus);

    return { publicSlug, sku, skus: takenSkus, slug };
  }

  private validateVariantConfiguration(
    properties: readonly VariantPropertyInput[],
    combinations: readonly VariantCombinationInput[],
    takenSkus: Set<string>,
    productStockMode: "infinite" | "limited",
    productStockQuantity: number | undefined,
  ): PreparedVariant[] {
    if (properties.length === 0) {
      if (combinations.length > 0) throw this.validationConflict("Products without option axes must not submit variant combinations.");
      return [{
        attributes: {},
        isDefault: true,
        name: "Default",
        sku: nextUniqueSku("SKU-DEFAULT", takenSkus),
        stock: productStockMode === CATALOG_STOCK_MODE.INFINITE ? CATALOG_STOCK_MODE.INFINITE : productStockQuantity ?? 0,
      }];
    }

    const expected = cartesianCombinations(properties);
    if (combinations.length !== expected.size) {
      throw this.validationConflict("Variant combinations must exactly match the active option Cartesian product.");
    }

    const result: PreparedVariant[] = [];
    const submitted = new Set<string>();
    for (const combination of combinations) {
      const attributes = combination.attributes ?? attributesFromName(combination.name, properties);
      const key = attributeKey(attributes, properties);
      if (!expected.has(key) || submitted.has(key)) {
        throw this.validationConflict("Variant combinations must exactly match the active option Cartesian product.");
      }
      submitted.add(key);
      const sku = combination.sku
        ? this.assertAvailableSku(combination.sku, takenSkus)
        : nextUniqueSku(`SKU-${combination.name}`, takenSkus);
      result.push({
        attributes,
        ...(combination.compareAtPrice ? { compareAtPrice: combination.compareAtPrice } : {}),
        ...(combination.id ? { id: combination.id } : {}),
        isDefault: false,
        name: combination.name,
        ...(combination.price ? { price: combination.price } : {}),
        sku,
        stock: combination.stock,
      });
    }
    if (submitted.size !== expected.size) {
      throw this.validationConflict("Variant combinations must exactly match the active option Cartesian product.");
    }
    return result;
  }

  private toCreateRecord(
    input: ProductCreateInput | ProductUpdateInput,
    identities: { publicSlug: string; sku: string; slug: string },
    variants: readonly PreparedVariant[],
    manualOrder: number,
  ): CreateCatalogProductRecord {
    const stockMode = input.stockMode === CATALOG_STOCK_MODE.INFINITE ? StockMode.INFINITE : StockMode.TRACKED;

    return {
      ...(input.brand ? { brand: input.brand } : {}),
      categoryIds: input.categoryIds,
      ...(input.compareAtPrice ? { compareAtPrice: input.compareAtPrice } : {}),
      description: input.description,
      ...(input.heightCm ? { heightCm: input.heightCm } : {}),
      highlightSections: jsonValue(input.highlightSections),
      ...(input.imageTone ? { imageTone: input.imageTone } : {}),
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      isBestSeller: input.isBestSeller,
      isFeatured: input.isFeatured,
      ...(input.lengthCm ? { lengthCm: input.lengthCm } : {}),
      manualOrder,
      missingLogistics: !(input.weightGrams && input.heightCm && input.widthCm && input.lengthCm),
      name: input.name,
      ...(input.promotionalPrice ? { promotionalPrice: input.promotionalPrice } : {}),
      publicSlug: identities.publicSlug,
      quantity: stockMode === StockMode.INFINITE ? null : input.stockQuantity ?? 0,
      salePrice: input.salePrice,
      ...(input.seoDescription ? { seoDescription: input.seoDescription } : {}),
      ...(input.seoTitle ? { seoTitle: input.seoTitle } : {}),
      shippingRequired: input.shippingRequired,
      sku: identities.sku,
      slug: identities.slug,
      stockMode,
      subcategorySlugs: jsonValue(input.subcategorySlugs),
      tags: jsonValue(input.tags),
      variantProperties: jsonValue(input.variantProperties),
      variants: variants.map((variant) => ({
        attributes: jsonValue(variant.attributes),
        ...(variant.compareAtPrice ? { compareAtPrice: variant.compareAtPrice } : {}),
        ...(variant.id ? { id: variant.id } : {}),
        isDefault: variant.isDefault ?? false,
        name: variant.name,
        ...(variant.price ? { price: variant.price } : {}),
        quantity: variant.stock === CATALOG_STOCK_MODE.INFINITE ? null : variant.stock,
        sku: variant.sku,
        stockMode: variant.stock === CATALOG_STOCK_MODE.INFINITE ? StockMode.INFINITE : StockMode.TRACKED,
      })),
      visibility: input.visibility === "hidden" ? CatalogVisibility.HIDDEN : CatalogVisibility.VISIBLE,
      ...(input.weightGrams ? { weightGrams: input.weightGrams } : {}),
      ...(input.widthCm ? { widthCm: input.widthCm } : {}),
    };
  }

  private async assertAvailableSlug(transaction: Parameters<CatalogRepository["findIdentityConflicts"]>[0], value: string, ignoredProductId?: string): Promise<string> {
    const slug = slugify(value);
    const conflict = await this.catalogRepository.findIdentityConflicts(transaction, { slug }, ignoredProductId);
    if (conflict.slug) throw this.slugConflict("slug");
    return slug;
  }

  private async assertAvailablePublicSlug(transaction: Parameters<CatalogRepository["findIdentityConflicts"]>[0], value: string, ignoredProductId?: string): Promise<string> {
    const publicSlug = slugify(value);
    const conflict = await this.catalogRepository.findIdentityConflicts(transaction, { publicSlug }, ignoredProductId);
    if (conflict.publicSlug) throw this.slugConflict("publicSlug");
    return publicSlug;
  }

  private assertAvailableSku(value: string, takenSkus: Set<string>): string {
    const sku = value.trim().toLocaleUpperCase();
    if (takenSkus.has(sku)) throw this.skuConflict();
    takenSkus.add(sku);
    return sku;
  }

  private async nextUniqueSlug(transaction: Parameters<CatalogRepository["findIdentityConflicts"]>[0], value: string, ignoredProductId?: string): Promise<string> {
    const root = slugify(value);
    for (let suffix = 1; ; suffix += 1) {
      const slug = suffix === 1 ? root : `${root}-${suffix}`;
      const conflict = await this.catalogRepository.findIdentityConflicts(transaction, { slug }, ignoredProductId);
      if (!conflict.slug) return slug;
    }
  }

  private async nextUniquePublicSlug(transaction: Parameters<CatalogRepository["findIdentityConflicts"]>[0], value: string, ignoredProductId?: string): Promise<string> {
    const root = slugify(value);
    for (let suffix = 1; ; suffix += 1) {
      const publicSlug = suffix === 1 ? root : `${root}-${suffix}`;
      const conflict = await this.catalogRepository.findIdentityConflicts(transaction, { publicSlug }, ignoredProductId);
      if (!conflict.publicSlug) return publicSlug;
    }
  }

  private async nextManualOrder(transaction: Parameters<CatalogRepository["countProducts"]>[0]): Promise<number> {
    return (await this.catalogRepository.countProducts(transaction)) + 1;
  }

  private slugConflict(field: string): ConflictException {
    return new ConflictException({ code: ERROR_CODE.SLUG_CONFLICT, message: `Product ${field} is already in use.`, ok: false });
  }

  private skuConflict(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.SKU_CONFLICT, message: "Product and variant SKUs must be globally unique.", ok: false });
  }

  private validationConflict(message: string): ConflictException {
    return new ConflictException({ code: ERROR_CODE.VALIDATION_ERROR, message, ok: false });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message: "The requested product was not found.", ok: false });
  }
}

function attributesFromName(name: string, properties: readonly VariantPropertyInput[]): Record<string, string> {
  const labels = name.split("/").map((part) => part.trim());
  if (labels.length !== properties.length) throw new ConflictException({ code: ERROR_CODE.VALIDATION_ERROR, message: "Variant combination names must identify every option value.", ok: false });
  const attributes: Record<string, string> = {};
  for (const [index, property] of properties.entries()) {
    const label = labels[index];
    const value = property.values.find((candidate) => candidate.label === label);
    if (!value) throw new ConflictException({ code: ERROR_CODE.VALIDATION_ERROR, message: "Variant combination names contain an unknown option value.", ok: false });
    attributes[property.id] = value.id;
  }
  return attributes;
}

function attributeKey(attributes: Readonly<Record<string, string>>, properties: readonly VariantPropertyInput[]): string {
  if (Object.keys(attributes).length !== properties.length) return "";
  const pairs: string[] = [];
  for (const property of properties) {
    const valueId = attributes[property.id];
    if (!valueId || !property.values.some((value) => value.id === valueId)) return "";
    pairs.push(`${property.id}=${valueId}`);
  }
  return pairs.join("|");
}

function cartesianCombinations(properties: readonly VariantPropertyInput[]): Set<string> {
  let combinations: Record<string, string>[] = [{}];
  for (const property of properties) {
    combinations = combinations.flatMap((combination) => property.values.map((value) => ({ ...combination, [property.id]: value.id })));
  }
  return new Set(combinations.map((combination) => attributeKey(combination, properties)));
}

function jsonRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function moneyNumber(value: { toString(): string }): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error("Persisted money must be finite.");
  return numberValue;
}

function nextUniqueSku(base: string, takenSkus: Set<string>): string {
  const root = slugify(base).replaceAll("-", "-").toLocaleUpperCase();
  for (let suffix = 1; ; suffix += 1) {
    const sku = suffix === 1 ? root : `${root}-${suffix}`;
    if (!takenSkus.has(sku)) {
      takenSkus.add(sku);
      return sku;
    }
  }
}
