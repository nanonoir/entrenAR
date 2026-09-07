export const ADMIN_PRODUCT_VISIBILITY = { VISIBLE: "visible", HIDDEN: "hidden" } as const;
export type AdminProductVisibility = (typeof ADMIN_PRODUCT_VISIBILITY)[keyof typeof ADMIN_PRODUCT_VISIBILITY];

export const ADMIN_PRODUCT_STOCK_TYPE = { LIMITED: "limited", INFINITE: "infinite" } as const;
export type AdminProductStock =
  | { type: typeof ADMIN_PRODUCT_STOCK_TYPE.LIMITED; quantity: number }
  | { type: typeof ADMIN_PRODUCT_STOCK_TYPE.INFINITE };

export const ADMIN_PRODUCT_VARIANT_STOCK = { INFINITE: "infinite" } as const;
export type AdminProductVariantStock = number | (typeof ADMIN_PRODUCT_VARIANT_STOCK)[keyof typeof ADMIN_PRODUCT_VARIANT_STOCK];

export interface AdminProductVariantProperty {
  name: string;
  values: string[];
}

export interface AdminProductVariant {
  id: string;
  name: string;
  sku: string;
  stock: AdminProductVariantStock;
  price?: number;
}

export interface AdminProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  googleShoppingCategory?: string;
  seoTitle?: string;
  seoDescription?: string;
  visibility: AdminProductVisibility;
  parentId?: string;
}

export interface AdminProduct {
  id: string;
  slug: string;
  publicSlug: string;
  name: string;
  description?: string;
  sku: string;
  imageUrl?: string;
  categoryId: string;
  categoryIds: string[];
  categoryName: string;
  stock: AdminProductStock;
  salePrice: number;
  promotionalPrice?: number;
  tags: string[];
  brand?: string;
  seoTitle?: string;
  seoDescription?: string;
  highlightSections: string[];
  variantProperties: AdminProductVariantProperty[];
  variantCombinations: AdminProductVariant[];
  shippingRequired: boolean;
  missingLogistics: boolean;
  weightGrams?: number;
  heightCm?: number;
  widthCm?: number;
  lengthCm?: number;
  manualOrder: number;
  visibility: AdminProductVisibility;
  salesCount: number;
  createdAt: string;
  updatedAt: string;
}
