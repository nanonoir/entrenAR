import { getCatalogRepository } from "@/lib/api/catalog/catalog.repository";
import type { QuickBuyProduct } from "@/types/product";

function toQuickBuyProduct(product: QuickBuyProduct): QuickBuyProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    imageTone: product.imageTone,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    stock: product.stock,
    variantOptions: product.variantOptions,
    variants: product.variants,
  };
}

export async function getQuickBuyProductBySlug(slug: string): Promise<QuickBuyProduct | null> {
  const result = await getCatalogRepository().getPublicProductBySlug(slug);

  if (result.status !== "success") {
    return null;
  }

  return toQuickBuyProduct(result.data);
}

export async function getQuickBuyOfferProducts(excludedProductIds?: string | string[]): Promise<QuickBuyProduct[]> {
  const excludedIds = new Set(
    Array.isArray(excludedProductIds)
      ? excludedProductIds
      : excludedProductIds
        ? [excludedProductIds]
        : [],
  );

  const result = await getCatalogRepository().getPublicProducts();
  const products = result.status === "success" || result.status === "empty" ? result.data : [];

  return products
    .filter((product) => !excludedIds.has(product.id))
    .filter((product) => product.compareAtPrice && product.compareAtPrice > product.price)
    .slice(0, 12)
    .map(toQuickBuyProduct);
}
