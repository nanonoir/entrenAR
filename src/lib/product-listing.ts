import type { ProductDetail, ProductSummary } from "@/types/product";
import type {
  ProductListingContext,
  ProductListingFilterGroup,
  ProductListingFilterState,
  ProductListingResult,
  ProductListingSortOption,
  ProductListingSortValue,
} from "@/types/product-listing";
import { getCategoryBySlug, getCategories } from "@/lib/data/categories";
import { getShopNavItems } from "@/lib/data/navigation";
import { getAllProductDetails } from "@/lib/data/products";

type SearchParamsInput = Record<string, string | string[] | undefined>;

type ResolvedListingContext = ProductListingContext & {
  baseProducts: ProductDetail[];
  filterProducts?: ProductDetail[];
};

export const productListingSortOptions: ProductListingSortOption[] = [
  { value: "relevantes", label: "Más relevantes" },
  { value: "menor-precio", label: "Menor precio" },
  { value: "mayor-precio", label: "Mayor precio" },
  { value: "mas-recientes", label: "Más recientes" },
  { value: "mas-vendidos", label: "Más vendidos" },
];

const supplementCategoryBySegment: Record<string, string> = {
  proteinas: "proteinas",
  "pre-intra-creatina": "creatina-y-pre",
  "vitaminas-suplementos": "vitaminas",
  performance: "creatina-y-pre",
};

const categorySegmentBySlug: Record<string, string> = {
  proteinas: "proteinas",
  "creatina-y-pre": "pre-intra-creatina",
  vitaminas: "vitaminas-suplementos",
  market: "market",
  shakers: "shakers",
  accesorios: "accesorios",
  indumentaria: "indumentaria",
};

const directCategoryBySegment: Record<string, { categorySlug: string; title: string }> = {
  market: { categorySlug: "market", title: "Market" },
  shakers: { categorySlug: "shakers", title: "Shakers" },
  accesorios: { categorySlug: "accesorios", title: "Accesorios" },
  indumentaria: { categorySlug: "indumentaria", title: "Indumentaria" },
};

function getParam(searchParams: SearchParamsInput, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseCsvParam(searchParams: SearchParamsInput, key: string) {
  return (getParam(searchParams, key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parsePriceParam(searchParams: SearchParamsInput, key: string) {
  const parsed = Number(getParam(searchParams, key));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function slugifyProductListingValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getBrandSlug(product: ProductSummary) {
  return slugifyProductListingValue(product.brand);
}

function getProductSearchText(product: ProductDetail) {
  return normalizeSearchValue(
    [
      product.name,
      product.brand,
      product.categoryName,
      product.shortDescription,
      product.description,
      product.tags.join(" "),
    ].join(" "),
  );
}

function productMatchesSearch(product: ProductDetail, query: string) {
  const normalizedQuery = normalizeSearchValue(query.trim());
  return normalizedQuery.length === 0 || getProductSearchText(product).includes(normalizedQuery);
}

function resolveListingContext(
  segments: string[],
  searchParams: SearchParamsInput,
  products: ProductDetail[],
): ResolvedListingContext | null {
  const [section, firstSlug, secondSlug] = segments;
  const routePath = `/${segments.join("/")}`;

  if (section === "productos" && !firstSlug) {
    return {
      type: "all",
      title: "Todos los productos",
      routePath,
      baseProducts: products,
    };
  }

  if (section === "buscar" && !firstSlug) {
    const query = getParam(searchParams, "q")?.trim() ?? "";

    return {
      type: "search",
      title: `Resultados para: ${query}`,
      routePath,
      searchQuery: query,
      baseProducts: products.filter((product) => productMatchesSearch(product, query)),
    };
  }

  if (section === "marcas" && firstSlug && !secondSlug) {
    const baseProducts = products.filter((product) => getBrandSlug(product) === firstSlug);

    if (baseProducts.length === 0) {
      return null;
    }

    return {
      type: "brand",
      title: baseProducts[0]?.brand ?? "Marca",
      routePath,
      brandSlug: firstSlug,
      hideBrandFilter: true,
      baseProducts,
    };
  }

  if (section === "ofertas" && !firstSlug) {
    return {
      type: "offers",
      title: "Ofertas",
      routePath,
      baseProducts: products.filter((product) => product.compareAtPrice && product.compareAtPrice > product.price),
    };
  }

  if (section === "suplementos") {
    if (!firstSlug) {
      const supplementSlugs = Object.values(supplementCategoryBySegment);

      return {
        type: "category",
        title: "Suplementos",
        routePath,
        baseProducts: products.filter((product) => supplementSlugs.includes(product.categorySlug)),
      };
    }

    const categorySlug = supplementCategoryBySegment[firstSlug];

    if (!categorySlug) {
      return null;
    }

    const category = getCategoryBySlug(categorySlug);
    const baseProducts = products.filter((product) => product.categorySlug === categorySlug);
    const subcategoryProducts = secondSlug
      ? baseProducts.filter((product) => product.subcategorySlugs?.includes(secondSlug))
      : baseProducts;

    if (secondSlug && subcategoryProducts.length === 0) {
      return null;
    }

    return {
      type: secondSlug ? "subcategory" : "category",
      title: category?.label ?? firstSlug,
      routePath,
      categorySlug,
      categorySegment: firstSlug,
      subcategorySlug: secondSlug,
      baseProducts: subcategoryProducts,
      filterProducts: baseProducts,
    };
  }

  const directCategory = directCategoryBySegment[section];

  if (directCategory) {
    const baseProducts = products.filter((product) => product.categorySlug === directCategory.categorySlug);
    const subcategoryProducts = firstSlug
      ? baseProducts.filter((product) => product.subcategorySlugs?.includes(firstSlug))
      : baseProducts;

    if (firstSlug && subcategoryProducts.length === 0) {
      return null;
    }

    return {
      type: firstSlug ? "subcategory" : "category",
      title: directCategory.title,
      routePath,
      categorySlug: directCategory.categorySlug,
      categorySegment: section,
      subcategorySlug: firstSlug,
      baseProducts: subcategoryProducts,
      filterProducts: baseProducts,
    };
  }

  return null;
}

function parseFilterState(searchParams: SearchParamsInput): ProductListingFilterState {
  const sortParam = getParam(searchParams, "orden");
  const sort = productListingSortOptions.some((option) => option.value === sortParam)
    ? (sortParam as ProductListingSortValue)
    : "relevantes";

  return {
    brandSlugs: parseCsvParam(searchParams, "marca"),
    categorySlugs: parseCsvParam(searchParams, "categoria"),
    subcategorySlugs: parseCsvParam(searchParams, "subcategoria"),
    precioMin: parsePriceParam(searchParams, "precioMin"),
    precioMax: parsePriceParam(searchParams, "precioMax"),
    sort,
  };
}

function createOptionCounts(
  products: ProductDetail[],
  getValues: (product: ProductDetail) => Array<{ id: string; label: string }>,
) {
  const options = new Map<string, { id: string; label: string; count: number }>();

  products.forEach((product) => {
    getValues(product).forEach((value) => {
      const current = options.get(value.id);
      options.set(value.id, {
        id: value.id,
        label: current?.label ?? value.label,
        count: (current?.count ?? 0) + 1,
      });
    });
  });

  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function getCategorySubcategoryLinks(categorySlug: string) {
  const categorySegment = categorySegmentBySlug[categorySlug];

  if (!categorySegment) {
    return [];
  }

  return getShopNavItems()
    .flatMap((item) => item.groups ?? [])
    .flatMap((group) => group.links)
    .filter((link) => link.href.startsWith(`/${categorySegment}/`) || link.href.startsWith(`/suplementos/${categorySegment}/`));
}

function createCategoryOptions(products: ProductDetail[]) {
  const categoryLabels = new Map(getCategories().map((category) => [category.slug, category.label]));
  const categories = createOptionCounts(products, (product) => [
    {
      id: product.categorySlug,
      label: categoryLabels.get(product.categorySlug) ?? product.categoryName,
    },
  ]);

  return categories.map((category) => {
    const categoryProducts = products.filter((product) => product.categorySlug === category.id);
    const seenSubcategories = new Set<string>();
    const children = getCategorySubcategoryLinks(category.id)
      .map((link) => {
        const slug = link.href.split("/").filter(Boolean).at(-1) ?? "";
        const count = categoryProducts.filter((product) => product.subcategorySlugs?.includes(slug)).length;

        return {
          id: slug,
          label: link.label,
          count,
        };
      })
      .filter((subcategory) => {
        if (seenSubcategories.has(subcategory.id) || subcategory.count === 0) {
          return false;
        }

        seenSubcategories.add(subcategory.id);
        return true;
      });

    return {
      ...category,
      children,
    };
  });
}

function createSubcategoryOptions(context: ProductListingContext, products: ProductDetail[]) {
  if (!context.categorySlug) {
    return [];
  }

  const categoryProducts = products.filter((product) => product.categorySlug === context.categorySlug);
  const seenSubcategories = new Set<string>();

  return getCategorySubcategoryLinks(context.categorySlug)
    .map((link) => {
      const slug = link.href.split("/").filter(Boolean).at(-1) ?? "";
      const count = categoryProducts.filter((product) => product.subcategorySlugs?.includes(slug)).length;

      return {
        id: slug,
        label: link.label,
        count,
      };
    })
    .filter((subcategory) => {
      if (seenSubcategories.has(subcategory.id) || subcategory.count === 0) {
        return false;
      }

      seenSubcategories.add(subcategory.id);
      return true;
    });
}

function createFilterGroups(
  context: ProductListingContext,
  products: ProductDetail[],
): ProductListingFilterGroup[] {
  const groups: ProductListingFilterGroup[] = [];
  const categoryOptions = context.categorySlug
    ? createSubcategoryOptions(context, products)
    : createCategoryOptions(products);

  if (categoryOptions.length > 0) {
    groups.push({
      id: context.categorySlug ? "subcategory" : "category",
      label: context.categorySlug ? "Subcategorías" : "Categorías",
      paramName: context.categorySlug ? "subcategoria" : "categoria",
      options: categoryOptions,
    });
  }

  if (!context.hideBrandFilter) {
    const options = createOptionCounts(products, (product) => [
      { id: getBrandSlug(product), label: product.brand },
    ]);

    if (options.length > 1) {
      groups.push({ id: "brand", label: "Marcas", paramName: "marca", options });
    }
  }

  return groups;
}

function applyFilters(products: ProductDetail[], filterState: ProductListingFilterState) {
  return products.filter((product) => {
    if (filterState.brandSlugs.length > 0 && !filterState.brandSlugs.includes(getBrandSlug(product))) {
      return false;
    }

    if (filterState.categorySlugs.length > 0 && !filterState.categorySlugs.includes(product.categorySlug)) {
      return false;
    }

    if (
      filterState.subcategorySlugs.length > 0 &&
      !filterState.subcategorySlugs.some((slug) => product.subcategorySlugs?.includes(slug))
    ) {
      return false;
    }

    if (filterState.precioMin !== undefined && product.price < filterState.precioMin) {
      return false;
    }

    if (filterState.precioMax !== undefined && product.price > filterState.precioMax) {
      return false;
    }

    return true;
  });
}

function sortProducts(products: ProductDetail[], filterState: ProductListingFilterState, allProducts: ProductDetail[]) {
  const originalIndex = new Map(allProducts.map((product, index) => [product.id, index]));

  return [...products].sort((a, b) => {
    if (filterState.sort === "menor-precio") {
      return a.price - b.price;
    }

    if (filterState.sort === "mayor-precio") {
      return b.price - a.price;
    }

    if (filterState.sort === "mas-vendidos") {
      const bestSellerDelta = Number(Boolean(b.isBestSeller)) - Number(Boolean(a.isBestSeller));
      return bestSellerDelta || b.reviews - a.reviews;
    }

    return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
  });
}

function getPriceBounds(products: ProductDetail[]) {
  if (products.length === 0) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.min(...products.map((product) => product.price)),
    max: Math.max(...products.map((product) => product.price)),
  };
}

export function resolveProductListing(
  segments: string[],
  searchParams: SearchParamsInput = {},
): ProductListingResult | null {
  const allProducts = getAllProductDetails();
  const resolvedContext = resolveListingContext(segments, searchParams, allProducts);

  if (!resolvedContext) {
    return null;
  }

  const { baseProducts, filterProducts, ...context } = resolvedContext;
  const filterState = parseFilterState(searchParams);
  const filteredProducts = applyFilters(baseProducts, filterState);
  const sortedProducts = sortProducts(filteredProducts, filterState, allProducts);

  return {
    context,
    products: sortedProducts,
    totalCount: sortedProducts.length,
    filterState,
    filterGroups: createFilterGroups(context, filterProducts ?? baseProducts),
    sortOptions: productListingSortOptions,
    subcategories: [],
    priceBounds: getPriceBounds(baseProducts),
  };
}
