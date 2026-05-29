import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { HeroCarousel } from "@/components/shop/home/HeroCarousel";
import { HomeCategoryCard } from "@/components/shop/home/HomeCategoryCard";
import { HorizontalProductScroller } from "@/components/shop/products/HorizontalProductScroller";
import { ProductCard } from "@/components/shop/products/ProductCard";
import { QuickBuyController } from "@/components/shop/quick-buy/QuickBuyController";
import { getHeroBanners, getHomeCategoryCards } from "@/lib/data/home";
import { getBestSellerProductDetails } from "@/lib/data/products";

export default function HomePage() {
  const homeCategoryCards = getHomeCategoryCards();
  const bestSellerProducts = getBestSellerProductDetails();
  const heroBanners = getHeroBanners();

  return (
    <>
      <HeroCarousel banners={heroBanners} />

      <section className="py-12">
        <Container size="wide">
          <div className="mb-7 text-center">
            <h2 className="font-heading text-4xl leading-none sm:text-5xl">
              {"EXPLORA NUESTRAS CATEGOR\u00cdAS PRINCIPALES:"}
            </h2>
          </div>
          <div className="grid justify-items-center gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {homeCategoryCards.map((category) => (
              <HomeCategoryCard category={category} key={category.id} />
            ))}
          </div>
        </Container>
      </section>

      <section className="border-y border-border bg-surface py-12">
        <Container size="wide">
          <div className="mb-6">
            <h2 className="font-heading text-5xl leading-none">
              {"LOS M\u00c1S VENDIDOS:"}
            </h2>
          </div>
          <QuickBuyController>
            <HorizontalProductScroller ariaLabel="Los mas vendidos">
              {bestSellerProducts.map((product) => (
                <div
                  className="flex min-w-[calc((100%_-_1rem)/2)] sm:min-w-[240px] lg:min-w-[220px] xl:min-w-[240px]"
                  key={product.id}
                  role="listitem"
                >
                  <ProductCard density="compactMobile" product={product} />
                </div>
              ))}
            </HorizontalProductScroller>
          </QuickBuyController>
        </Container>
      </section>

      <section className="py-12">
        <Container size="wide">
          <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              iconSrc: "/ShipIcon.svg",
              title: "ENV\u00cdOS A TODO EL PA\u00cdS",
              text: "Gratis desde $75.000",
            },
            {
              iconSrc: "/PayCardIcon.svg",
              title: "CUOTAS Y FORMAS DE PAGO",
              text: "Hasta 6 cuotas sin inter\u00e9s",
            },
            {
              iconSrc: "/FreeReturnIcon.svg",
              title: "CAMBIOS Y DEVOLUCIONES",
              text: "Primer cambio gratis",
            },
          ].map((item) => (
            <div className="flex flex-col items-center text-center" key={item.title}>
              <Image alt="" aria-hidden height={176} src={item.iconSrc} width={176} />
              <h3 className="mt-4 font-subtitle text-lg font-bold uppercase leading-6 text-text">
                {item.title}
              </h3>
              <p className="mt-1 text-sm font-medium leading-6 text-text-muted">{item.text}</p>
            </div>
          ))}
          </div>
        </Container>
      </section>
    </>
  );
}
