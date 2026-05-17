const supplementCategoryBySlug: Record<string, string> = {
  proteinas: "proteinas",
  "pre-intra-creatina": "creatina-y-pre",
  "vitaminas-suplementos": "vitaminas",
  performance: "creatina-y-pre",
};

export function getProductHref(slug: string) {
  return `/productos/${slug}`;
}

export function getCategoryHref(categorySlug: string) {
  const supplementSlug = Object.entries(supplementCategoryBySlug).find(
    ([, mappedCategorySlug]) => mappedCategorySlug === categorySlug,
  )?.[0];

  if (supplementSlug) {
    return `/suplementos/${supplementSlug}`;
  }

  if (categorySlug === "market") {
    return "/market";
  }

  if (categorySlug === "shakers") {
    return "/shakers";
  }

  if (categorySlug === "indumentaria") {
    return "/indumentaria";
  }

  if (categorySlug === "accesorios") {
    return "/accesorios";
  }

  return `/${categorySlug}`;
}
