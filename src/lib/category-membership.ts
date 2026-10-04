import type { ProductSummary } from "@/types/product";

export function productBelongsToCategory(product: Pick<ProductSummary, "categorySlug" | "categorySlugs">, categorySlug: string): boolean {
  if (product.categorySlugs !== undefined) return product.categorySlugs.includes(categorySlug);
  return product.categorySlug === categorySlug;
}
