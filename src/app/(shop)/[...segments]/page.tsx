import { SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { BreadcrumbBar } from "@/components/shop/layout/BreadcrumbBar";
import { ProductDetailCard } from "@/components/shop/products/ProductDetailCard";
import { ProductGrid } from "@/components/shop/products/ProductGrid";
import { QuickBuyController } from "@/components/shop/quick-buy/QuickBuyController";
import { resolveShopRoute } from "@/lib/data/shop-routes";
import { getCategoryHref } from "@/lib/routes";

type CatchAllShopPageProps = {
  params: Promise<{ segments: string[] }>;
};

export default async function CatchAllShopPage({ params }: CatchAllShopPageProps) {
  const { segments } = await params;
  const route = resolveShopRoute(segments);

  if (route.type === "not-found") {
    notFound();
  }

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

  return (
    <>
      <BreadcrumbBar
        items={[
          { label: "Inicio", href: "/" },
          { label: route.title, current: true },
        ]}
      />
      <Container className="py-10" size="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge tone="accent">{route.badgeLabel}</Badge>
            <h1 className="mt-3 font-heading text-6xl leading-none">{route.title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-text-muted">{route.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary">
              <SlidersHorizontal aria-hidden size={16} />
              Filtros
            </Button>
            <Button size="sm" variant="secondary">Ordenar: destacados</Button>
          </div>
        </div>
        <div className="mt-8">
          {route.products.length > 0 ? (
            <QuickBuyController>
              <ProductGrid products={route.products} />
            </QuickBuyController>
          ) : (
            <EmptyState
              description="Esta ruta de catálogo está preparada, pero todavía no tiene mocks curados."
              title="Sin productos"
            />
          )}
        </div>
      </Container>
    </>
  );
}
