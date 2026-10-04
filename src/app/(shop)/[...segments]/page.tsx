import { notFound, permanentRedirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { BreadcrumbBar } from "@/components/shop/layout/BreadcrumbBar";
import { ProductDetailCard } from "@/components/shop/products/ProductDetailCard";
import { ProductGrid } from "@/components/shop/products/ProductGrid";
import { ProductListingShell } from "@/components/shop/products/listing/ProductListingShell";
import { BrandDirectory } from "@/components/shop/products/listing/BrandDirectory";
import { QuickBuyController } from "@/components/shop/quick-buy/QuickBuyController";
import { getCatalogRepository } from "@/lib/api/catalog/catalog.repository";
import { isLegacyShakerRoute, resolveShopRoute } from "@/lib/data/shop-routes";
import { resolveProductListing } from "@/lib/product-listing";
import { getCategoryHref } from "@/lib/routes";

type CatchAllShopPageProps = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CatchAllShopPage({ params, searchParams }: CatchAllShopPageProps) {
  const { segments } = await params;
  const resolvedSearchParams = await searchParams;
  if (isLegacyShakerRoute(segments)) {
    permanentRedirect(withQuery("/shakers", resolvedSearchParams));
  }

  if (segments[0] === "marcas" && segments.length === 1) {
    const brands = await getCatalogRepository().getPublicBrands();
    return (
      <>
        <BreadcrumbBar items={[{ label: "Inicio", href: "/" }, { label: "Marcas", current: true }]} />
        <Container className="py-10" size="wide">
          <h1 className="mb-8 font-heading text-5xl leading-none sm:text-6xl">Marcas</h1>
          <BrandDirectory result={brands} />
        </Container>
      </>
    );
  }

  if (segments[0] === "productos" && segments[1]) {
    const route = await resolveShopRoute(segments);
    if (route.type === "catalog-error") {
      return (
        <Container className="py-10" size="wide">
          <p aria-live="assertive" className="rounded-card border border-border bg-white p-6 text-sm text-text-muted" role="alert">
            No pudimos cargar este producto. Intenta nuevamente más tarde.
          </p>
        </Container>
      );
    }
    if (route.type === "not-found") notFound();
    if (route.type !== "product") notFound();
    const { product, related } = route;

    return (
      <>
        <BreadcrumbBar
          items={[
            { label: "Inicio", href: "/" },
            { label: product.categoryName, href: getCategoryHref(product.categorySlug) },
            { label: product.name, current: true },
          ]}
        />
        <Container className="py-10" size="wide">
          <ProductDetailCard product={product} />
          <section className="mt-12">
            <h2 className="mb-5 font-heading text-5xl leading-none">PRODUCTOS RELACIONADOS</h2>
            <QuickBuyController>
              <ProductGrid products={related} />
            </QuickBuyController>
          </section>
        </Container>
      </>
    );
  }

  const listing = await resolveProductListing(segments, resolvedSearchParams);

  if (!listing) {
    notFound();
  }
  if (listing.context.canonicalPath && listing.context.canonicalPath !== `/${segments.join("/")}`) {
    permanentRedirect(withQuery(listing.context.canonicalPath, resolvedSearchParams));
  }

  return (
    <>
      <BreadcrumbBar
        items={[
          { label: "Inicio", href: "/" },
          { label: listing.context.title, current: true },
        ]}
      />
      <Container className="py-10" size="wide">
        <ProductListingShell listing={listing} />
      </Container>
    </>
  );
}

function withQuery(path: string, searchParams: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry);
  }
  const queryString = query.toString();
  return `${path}${queryString ? `?${queryString}` : ""}`;
}
