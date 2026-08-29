import type { PublicCatalogProduct } from "../catalog/catalog.mapper";

export const DEFAULT_WISHLIST_IMAGE_TONE = "green" as const;

export interface WishlistProductSummary {
  brand: string;
  categoryName: string;
  categorySlug: string;
  compareAtPrice?: number;
  id: string;
  imageTone: string;
  isBestSeller: boolean;
  isFeatured: boolean;
  name: string;
  price: number;
  rating: number;
  reviews: number;
  shortDescription: string;
  slug: string;
  stock: number;
  subcategorySlugs: string[];
  tags: string[];
}

export function toWishlistProduct(product: PublicCatalogProduct): WishlistProductSummary {
  return {
    brand: product.brand,
    categoryName: product.categoryName,
    categorySlug: product.categorySlug,
    ...(product.compareAtPrice === undefined ? {} : { compareAtPrice: product.compareAtPrice }),
    id: product.id,
    imageTone: product.imageTone ?? DEFAULT_WISHLIST_IMAGE_TONE,
    isBestSeller: product.isBestSeller,
    isFeatured: product.isFeatured,
    name: product.name,
    price: product.price,
    rating: 0,
    reviews: 0,
    shortDescription: product.shortDescription,
    slug: product.slug,
    stock: product.stock,
    subcategorySlugs: product.subcategorySlugs,
    tags: product.tags,
  };
}
