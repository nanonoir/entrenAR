import type { ProductDetail, ProductSummary } from "@/types/product";
import {
  getAllProducts,
  getFeaturedProducts,
  getProductBySlug,
  getProductsByCategory,
} from "@/lib/data/products";
import { getCategoryBySlug } from "@/lib/data/categories";

type ProductRoute = {
  type: "product";
  product: ProductDetail;
  related: ProductSummary[];
};

type ListingRoute = {
  type: "listing";
  title: string;
  description: string;
  badgeLabel: string;
  products: ProductSummary[];
};

type NotFoundRoute = {
  type: "not-found";
};

export type ShopRouteResolution = ProductRoute | ListingRoute | NotFoundRoute;

const supplementCategoryBySlug: Record<string, string> = {
  proteinas: "proteinas",
  "pre-intra-creatina": "creatina-y-pre",
  "vitaminas-suplementos": "vitaminas",
  performance: "creatina-y-pre",
};

const simpleCategoryBySegment: Record<string, { categorySlug: string; title: string; description: string }> = {
  market: {
    categorySlug: "market",
    title: "Market",
    description: "Snacks, barras y alimentos funcionales para el dia a dia.",
  },
  shakers: {
    categorySlug: "shakers",
    title: "Shakers",
    description: "Shakers y botellas para preparar tus suplementos.",
  },
  accesorios: {
    categorySlug: "accesorios",
    title: "Accesorios",
    description: "Herramientas y accesorios para entrenar mejor.",
  },
  indumentaria: {
    categorySlug: "indumentaria",
    title: "Indumentaria",
    description: "Prendas para entrenar y usar todos los dias.",
  },
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function listingRoute(title: string, description: string, products: ProductSummary[]): ListingRoute {
  return {
    type: "listing",
    title,
    description,
    badgeLabel: `${products.length} productos`,
    products,
  };
}

export function resolveShopRoute(segments: string[]): ShopRouteResolution {
  const [section, firstSlug, secondSlug] = segments;

  if (section === "productos" && firstSlug && !secondSlug) {
    const product = getProductBySlug(firstSlug);

    if (!product) {
      return { type: "not-found" };
    }

    return {
      type: "product",
      product,
      related: getFeaturedProducts().filter((item) => item.id !== product.id).slice(0, 4),
    };
  }

  if (section === "suplementos") {
    if (!firstSlug) {
      const products = getAllProducts().filter((product) =>
        ["proteinas", "creatina-y-pre", "vitaminas"].includes(product.categorySlug),
      );

      return listingRoute(
        "Suplementos",
        "Proteinas, creatina, vitaminas y soporte para tu rutina de entrenamiento.",
        products,
      );
    }

    const categorySlug = supplementCategoryBySlug[firstSlug];

    if (!categorySlug) {
      return { type: "not-found" };
    }

    const category = getCategoryBySlug(categorySlug);
    const products = getProductsByCategory(categorySlug);

    return listingRoute(
      category?.label ?? firstSlug,
      category?.description ?? "Productos seleccionados para tu entrenamiento.",
      products,
    );
  }

  if (section === "ofertas" && !firstSlug) {
    const products = getAllProducts().filter((product) => product.compareAtPrice && product.compareAtPrice > product.price);

    return listingRoute("Ofertas", "Productos con precio especial por tiempo limitado.", products);
  }

  if (section === "marcas" && firstSlug && !secondSlug) {
    const products = getAllProducts().filter((product) => slugify(product.brand) === firstSlug);

    if (products.length === 0) {
      return { type: "not-found" };
    }

    return listingRoute(products[0]?.brand ?? "Marca", "Productos disponibles de la marca seleccionada.", products);
  }

  const simpleCategory = simpleCategoryBySegment[section];

  if (simpleCategory && (!firstSlug || section === "market" || section === "indumentaria")) {
    const products = getProductsByCategory(simpleCategory.categorySlug);

    return listingRoute(simpleCategory.title, simpleCategory.description, products);
  }

  return { type: "not-found" };
}
