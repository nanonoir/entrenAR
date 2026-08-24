export const CATALOG_VISIBILITY = {
  HIDDEN: "hidden",
  VISIBLE: "visible",
} as const;

export type CatalogVisibilityInput = (typeof CATALOG_VISIBILITY)[keyof typeof CATALOG_VISIBILITY];

export const CATALOG_STOCK_MODE = {
  INFINITE: "infinite",
  LIMITED: "limited",
} as const;

export type CatalogStockModeInput = (typeof CATALOG_STOCK_MODE)[keyof typeof CATALOG_STOCK_MODE];
