import type { ProductImageTone } from "@/types/product";

export type CartPreviewItem = {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  brand: string;
  variantLabel: string;
  quantity: number;
  price: number;
  compareAtPrice?: number;
  stock: number;
  imageTone: ProductImageTone;
  imageUrl?: string;
  imageAlt?: string;
};

export type AddedCartItemPreview = CartPreviewItem;
