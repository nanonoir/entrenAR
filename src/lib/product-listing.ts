import type {
  CatalogListingFacet,
  CatalogListingQuery,
  CatalogReadError,
  CatalogReadResult,
  CatalogRepository,
} from "@/lib/api/catalog/catalog.repository";
import { CATALOG_LISTING_SORT, getCatalogRepository } from "@/lib/api/catalog/catalog.repository";
import { getShopNavItems } from "@/lib/data/navigation";
import type { ProductListingContext, ProductListingFilterGroup, ProductListingFilterOption, ProductListingFilterState, ProductListingResult, ProductListingSortOption, ProductListingSortValue } from "@/types/product-listing";
import type { CategoryNavItem } from "@/types/navigation";

type SearchParamsInput = Record<string, string | string[] | undefined>;
type RouteContext = ProductListingContext & { canonicalPath?: string };

export const productListingSortOptions: ProductListingSortOption[] = [
  { value: "relevantes", label: "Más relevantes" },
  { value: "menor-precio", label: "Menor precio" },
  { value: "mayor-precio", label: "Mayor precio" },
  { value: "mas-recientes", label: "Más recientes" },
  { value: "mas-vendidos", label: "Más vendidos" },
];

const CATEGORY_ROUTE_ALIASES: Record<string, string> = {
  "pre-intra-creatina": "creatina-y-pre",
  "vitaminas-suplementos": "vitaminas",
};

const BRAND_ROUTE_ALIASES: Record<string, string> = {
  "balboa-fit": "balboafit", framingham: "framingham-pharma",
  notco: "not-co", "natures-bounty": "nature-s-bounty",
};

const CATEGORY_TITLES: Record<string, string> = {
  accesorios: "Accesorios",
  "control-de-peso": "Control de peso",
  "creatina-y-pre": "Creatina y pre",
  indumentaria: "Indumentaria",
  market: "Market",
  performance: "Performance",
  proteinas: "Proteínas",
  shakers: "Shakers",
  suplementos: "Suplementos",
  vitaminas: "Vitaminas",
};

function getParam(params: SearchParamsInput, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseCsvParam(params: SearchParamsInput, key: string): string[] {
  return [...new Set((getParam(params, key) ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
}

function parsePriceParam(params: SearchParamsInput, key: string): number | undefined {
  const value = getParam(params, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parsePage(params: SearchParamsInput): number {
  const page = Number(getParam(params, "page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function slugifyProductListingValue(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()
    .replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function decodeBrandLabel(segment: string): string | undefined {
  try {
    const decoded = decodeURIComponent(segment);
    return /[\\/\u0000-\u001f]/.test(decoded) ? undefined : decoded;
  } catch { return undefined; }
}

function routeTitle(slug: string, categories: readonly CategoryNavItem[]): string {
  return categories.find((category) => category.slug === slug)?.label
    ?? CATEGORY_TITLES[slug]
    ?? slug.split("-").map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1)).join(" ");
}

function routeContext(
  segments: string[],
  params: SearchParamsInput,
  categories: readonly CategoryNavItem[],
  brands: readonly CatalogListingFacet[],
  allowUnknownRoute: boolean,
): RouteContext | null {
  const [section, first, second] = segments;
  const routePath = `/${segments.join("/")}`;
  if (section === "productos" && !first) return { type: "all", title: "Todos los productos", routePath };
  if (section === "buscar" && !first) {
    const query = getParam(params, "q")?.trim() ?? "";
    return { type: "search", title: query ? `Resultados para: ${query}` : "Buscar productos", routePath, searchQuery: query };
  }
  if (section === "ofertas" && !first) return { type: "offers", title: "Ofertas", routePath };

  if (section === "marcas" && first && !second) {
    const candidate = decodeBrandLabel(first);
    const candidateSlug = candidate === undefined ? undefined : slugifyProductListingValue(candidate);
    const brand = brands.find((entry) => entry.slug === first)
      ?? brands.find((entry) => entry.label === first && !/[\\/\u0000-\u001f]/.test(first))
      ?? brands.find((entry) => candidateSlug !== undefined && (entry.slug === candidateSlug || slugifyProductListingValue(entry.label) === candidateSlug))
      ?? brands.find((entry) => candidateSlug !== undefined && entry.slug === BRAND_ROUTE_ALIASES[candidateSlug]);
    if (!brand) {
      if (!allowUnknownRoute) return null;
      return { type: "brand", title: first, routePath, brandSlug: first, hideBrandFilter: true };
    }
    return {
      type: "brand",
      title: brand.label,
      routePath,
      brandSlug: brand.slug,
      hideBrandFilter: true,
      ...(first === brand.slug ? {} : { canonicalPath: `/marcas/${encodeURIComponent(brand.slug)}` }),
    };
  }

  if (section === "suplementos") {
    if (segments.length > 3) return null;
    let categorySlug = first ? CATEGORY_ROUTE_ALIASES[first] ?? first : "suplementos";
    const category = categories.find((entry) => entry.slug === categorySlug);
    if (!category && !allowUnknownRoute && categorySlug !== "suplementos" && CATEGORY_TITLES[categorySlug] === undefined) return null;
    if (second) {
      const navSubcategories = subcategorySlugsFor(first ?? "");
      const child = categories.find((entry) => entry.slug === second);
      if (child?.id) {
        if (!category?.id || child.parentId !== category.id) return null;
        categorySlug = child.slug;
      } else if (!navSubcategories.includes(second) && !allowUnknownRoute) return null;
    }
    return {
      type: second ? "subcategory" : "category",
      title: routeTitle(categorySlug, categories),
      routePath,
      categorySlug,
      categorySegment: first ?? "suplementos",
      ...(second ? { subcategorySlug: second } : {}),
    };
  }

  if (segments.length === 2 && first) {
    const parent = categories.find((category) => category.slug === section);
    const child = categories.find((category) => category.slug === first);
    if (parent?.id && child?.id && child.parentId === parent.id) {
      return { type: "category", title: child.label, routePath, categorySlug: child.slug, categorySegment: section };
    }
    const fixtureLink = !parent?.id && !child?.id && getShopNavItems().find((item) => item.href === `/${section}`)
      ?.groups?.some((group) => group.links.some((link) => link.href === routePath));
    if (parent && fixtureLink) return { type: "subcategory", title: routeTitle(first, categories), routePath,
      categorySlug: section, categorySegment: section, subcategorySlug: first };
  }

  if (segments.length === 1 && categories.some((category) => category.slug === section)) {
    return { type: "category", title: routeTitle(section, categories), routePath, categorySlug: section, categorySegment: section };
  }

  const knownDirectRoute = CATEGORY_TITLES[section ?? ""] !== undefined;
  if (segments.length === 1 && section && knownDirectRoute) {
    return { type: "category", title: routeTitle(section ?? "", categories), routePath, categorySlug: section, categorySegment: section };
  }
  if (allowUnknownRoute && section && segments.length <= 3) {
    return { type: "category", title: routeTitle(section, categories), routePath, categorySlug: section, categorySegment: section };
  }
  return null;
}

function subcategorySlugsFor(segment: string): string[] {
  return getShopNavItems().find((item) => item.href === "/suplementos")?.groups
    ?.find((group) => group.href === `/suplementos/${segment}`)?.links
    .map((link) => link.href.split("/").filter(Boolean).at(-1) ?? "")
    .filter(Boolean) ?? [];
}

function parseFilterState(params: SearchParamsInput): ProductListingFilterState {
  const requestedSort = getParam(params, "orden");
  const sortValues: Record<string, ProductListingSortValue> = {
    "mayor-precio": "mayor-precio",
    "mas-recientes": "mas-recientes",
    "mas-vendidos": "mas-vendidos",
    "menor-precio": "menor-precio",
  };
  return {
    brandSlugs: parseCsvParam(params, "marca"),
    categorySlugs: parseCsvParam(params, "categoria"),
    subcategorySlugs: parseCsvParam(params, "subcategoria"),
    precioMin: parsePriceParam(params, "precioMin"),
    precioMax: parsePriceParam(params, "precioMax"),
    sort: (requestedSort && sortValues[requestedSort]) || "relevantes",
  };
}

function serverSort(sort: ProductListingSortValue): CatalogListingQuery["sort"] {
  if (sort === "menor-precio") return CATALOG_LISTING_SORT.PRICE_ASC;
  if (sort === "mayor-precio") return CATALOG_LISTING_SORT.PRICE_DESC;
  if (sort === "mas-recientes") return CATALOG_LISTING_SORT.NEWEST;
  if (sort === "mas-vendidos") return CATALOG_LISTING_SORT.BEST_SELLING;
  return CATALOG_LISTING_SORT.FEATURED;
}

function option(facet: CatalogListingFacet, useNavigationLabel = false): ProductListingFilterOption {
  return { count: facet.count, id: facet.slug, label: useNavigationLabel ? navigationLabel(facet.slug, facet.label) : facet.label };
}

function navigationLabel(slug: string, fallback: string): string {
  const link = getShopNavItems().flatMap((item) => item.groups ?? []).flatMap((group) => group.links)
    .find((entry) => slugifyProductListingValue(entry.href.split("/").filter(Boolean).at(-1) ?? "") === slug);
  return link?.label ?? fallback;
}

function createFilterGroups(
  context: ProductListingContext,
  facets: { brands: CatalogListingFacet[]; categories: CatalogListingFacet[]; subcategories: CatalogListingFacet[] },
): ProductListingFilterGroup[] {
  const groups: ProductListingFilterGroup[] = [];
  const showsSubcategories = Boolean(context.categorySlug && context.categorySlug !== "suplementos" && !context.subcategorySlug);
  const categoryOptions = context.subcategorySlug
    ? []
    : showsSubcategories
      ? facets.subcategories.map((facet) => option(facet, true))
      : facets.categories.map((facet) => option(facet));
  if (categoryOptions.length > 0) {
    groups.push({
      id: showsSubcategories ? "subcategory" : "category",
      label: showsSubcategories ? "Subcategorías" : "Categorías",
      paramName: showsSubcategories ? "subcategoria" : "categoria",
      options: categoryOptions,
    });
  }
  if (!context.hideBrandFilter && facets.brands.length > 0) {
    groups.push({ id: "brand", label: "Marcas", paramName: "marca", options: facets.brands.map((facet) => option(facet)) });
  }
  return groups;
}

function errorListing(context: RouteContext, error: CatalogReadError, page: number, filterState: ProductListingFilterState): ProductListingResult {
  return {
    context,
    products: [],
    status: "error",
    error,
    page,
    totalPages: 0,
    totalCount: 0,
    filterState,
    filterGroups: [],
    sortOptions: productListingSortOptions,
    priceBounds: { min: 0, max: 0 },
  };
}

function readError(result: CatalogReadResult<unknown>): CatalogReadError | undefined {
  return result.status === "error" ? result.error : undefined;
}

export async function resolveProductListing(
  segments: string[],
  searchParams: SearchParamsInput = {},
  catalog: CatalogRepository = getCatalogRepository(),
): Promise<ProductListingResult | null> {
  const page = parsePage(searchParams);
  const filterState = parseFilterState(searchParams);
  const isBrandRoute = segments[0] === "marcas" && Boolean(segments[1]);
  const categoriesResult = isBrandRoute ? undefined : await catalog.getPublicCategories();
  const brandsResult = isBrandRoute ? await catalog.getPublicBrands() : undefined;
  const categories = categoriesResult && (categoriesResult.status === "success" || categoriesResult.status === "empty")
    ? categoriesResult.data
    : [];
  const brands = brandsResult && (brandsResult.status === "success" || brandsResult.status === "empty")
    ? brandsResult.data
    : [];
  const route = routeContext(
    segments,
    searchParams,
    categories,
    brands,
    categoriesResult?.status === "error" || brandsResult?.status === "error" || categoriesResult?.status === "loading" || brandsResult?.status === "loading",
  );
  if (!route) return null;

  if (route.canonicalPath) route.routePath = route.canonicalPath;
  const routeError = (isBrandRoute ? readError(brandsResult!) : readError(categoriesResult!));
  if (routeError) return errorListing(route, routeError, page, filterState);
  if (categoriesResult?.status === "loading" || brandsResult?.status === "loading") return errorListing(route, {
    code: "CATALOG_LOADING", message: "El catálogo todavía se está cargando.",
  }, page, filterState);

  const selectedSubcategories = route.subcategorySlug
    ? filterState.subcategorySlugs.length > 0 && !filterState.subcategorySlugs.includes(route.subcategorySlug)
      ? ["__no_matching_subcategory__"]
      : [route.subcategorySlug]
    : filterState.subcategorySlugs;
  const query: CatalogListingQuery = {
    limit: 20,
    page,
    sort: serverSort(filterState.sort),
    ...(route.categorySlug ? { categorySlug: route.categorySlug } : {}),
    ...(route.brandSlug ? { brandSlug: route.brandSlug } : {}),
    ...(route.type === "offers" ? { offersOnly: true } : {}),
    ...(route.searchQuery ? { search: route.searchQuery } : {}),
    ...(filterState.brandSlugs.length ? { brandSlugs: filterState.brandSlugs } : {}),
    ...(filterState.categorySlugs.length ? { categorySlugs: filterState.categorySlugs } : {}),
    ...(selectedSubcategories.length ? { subcategorySlugs: selectedSubcategories } : {}),
    ...(filterState.precioMin === undefined ? {} : { minPrice: filterState.precioMin }),
    ...(filterState.precioMax === undefined ? {} : { maxPrice: filterState.precioMax }),
  };
  const result = await catalog.getPublicListing(query);
  if (result.status === "error") return errorListing(route, result.error, page, filterState);
  if (result.status === "loading") return errorListing(route, {
    code: "CATALOG_LOADING", message: "El catálogo todavía se está cargando.",
  }, page, filterState);
  const listing = result.data;
  return {
    context: route,
    products: listing.items,
    status: listing.total === 0 ? "empty" : "success",
    page: listing.page,
    totalPages: listing.totalPages,
    totalCount: listing.total,
    filterState,
    filterGroups: createFilterGroups(route, listing.facets),
    sortOptions: productListingSortOptions,
    priceBounds: listing.priceBounds,
  };
}
