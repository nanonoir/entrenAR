export type ProductImageTone = "green" | "black" | "red" | "amber" | "blue";

export type ProductVariantOption = {
  id: string;
  label: string;
  values: Array<{
    id: string;
    label: string;
    swatch?: string;
  }>;
};

export type ProductVariant = {
  id: string;
  label: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  optionValues?: Record<string, string>;
};

export type ProductImage = {
  id: string;
  alt: string;
  label: string;
  tone: ProductImageTone;
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categorySlug: string;
  categoryName: string;
  imageTone: ProductImageTone;
  shortDescription: string;
  tags: string[];
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviews: number;
  stock: number;
  isFeatured?: boolean;
  isBestSeller?: boolean;
};

export type ProductDetail = ProductSummary & {
  description: string;
  images: ProductImage[];
  variantOptions?: ProductVariantOption[];
  variants: ProductVariant[];
};

export type QuickBuyProduct = Pick<
  ProductDetail,
  | "id"
  | "slug"
  | "name"
  | "brand"
  | "imageTone"
  | "price"
  | "compareAtPrice"
  | "stock"
  | "variantOptions"
  | "variants"
>;
