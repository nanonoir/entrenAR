import type { ProductSummary } from "@/types/product";

export type ProductListingContextType =
  | "all"
  | "category"
  | "subcategory"
  | "brand"
  | "search"
  | "offers";

export type ProductListingContext = {
  type: ProductListingContextType;
  title: string;
  routePath: string;
  categorySlug?: string;
  categorySegment?: string;
  subcategorySlug?: string;
  brandSlug?: string;
  searchQuery?: string;
  hideBrandFilter?: boolean;
};

export type ProductListingFilterState = {
  brandSlugs: string[];
  categorySlugs: string[];
  subcategorySlugs: string[];
  precioMin?: number;
  precioMax?: number;
  sort: ProductListingSortValue;
};

export type ProductListingFilterOption = {
  id: string;
  label: string;
  count: number;
  children?: ProductListingFilterOption[];
};

export type ProductListingFilterGroup = {
  id: string;
  label: string;
  paramName: string;
  options: ProductListingFilterOption[];
};

export type ProductListingSortValue =
  | "relevantes"
  | "menor-precio"
  | "mayor-precio"
  | "mas-recientes"
  | "mas-vendidos";

export type ProductListingSortOption = {
  value: ProductListingSortValue;
  label: string;
};

export type ProductListingResult = {
  context: ProductListingContext;
  products: ProductSummary[];
  totalCount: number;
  filterState: ProductListingFilterState;
  filterGroups: ProductListingFilterGroup[];
  sortOptions: ProductListingSortOption[];
  priceBounds: {
    min: number;
    max: number;
  };
};
