import type { ProductDetail, ProductSummary } from "@/types/product";
import { catalogData, getCatalogRepository } from "@/lib/api/catalog/catalog.repository";
import { productBelongsToCategory } from "@/lib/category-membership";

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

type CatalogErrorRoute = {
  type: "catalog-error";
  message: string;
};

export type ShopRouteResolution = ProductRoute | ListingRoute | NotFoundRoute | CatalogErrorRoute;

export function isLegacyShakerRoute(segments: readonly string[]): boolean {
  return segments.includes("shakers-y-botellas");
}

const supplementCategoryBySlug: Record<string, string> = {
  proteinas: "proteinas",
  "pre-intra-creatina": "creatina-y-pre",
  "vitaminas-suplementos": "vitaminas",
  performance: "performance",
  "control-de-peso": "control-de-peso",
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
      catalog.getPublicListing({ limit: 4, page: 1, sort: "featured" }),
    ]);
    if (productResult.status === "error") return { type: "catalog-error", message: productResult.error.message };
    if (productResult.status === "loading") return { type: "catalog-error", message: "El producto todavía se está cargando." };
    const product = catalogData(productResult, null);

    if (!product) {
      return { type: "not-found" };
    }

    if (productsResult.status === "loading") return { type: "catalog-error", message: "El catálogo todavía se está cargando." };
    const products = productsResult.status === "success" || productsResult.status === "empty" ? productsResult.data.items : [];

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
        ["proteinas", "creatina-y-pre", "vitaminas", "performance", "control-de-peso"].some((slug) => productBelongsToCategory(product, slug)),
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
    const categoryProducts = products.filter((product) => productBelongsToCategory(product, categorySlug));

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

  const taxonomySlug = section === "suplementos"
    ? (firstSlug ? supplementCategoryBySlug[firstSlug] ?? firstSlug : undefined)
    : section;
  const categoryRouteShape = section === "suplementos"
    ? Boolean(firstSlug && !secondSlug)
    : !firstSlug && segments.length === 1;
  const publicCategory = categoryRouteShape && taxonomySlug ? categories.find((item) => item.slug === taxonomySlug) : undefined;
  if (publicCategory) {
    return listingRoute(
      publicCategory.label,
      publicCategory.description,
      products.filter((product) => productBelongsToCategory(product, publicCategory.slug)),
    );
  }

  return { type: "not-found" };
}
