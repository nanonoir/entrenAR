export type AdminProductVisibility = "visible" | "hidden";

export type AdminProductStock =
  | { type: "limited"; quantity: number }
  | { type: "infinite" };

export type AdminProductCategory = {
  id: string;
  name: string;
  slug: string;
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
  categoryName: string;
  stock: AdminProductStock;
  salePrice: number;
  promotionalPrice?: number;
  visibility: AdminProductVisibility;
  salesCount: number;
  createdAt: string;
  updatedAt: string;
};

export const mockAdminProductCategories: AdminProductCategory[] = [
  { id: "cat-supplements", name: "Suplementos", slug: "suplementos" },
  { id: "cat-protein", name: "Proteínas", slug: "proteinas", parentId: "cat-supplements" },
  { id: "cat-training", name: "Entrenamiento", slug: "entrenamiento" },
  { id: "cat-accessories", name: "Accesorios", slug: "accesorios" },
];

export const mockAdminProducts: AdminProduct[] = [
  {
    id: "prod-whey-pro",
    slug: "whey-protein-performance",
    publicSlug: "whey-protein-isolate-900g",
    name: "Whey Protein Performance",
    sku: "SUP-WHEY-001",
    categoryId: "cat-protein",
    categoryName: "Proteínas",
    stock: { type: "limited", quantity: 42 },
    salePrice: 52900,
    promotionalPrice: 46900,
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
    categoryName: "Suplementos",
    stock: { type: "limited", quantity: 8 },
    salePrice: 28900,
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
    categoryName: "Accesorios",
    stock: { type: "infinite" },
    salePrice: 18900,
    promotionalPrice: 15900,
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
    categoryName: "Entrenamiento",
    stock: { type: "limited", quantity: 0 },
    salePrice: 21900,
    visibility: "hidden",
    salesCount: 33,
    createdAt: "2026-03-29T10:30:00.000Z",
    updatedAt: "2026-06-08T18:05:00.000Z",
  },
];

export async function getAdminProducts(): Promise<AdminProduct[]> {
  return mockAdminProducts;
}

export async function getAdminProductCategories(): Promise<AdminProductCategory[]> {
  return mockAdminProductCategories;
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
