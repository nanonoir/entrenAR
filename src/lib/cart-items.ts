import type { CartPreviewItem } from "@/types/cart";
import type { ProductDetail, ProductVariant } from "@/types/product";

type CartItemProduct = Pick<
  ProductDetail,
  "brand" | "id" | "imageTone" | "name" | "slug"
>;

export function toCartPreviewItem({
  product,
  quantity,
  variant,
}: {
  product: CartItemProduct;
  quantity: number;
  variant: ProductVariant;
}): CartPreviewItem {
  return {
    productId: product.id,
    variantId: variant.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    variantLabel: variant.label,
    quantity: Math.min(quantity, variant.stock),
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    stock: variant.stock,
    imageTone: product.imageTone,
  };
}
