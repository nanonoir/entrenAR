import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandDirectory } from "../../src/components/shop/products/listing/BrandDirectory";
import { resolveShopRoute } from "../../src/lib/data/shop-routes";
import type { CatalogListingFacet, CatalogReadResult } from "../../src/lib/api/catalog/catalog.repository";

const loading = renderToStaticMarkup(createElement(BrandDirectory, { result: { status: "loading" } }));
if (!loading.includes("Cargando marcas")) throw new Error("Brand directory loading state is missing.");

const emptyResult: CatalogReadResult<CatalogListingFacet[]> = { data: [], status: "empty" };
const empty = renderToStaticMarkup(createElement(BrandDirectory, { result: emptyResult }));
if (!empty.includes("Todavía no hay marcas disponibles")) throw new Error("Brand directory empty state is missing.");

const errorResult: CatalogReadResult<CatalogListingFacet[]> = {
  error: { code: "CATALOG_API_UNAVAILABLE", message: "Unavailable" },
  status: "error",
};
const error = renderToStaticMarkup(createElement(BrandDirectory, { result: errorResult }));
if (!error.includes("No pudimos cargar las marcas") || error.includes("Todavía no hay marcas")) {
  throw new Error("Brand directory failure must remain distinct from an empty result.");
}

const brands: CatalogListingFacet[] = [
  { count: 51, label: "ENA", slug: "ena" },
  { count: 67, label: "Star Nutrition", slug: "star-nutrition" },
];
const populatedResult: CatalogReadResult<CatalogListingFacet[]> = { data: brands, status: "success" };
const populated = renderToStaticMarkup(createElement(BrandDirectory, { result: populatedResult }));
if (!populated.includes('href="/marcas/ena"') || !populated.includes('href="/marcas/star-nutrition"')
  || !populated.includes("Directorio de marcas")) {
  throw new Error("Brand directory must expose canonical links in an accessible index.");
}

async function verifyUnknownBrand(): Promise<void> {
  process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
  const route = await resolveShopRoute(["marcas", "brand-that-does-not-exist"]);
  if (route.type !== "not-found") throw new Error("Unknown brand route must retain not-found behavior.");
  console.log("catalog brand navigation harness: loading, empty, controlled error, canonical links, and unknown-brand not-found are represented");
}

void verifyUnknownBrand();
