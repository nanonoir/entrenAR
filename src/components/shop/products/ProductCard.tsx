import Link from "next/link";
import { ProductBuyButton } from "@/components/shop/products/ProductBuyButton";
import { ProductVisual } from "@/components/shop/products/ProductVisual";
import { hasFreeShipping } from "@/lib/free-shipping";
import { isProductAvailable } from "@/lib/product-discovery";
import { formatCurrency, getDiscountPercentage } from "@/lib/pricing";
import { getProductHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { ProductDetail, ProductSummary } from "@/types/product";

type ProductCardProps = {
  product: ProductSummary & Partial<Pick<ProductDetail, "images" | "variants">>;
  density?: "standard" | "compactMobile";
};

const compactMobile = {
  freeShippingBadge: "max-sm:left-2 max-sm:top-2 max-sm:px-2 max-sm:py-1 max-sm:text-[10px]",
  body: "max-sm:gap-2 max-sm:px-2 max-sm:pb-2 max-sm:pt-2",
  titleBlock: "max-sm:min-h-[48px]",
  header: "max-sm:justify-start max-sm:gap-1.5",
  brand: "max-sm:max-w-[72%] max-sm:truncate max-sm:text-[10px] max-sm:leading-3",
  discountBadge: "max-sm:shrink-0 max-sm:px-1.5 max-sm:text-[10px]",
  title: "max-sm:mt-1 max-sm:text-base max-sm:leading-5",
  priceBlock: "max-sm:pt-1.5",
  compareAtPrice: "max-sm:text-[10px]",
  price: "max-sm:text-lg max-sm:leading-6",
  buyButton: "max-sm:h-9 max-sm:w-auto max-sm:self-center max-sm:gap-1 max-sm:px-3 max-sm:text-xs max-sm:[&_svg]:size-4",
};

export function ProductCard({ product, density = "standard" }: ProductCardProps) {
  const compareAtPrice = product.compareAtPrice;
  const discountPercentage = getDiscountPercentage(product.price, compareAtPrice);
  const hasDiscount = discountPercentage !== null && compareAtPrice !== undefined;
  const qualifiesForFreeShipping = hasFreeShipping(product.price);
  const isCompactMobile = density === "compactMobile";
  const depleted = !isProductAvailable(product);
  const image = product.images?.find((image) => image.url);

  return (
    <article className={cn("group grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-card border border-border shadow-card transition duration-200", depleted ? "bg-gray-50" : "bg-white hover:-translate-y-0.5 hover:shadow-lg")}>
      <div className="relative bg-white">
        {qualifiesForFreeShipping ? (
          <span
            className={cn(
              "absolute left-4 top-4 z-10 rounded-button bg-accent px-3 py-2 font-subtitle text-xs font-bold uppercase text-on-accent shadow-sm",
              isCompactMobile && compactMobile.freeShippingBadge,
            )}
          >
            {"ENV\u00cdO GRATIS"}
          </span>
        ) : null}
        <Link
          aria-label={`Ver ${product.name}`}
          className="block overflow-hidden"
          href={getProductHref(product.slug)}
        >
          {image ? (
            // Match the detail gallery's persisted-media rendering; placeholders remain a fallback.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={image.alt || product.name}
              className={cn("aspect-[4/3] w-full bg-white object-contain p-4 transition duration-300", depleted ? "opacity-80" : "group-hover:scale-[1.02]")}
              loading="lazy"
              src={image.url}
            />
          ) : <ProductVisual
            brand={product.brand}
            className={cn("aspect-[4/3] rounded-none bg-white transition duration-300", depleted ? "opacity-80" : "group-hover:scale-[1.02]")}
            name={product.name}
            tone={product.imageTone}
          />}
        </Link>
      </div>

      <div className={cn("flex h-full flex-col gap-3 px-4 pb-4 pt-3", isCompactMobile && compactMobile.body)}>
        <div className={cn("min-h-[58px]", isCompactMobile && compactMobile.titleBlock)}>
          <div className={cn("flex items-start justify-between gap-2", isCompactMobile && compactMobile.header)}>
            <p className={cn("text-xs font-bold uppercase text-text-muted", isCompactMobile && compactMobile.brand)}>
              {product.brand}
            </p>
            {hasDiscount ? (
              <span
                className={cn(
                  "rounded-button bg-sale px-2 py-0.5 font-subtitle text-xs font-bold text-white sm:hidden",
                  isCompactMobile && compactMobile.discountBadge,
                )}
              >
                {`-${discountPercentage}%`}
              </span>
            ) : null}
          </div>
          <h3
            className={cn(
              "mt-2 line-clamp-2 font-subtitle text-xl font-semibold leading-6 text-text",
              isCompactMobile && compactMobile.title,
            )}
          >
            {product.name}
          </h3>
        </div>

        <div className={cn("border-t border-border pt-2", isCompactMobile && compactMobile.priceBlock)}>
          {hasDiscount ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums text-text-muted line-through",
                  isCompactMobile && compactMobile.compareAtPrice,
                )}
              >
                {formatCurrency(compareAtPrice)}
              </span>
              <span
                className={cn(
                  "font-subtitle text-xl font-bold tabular-nums text-text",
                  isCompactMobile && compactMobile.price,
                )}
              >
                {formatCurrency(product.price)}
              </span>
              <span className="hidden rounded-button bg-sale px-2 py-0.5 font-subtitle text-xs font-bold text-white sm:inline">
                {`-${discountPercentage}%`}
              </span>
            </div>
          ) : (
            <span
              className={cn(
                "block font-subtitle text-xl font-bold tabular-nums text-text",
                isCompactMobile && compactMobile.price,
              )}
            >
              {formatCurrency(product.price)}
            </span>
          )}
        </div>

        <ProductBuyButton
          disabled={depleted}
          className={cn("mt-auto", isCompactMobile && compactMobile.buyButton)}
          productId={product.id}
          productSlug={product.slug}
        />
      </div>
    </article>
  );
}
