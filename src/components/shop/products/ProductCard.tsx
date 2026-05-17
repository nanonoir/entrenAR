import Link from "next/link";
import { ProductBuyButton } from "@/components/shop/products/ProductBuyButton";
import { ProductVisual } from "@/components/shop/products/ProductVisual";
import { hasFreeShipping } from "@/lib/free-shipping";
import { formatCurrency, getDiscountPercentage } from "@/lib/pricing";
import { getProductHref } from "@/lib/routes";
import type { ProductSummary } from "@/types/product";

type ProductCardProps = {
  product: ProductSummary;
};

export function ProductCard({ product }: ProductCardProps) {
  const compareAtPrice = product.compareAtPrice;
  const discountPercentage = getDiscountPercentage(product.price, compareAtPrice);
  const hasDiscount = discountPercentage !== null && compareAtPrice !== undefined;
  const qualifiesForFreeShipping = hasFreeShipping(product.price);

  return (
    <article className="group grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-card border border-border bg-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative bg-white">
        {qualifiesForFreeShipping ? (
          <span className="absolute left-4 top-4 z-10 rounded-button bg-accent px-3 py-2 font-subtitle text-xs font-bold uppercase text-on-accent shadow-sm">
            {"ENV\u00cdO GRATIS"}
          </span>
        ) : null}
        <Link
          aria-label={`Ver ${product.name}`}
          className="block overflow-hidden"
          href={getProductHref(product.slug)}
        >
          <ProductVisual
            brand={product.brand}
            className="aspect-[4/3] rounded-none bg-white transition duration-300 group-hover:scale-[1.02]"
            name={product.name}
            tone={product.imageTone}
          />
        </Link>
      </div>

      <div className="flex h-full flex-col gap-3 px-4 pb-4 pt-3">
        <div className="min-h-[58px]">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold uppercase text-text-muted">{product.brand}</p>
            {hasDiscount ? (
              <span className="rounded-button bg-sale px-2 py-0.5 font-subtitle text-xs font-bold text-white sm:hidden">
                {`-${discountPercentage}%`}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 line-clamp-2 font-subtitle text-xl font-semibold leading-6 text-text">
            {product.name}
          </h3>
        </div>

        <div className="border-t border-border pt-2">
          {hasDiscount ? (
            <div className="flex flex-nowrap items-baseline gap-2">
              <span className="text-xs font-semibold tabular-nums text-text-muted line-through">
                {formatCurrency(compareAtPrice)}
              </span>
              <span className="font-subtitle text-xl font-bold tabular-nums text-text">
                {formatCurrency(product.price)}
              </span>
              <span className="hidden rounded-button bg-sale px-2 py-0.5 font-subtitle text-xs font-bold text-white sm:inline">
                {`-${discountPercentage}%`}
              </span>
            </div>
          ) : (
            <span className="block font-subtitle text-xl font-bold tabular-nums text-text">
              {formatCurrency(product.price)}
            </span>
          )}
        </div>

        <ProductBuyButton className="mt-auto" productId={product.id} productSlug={product.slug} />
      </div>
    </article>
  );
}
