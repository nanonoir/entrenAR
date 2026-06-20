export type AdminProductVisibility = "visible" | "hidden";

export type AdminProductStock =
  | { type: "limited"; quantity: number }
  | { type: "infinite" };

export type AdminProductCategory = {
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
};

export type AdminProduct = {
  id: string;
  slug: string;
  publicSlug: string;
  name: string;
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
  variantProperties: Array<{ name: string; values: string[] }>;
  variantCombinations: Array<{ id: string; name: string; sku: string; stock: number | "infinite"; price?: number }>;
  shippingRequired: boolean;
  missingLogistics: boolean;
  manualOrder: number;
  visibility: AdminProductVisibility;
  salesCount: number;
  createdAt: string;
  updatedAt: string;
};

export const mockAdminProductCategories: AdminProductCategory[] = [
  { id: "cat-supplements", name: "Suplementos", slug: "suplementos", description: "Nutrición deportiva y apoyo al rendimiento.", seoTitle: "Suplementos deportivos", seoDescription: "Suplementos seleccionados para entrenamiento y recuperación.", visibility: "visible" },
  { id: "cat-protein", name: "Proteínas", slug: "proteinas", description: "Proteínas y fórmulas para recuperación muscular.", visibility: "visible", parentId: "cat-supplements" },
  { id: "cat-training", name: "Entrenamiento", slug: "entrenamiento", description: "Elementos para entrenamiento funcional.", visibility: "visible" },
  { id: "cat-accessories", name: "Accesorios", slug: "accesorios", description: "Accesorios y complementos para el día a día.", visibility: "hidden" },
];

export const mockAdminProducts: AdminProduct[] = [
  {
    id: "prod-whey-pro",
    slug: "whey-protein-performance",
    publicSlug: "whey-protein-isolate-900g",
    name: "Whey Protein Performance",
    sku: "SUP-WHEY-001",
    categoryId: "cat-protein",
    categoryIds: ["cat-protein"],
    categoryName: "Proteínas",
    stock: { type: "limited", quantity: 42 },
    salePrice: 52900,
    promotionalPrice: 46900,
    tags: ["proteína", "whey", "performance", "suplemento"],
    brand: "EntrenAR",
    highlightSections: ["home"],
    variantProperties: [{ name: "Sabor", values: ["Vainilla", "Chocolate"] }],
    variantCombinations: [
      { id: "var-whey-vainilla", name: "Vainilla", sku: "SUP-WHEY-001-VAI", stock: 20 },
      { id: "var-whey-chocolate", name: "Chocolate", sku: "SUP-WHEY-001-CHO", stock: 22 },
    ],
    shippingRequired: true,
    missingLogistics: false,
    manualOrder: 1,
    visibility: "visible",
    salesCount: 128,
    createdAt: "2026-05-04T13:20:00.000Z",
    updatedAt: "2026-06-12T09:40:00.000Z",
  },
  {
    id: "prod-creatine",
    slug: "creatina-monohidrato-300g",
    publicSlug: "creatina-monohidrato-300g",
    name: "Creatina Monohidrato 300g",
    sku: "SUP-CREA-300",
    categoryId: "cat-supplements",
    categoryIds: ["cat-supplements"],
    categoryName: "Suplementos",
    stock: { type: "limited", quantity: 8 },
    salePrice: 28900,
    tags: ["creatina", "monohidrato", "fuerza", "suplemento"],
    brand: "EntrenAR",
    highlightSections: [],
    variantProperties: [],
    variantCombinations: [],
    shippingRequired: true,
    missingLogistics: false,
    manualOrder: 2,
    visibility: "visible",
    salesCount: 94,
    createdAt: "2026-05-11T11:15:00.000Z",
    updatedAt: "2026-06-10T16:30:00.000Z",
  },
  {
    id: "prod-training-bands",
    slug: "set-bandas-entrenamiento",
    publicSlug: "shaker-entrenar-700ml",
    name: "Set de Bandas de Entrenamiento",
    sku: "ACC-BAND-SET",
    categoryId: "cat-accessories",
    categoryIds: ["cat-accessories"],
    categoryName: "Accesorios",
    stock: { type: "infinite" },
    salePrice: 18900,
    promotionalPrice: 15900,
    tags: ["bandas", "entrenamiento", "accesorios"],
    brand: "EntrenAR",
    highlightSections: ["featured"],
    variantProperties: [{ name: "Resistencia", values: ["Media", "Alta"] }],
    variantCombinations: [
      { id: "var-band-media", name: "Media", sku: "ACC-BAND-SET-MED", stock: 999 },
      { id: "var-band-alta", name: "Alta", sku: "ACC-BAND-SET-ALT", stock: 999 },
    ],
    shippingRequired: true,
    missingLogistics: true,
    manualOrder: 3,
    visibility: "visible",
    salesCount: 56,
    createdAt: "2026-04-22T15:00:00.000Z",
    updatedAt: "2026-06-09T12:10:00.000Z",
  },
  {
    id: "prod-training-gloves",
    slug: "guantes-training-pro",
    publicSlug: "remera-boxy-fit-drop-0",
    name: "Guantes Training Pro",
    sku: "ACC-GLOV-PRO",
    categoryId: "cat-training",
    categoryIds: ["cat-training"],
    categoryName: "Entrenamiento",
    stock: { type: "limited", quantity: 0 },
    salePrice: 21900,
    tags: ["guantes", "training", "entrenamiento"],
    brand: "EntrenAR",
    highlightSections: [],
    variantProperties: [{ name: "Talle", values: ["S", "M", "L"] }],
    variantCombinations: [
      { id: "var-gloves-s", name: "S", sku: "ACC-GLOV-PRO-S", stock: 0 },
      { id: "var-gloves-m", name: "M", sku: "ACC-GLOV-PRO-M", stock: 0 },
      { id: "var-gloves-l", name: "L", sku: "ACC-GLOV-PRO-L", stock: 0 },
    ],
    shippingRequired: true,
    missingLogistics: true,
    manualOrder: 4,
    visibility: "hidden",
    salesCount: 33,
    createdAt: "2026-03-29T10:30:00.000Z",
    updatedAt: "2026-06-08T18:05:00.000Z",
  },
];

export async function getAdminProducts(): Promise<AdminProduct[]> {
  return mockAdminProducts;
}

export async function getAdminProductById(id: string): Promise<AdminProduct | undefined> {
  return mockAdminProducts.find((product) => product.id === id);
}

export async function getAdminProductCategories(): Promise<AdminProductCategory[]> {
  return mockAdminProductCategories;
}

export async function getAdminProductCategoryById(id: string): Promise<AdminProductCategory | undefined> {
  return mockAdminProductCategories.find((category) => category.id === id);
}

export function formatAdminProductStock(stock: AdminProductStock): string {
  if (stock.type === "infinite") return "∞";
  if (stock.quantity === 0) return "Sin stock";
  return `${stock.quantity} unidades`;
}

export function getAdminProductStockTone(stock: AdminProductStock): "neutral" | "success" | "warning" | "sale" {
  if (stock.type === "infinite") return "success";
  if (stock.quantity === 0) return "sale";
  if (stock.quantity <= 10) return "warning";
  return "success";
}
