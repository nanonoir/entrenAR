import type { ProductSummary } from "@/types/product";

export type ProductListingError = { code: string; message: string };

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
  canonicalPath?: string;
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
  status: "success" | "empty" | "error";
  error?: ProductListingError;
  page: number;
  totalPages: number;
  totalCount: number;
  filterState: ProductListingFilterState;
  filterGroups: ProductListingFilterGroup[];
  sortOptions: ProductListingSortOption[];
  priceBounds: {
    min: number;
    max: number;
  };
};
