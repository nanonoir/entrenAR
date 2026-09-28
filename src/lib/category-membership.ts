import type { ProductSummary } from "@/types/product";

export function productBelongsToCategory(product: Pick<ProductSummary, "categorySlug" | "categorySlugs">, categorySlug: string): boolean {
  return product.categorySlug === categorySlug || Boolean(product.categorySlugs?.includes(categorySlug));
}
