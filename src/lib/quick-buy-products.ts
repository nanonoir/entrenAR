// Mock client-safe para el flujo visual estatico. Reemplazar por una API cuando el backend este implementado.
import { getAllProductDetails, getProductBySlug } from "@/lib/data/products";
import type { QuickBuyProduct } from "@/types/product";

function toQuickBuyProduct(product: NonNullable<ReturnType<typeof getProductBySlug>>): QuickBuyProduct {
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
  const product = getProductBySlug(slug);

  if (!product) {
    return null;
  }

  return toQuickBuyProduct(product);
}

export async function getQuickBuyOfferProducts(excludedProductIds?: string | string[]): Promise<QuickBuyProduct[]> {
  const excludedIds = new Set(
    Array.isArray(excludedProductIds)
      ? excludedProductIds
      : excludedProductIds
        ? [excludedProductIds]
        : [],
  );

  return getAllProductDetails()
    .filter((product) => !excludedIds.has(product.id))
    .filter((product) => product.compareAtPrice && product.compareAtPrice > product.price)
    .slice(0, 12)
    .map(toQuickBuyProduct);
}
