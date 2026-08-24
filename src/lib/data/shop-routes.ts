import type { ProductDetail, ProductSummary } from "@/types/product";
import { catalogData, getCatalogRepository } from "@/lib/api/catalog/catalog.repository";

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
    description: "Snacks, barras y alimentos funcionales para el día a día.",
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
    description: "Prendas para entrenar y usar todos los días.",
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

export async function resolveShopRoute(segments: string[]): Promise<ShopRouteResolution> {
  const [section, firstSlug, secondSlug] = segments;
  const catalog = getCatalogRepository();

  if (section === "productos" && firstSlug && !secondSlug) {
    const [productResult, productsResult] = await Promise.all([
      catalog.getPublicProductBySlug(firstSlug),
      catalog.getPublicProducts(),
    ]);
    const product = catalogData(productResult, null);

    if (!product) {
      return { type: "not-found" };
    }

    const products = catalogData(productsResult, []);

    return {
      type: "product",
      product,
      related: products.filter((item) => item.isFeatured && item.id !== product.id).slice(0, 4),
    };
  }

  const [productsResult, categoriesResult] = await Promise.all([
    catalog.getPublicProducts(),
    catalog.getPublicCategories(),
  ]);
  const products = catalogData(productsResult, []);
  const categories = catalogData(categoriesResult, []);

  if (section === "suplementos") {
    if (!firstSlug) {
      const categoryProducts = products.filter((product) =>
        ["proteinas", "creatina-y-pre", "vitaminas"].includes(product.categorySlug),
      );

      return listingRoute(
        "Suplementos",
        "Proteínas, creatina, vitaminas y soporte para tu rutina de entrenamiento.",
        categoryProducts,
      );
    }

    const categorySlug = supplementCategoryBySlug[firstSlug];

    if (!categorySlug) {
      return { type: "not-found" };
    }

    const category = categories.find((item) => item.slug === categorySlug);
    const categoryProducts = products.filter((product) => product.categorySlug === categorySlug);

    return listingRoute(
      category?.label ?? firstSlug,
      category?.description ?? "Productos seleccionados para tu entrenamiento.",
      categoryProducts,
    );
  }

  if (section === "ofertas" && !firstSlug) {
    const offerProducts = products.filter((product) => product.compareAtPrice && product.compareAtPrice > product.price);

    return listingRoute("Ofertas", "Productos con precio especial por tiempo limitado.", offerProducts);
  }

  if (section === "marcas" && firstSlug && !secondSlug) {
    const brandProducts = products.filter((product) => slugify(product.brand) === firstSlug);

    if (brandProducts.length === 0) {
      return { type: "not-found" };
    }

    return listingRoute(brandProducts[0]?.brand ?? "Marca", "Productos disponibles de la marca seleccionada.", brandProducts);
  }

  const simpleCategory = simpleCategoryBySegment[section];

  if (simpleCategory && (!firstSlug || section === "market" || section === "indumentaria")) {
    const categoryProducts = products.filter((product) => product.categorySlug === simpleCategory.categorySlug);

    return listingRoute(simpleCategory.title, simpleCategory.description, categoryProducts);
  }

  return { type: "not-found" };
}
