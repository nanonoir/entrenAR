import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { BreadcrumbBar } from "@/components/shop/layout/BreadcrumbBar";
import { ProductDetailCard } from "@/components/shop/products/ProductDetailCard";
import { ProductGrid } from "@/components/shop/products/ProductGrid";
import { ProductListingShell } from "@/components/shop/products/listing/ProductListingShell";
import { QuickBuyController } from "@/components/shop/quick-buy/QuickBuyController";
import { resolveShopRoute } from "@/lib/data/shop-routes";
import { resolveProductListing } from "@/lib/product-listing";
import { getCategoryHref } from "@/lib/routes";

type CatchAllShopPageProps = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CatchAllShopPage({ params, searchParams }: CatchAllShopPageProps) {
  const { segments } = await params;
  const resolvedSearchParams = await searchParams;
  const route = resolveShopRoute(segments);

  if (route.type === "product") {
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

  const listing = resolveProductListing(segments, resolvedSearchParams);

  if (!listing) {
    notFound();
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
