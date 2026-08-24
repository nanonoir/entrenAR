import type { Prisma } from "../../generated/prisma/client";
import { CatalogVisibility, StockMode } from "../../generated/prisma/enums";
import { toPublicStockNumber } from "../inventory/inventory.mapper";

export const catalogProductInclude = {
  categories: { include: { category: true } },
  variants: { orderBy: { id: "asc" } },
} satisfies Prisma.ProductInclude;

export type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof catalogProductInclude }>;

export interface AdminCatalogCategory {
  children: AdminCatalogCategory[];
  createdAt: string;
  description?: string;
  googleShoppingCategory?: string;
  id: string;
  imageUrl?: string;
  name: string;
  parentId?: string;
  seoDescription?: string;
  seoTitle?: string;
  slug: string;
  sortOrder: number;
  updatedAt: string;
  visibility: "hidden" | "visible";
}

export interface PublicCatalogCategory {
  id: string;
  name: string;
  parentId?: string;
  slug: string;
}

export interface AdminCatalogProduct {
  brand?: string;
  categoryId: string;
  categoryIds: string[];
  categoryName: string;
  compareAtPrice?: number;
  createdAt: string;
  description?: string;
  heightCm?: number;
  highlightSections: string[];
  id: string;
  imageTone?: string;
  imageUrl?: string;
  lengthCm?: number;
  manualOrder: number;
  missingLogistics: boolean;
  name: string;
  promotionalPrice?: number;
  publicSlug: string;
  salePrice: number;
  salesCount: number;
  seoDescription?: string;
  seoTitle?: string;
  shippingRequired: boolean;
  sku: string;
  slug: string;
  stock: { quantity: number } | { type: "infinite" };
  tags: string[];
  updatedAt: string;
  variantCombinations: AdminCatalogVariant[];
  variantProperties: unknown[];
  visibility: "hidden" | "visible";
  weightGrams?: number;
  widthCm?: number;
}

export interface AdminCatalogVariant {
  attributes: Record<string, string>;
  compareAtPrice?: number;
  id: string;
  name: string;
  price: number;
  sku: string;
  stock: number | "infinite";
}

export interface PublicCatalogProduct {
  compareAtPrice?: number;
  id: string;
  name: string;
  price: number;
  slug: string;
  stock: number;
  variants: PublicCatalogVariant[];
}

export interface PublicCatalogVariant {
  id: string;
  label: string;
  optionValues: Record<string, string>;
  price: number;
  stock: number;
}

export function toAdminCatalogProduct(product: CatalogProduct): AdminCatalogProduct {
  const categories = [...product.categories].sort((left, right) => left.category.id.localeCompare(right.category.id));
  const primaryCategory = categories[0]?.category;

  return {
    ...(product.brand ? { brand: product.brand } : {}),
    categoryId: primaryCategory?.id ?? "",
    categoryIds: categories.map((entry) => entry.categoryId),
    categoryName: primaryCategory?.name ?? "",
    ...(product.compareAtPrice ? { compareAtPrice: decimalToNumber(product.compareAtPrice) } : {}),
    createdAt: product.createdAt.toISOString(),
    ...(product.description ? { description: product.description } : {}),
    ...(product.heightCm ? { heightCm: product.heightCm } : {}),
    highlightSections: stringArray(product.highlightSections),
    id: product.id,
    ...(product.imageTone ? { imageTone: product.imageTone } : {}),
    ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
    ...(product.lengthCm ? { lengthCm: product.lengthCm } : {}),
    manualOrder: product.manualOrder,
    missingLogistics: product.missingLogistics,
    name: product.name,
    ...(product.promotionalPrice ? { promotionalPrice: decimalToNumber(product.promotionalPrice) } : {}),
    publicSlug: product.publicSlug,
    salePrice: decimalToNumber(product.salePrice),
    salesCount: product.salesCount,
    ...(product.seoDescription ? { seoDescription: product.seoDescription } : {}),
    ...(product.seoTitle ? { seoTitle: product.seoTitle } : {}),
    shippingRequired: product.shippingRequired,
    sku: product.sku,
    slug: product.slug,
    stock: toAdminProductStock(product.stockMode, product.quantity),
    tags: stringArray(product.tags),
    updatedAt: product.updatedAt.toISOString(),
    variantCombinations: product.variants.map((variant) => toAdminCatalogVariant(variant, decimalToNumber(product.salePrice))),
    variantProperties: unknownArray(product.variantProperties),
    visibility: toVisibility(product.visibility),
    ...(product.weightGrams ? { weightGrams: product.weightGrams } : {}),
    ...(product.widthCm ? { widthCm: product.widthCm } : {}),
  };
}

export function toPublicCatalogProduct(product: CatalogProduct): PublicCatalogProduct {
  const productPrice = decimalToNumber(product.salePrice);

  return {
    ...(product.compareAtPrice ? { compareAtPrice: decimalToNumber(product.compareAtPrice) } : {}),
    id: product.id,
    name: product.name,
    price: productPrice,
    slug: product.publicSlug,
    stock: toPublicStockNumber({ quantity: product.quantity, stockMode: product.stockMode }),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.name,
      optionValues: stringRecord(variant.attributes),
      price: variant.price ? decimalToNumber(variant.price) : productPrice,
      stock: toPublicStockNumber({ quantity: variant.quantity, stockMode: variant.stockMode }),
    })),
  };
}

export function toAdminCategoryTree(categories: readonly Prisma.CategoryGetPayload<Record<string, never>>[]): AdminCatalogCategory[] {
  const childrenByParentId = new Map<string | undefined, Prisma.CategoryGetPayload<Record<string, never>>[]>();
  for (const category of categories) {
    const key = category.parentId ?? undefined;
    const children = childrenByParentId.get(key) ?? [];
    children.push(category);
    childrenByParentId.set(key, children);
  }

  const sort = (items: Prisma.CategoryGetPayload<Record<string, never>>[]): Prisma.CategoryGetPayload<Record<string, never>>[] => {
    return items.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  };
  const mapBranch = (parentId: string | undefined): AdminCatalogCategory[] => sort(childrenByParentId.get(parentId) ?? []).map((category) => ({
    children: mapBranch(category.id),
    createdAt: category.createdAt.toISOString(),
    ...(category.description ? { description: category.description } : {}),
    ...(category.googleShoppingCategory ? { googleShoppingCategory: category.googleShoppingCategory } : {}),
    id: category.id,
    ...(category.imageUrl ? { imageUrl: category.imageUrl } : {}),
    name: category.name,
    ...(category.parentId ? { parentId: category.parentId } : {}),
    ...(category.seoDescription ? { seoDescription: category.seoDescription } : {}),
    ...(category.seoTitle ? { seoTitle: category.seoTitle } : {}),
    slug: category.slug,
    sortOrder: category.sortOrder,
    updatedAt: category.updatedAt.toISOString(),
    visibility: toVisibility(category.visibility),
  }));

  return mapBranch(undefined);
}

export function toPublicCategories(categories: readonly Prisma.CategoryGetPayload<Record<string, never>>[]): PublicCatalogCategory[] {
  const byId = new Map(categories.map((category) => [category.id, category]));

  return [...categories]
    .filter((category) => isPubliclyVisible(category, byId))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
    .map((category) => ({
      id: category.id,
      name: category.name,
      ...(category.parentId ? { parentId: category.parentId } : {}),
      slug: category.slug,
    }));
}

function decimalToNumber(value: { toString(): string } | number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error("Catalog money values must serialize to finite numbers.");
  return numberValue;
}

function isPubliclyVisible(
  category: Prisma.CategoryGetPayload<Record<string, never>>,
  byId: ReadonlyMap<string, Prisma.CategoryGetPayload<Record<string, never>>>,
): boolean {
  const visited = new Set<string>();
  let current: Prisma.CategoryGetPayload<Record<string, never>> | undefined = category;
  while (current) {
    if (visited.has(current.id) || current.visibility !== CatalogVisibility.VISIBLE) return false;
    visited.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return true;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function unknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? [...value] : [];
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function toAdminCatalogVariant(
  variant: CatalogProduct["variants"][number],
  productPrice: number,
): AdminCatalogVariant {
  return {
    attributes: stringRecord(variant.attributes),
    ...(variant.compareAtPrice ? { compareAtPrice: decimalToNumber(variant.compareAtPrice) } : {}),
    id: variant.id,
    name: variant.name,
    price: variant.price ? decimalToNumber(variant.price) : productPrice,
    sku: variant.sku,
    stock: toAdminStock(variant.stockMode, variant.quantity),
  };
}

function toAdminStock(stockMode: StockMode, quantity: number | null): number | "infinite" {
  return stockMode === StockMode.INFINITE ? "infinite" : quantity ?? 0;
}

function toAdminProductStock(stockMode: StockMode, quantity: number | null): { quantity: number } | { type: "infinite" } {
  return stockMode === StockMode.INFINITE ? { type: "infinite" } : { quantity: quantity ?? 0 };
}

function toVisibility(visibility: CatalogVisibility): "hidden" | "visible" {
  return visibility === CatalogVisibility.HIDDEN ? "hidden" : "visible";
}
