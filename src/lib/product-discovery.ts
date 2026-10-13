import type { ProductDetail, ProductSummary } from "@/types/product";

/** Detail reads use existential variant availability; summaries use the server projection. */
export function isProductAvailable(product: ProductSummary & Partial<Pick<ProductDetail, "variants">>): boolean {
  return product.variants !== undefined
    ? product.variants.some((variant) => variant.stock > 0)
    : product.stock > 0;
}

export function selectBestSellers(products: readonly ProductDetail[]): ProductDetail[] {
  return products.filter((product) => product.isBestSeller && isProductAvailable(product));
}

function sameCategory(left: ProductSummary, right: ProductSummary): boolean {
  if (left.categories !== undefined || right.categories !== undefined) {
    return Boolean(left.categories?.some((category) => right.categories?.some((other) => other.id === category.id)));
  }
  const slugs = left.categorySlugs ?? [left.categorySlug];
  return (right.categorySlugs ?? [right.categorySlug]).some((slug) => slug !== "" && slugs.includes(slug));
}

function brandIdentity(brand: string): string {
  return brand.trim().normalize("NFKC").toLowerCase();
}

export function selectRelatedProducts(current: ProductSummary, products: readonly ProductDetail[]): ProductDetail[] {
  const brand = brandIdentity(current.brand);
  const seen = new Set<string>([current.id]);
  return products.flatMap((product) => {
    if (seen.has(product.id) || !isProductAvailable(product)) return [];
    seen.add(product.id);
    const rank = sameCategory(current, product) ? 0 : brand && brandIdentity(product.brand) === brand ? 1 : 2;
    return rank < 2 ? [{ product, rank }] : [];
  }).sort((left, right) => left.rank - right.rank || (left.product.id < right.product.id ? -1 : left.product.id > right.product.id ? 1 : 0))
    .slice(0, 4).map(({ product }) => product);
}
