import type { CartPreviewItem } from "@/types/cart";
import { getVariantDisplayLabel } from "@/lib/variant-selection";
import type { ProductDetail, ProductImage, ProductVariant } from "@/types/product";

type CartItemProduct = Pick<
  ProductDetail,
  "brand" | "id" | "imageTone" | "name" | "slug"
> & Partial<Pick<ProductDetail, "images" | "variantOptions" | "variants">>;

export function getProductImage(
  images: readonly ProductImage[] | undefined,
  variant?: Pick<ProductVariant, "primaryImageId"> | null,
): ProductImage | undefined {
  const variantImage = variant?.primaryImageId
    ? images?.find((image) => image.id === variant.primaryImageId && image.url)
    : undefined;

  return variantImage ?? images?.find((image) => image.url);
}

export function toCartPreviewItem({
  product,
  quantity,
  variant,
}: {
  product: CartItemProduct;
  quantity: number;
  variant: ProductVariant;
}): CartPreviewItem {
  const image = getProductImage(product.images, variant);

  return {
    productId: product.id,
    variantId: variant.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    variantLabel: getVariantDisplayLabel({ variantOptions: product.variantOptions, variants: product.variants ?? [variant] }, variant),
    quantity: Math.min(quantity, variant.stock),
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    stock: variant.stock,
    imageTone: product.imageTone,
    ...(image?.url ? { imageUrl: image.url, imageAlt: image.alt || product.name } : {}),
  };
}
