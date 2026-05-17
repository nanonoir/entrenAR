"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { ProductVisual } from "@/components/shop/products/ProductVisual";
import { getDiscountPercentage } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { QuickBuyProduct } from "@/types/product";

type OfferProductCardProps = {
  product: QuickBuyProduct;
  quantity: number;
  onConfigure: (product: QuickBuyProduct) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  density?: "default" | "compact";
};

export function OfferProductCard({
  product,
  quantity,
  onConfigure,
  onIncrement,
  onDecrement,
  density = "default",
}: OfferProductCardProps) {
  const variant = product.variants[0];
  const discountPercentage = getDiscountPercentage(product.price, product.compareAtPrice);

  if (!variant) {
    return null;
  }

  return (
    <article
      className={cn(
        "grid shrink-0 overflow-hidden rounded-card border border-border bg-white shadow-card",
        density === "compact" ? "w-[160px]" : "w-[220px]",
      )}
    >
      <div className={cn("relative border-b border-border", density === "compact" ? "h-28" : "h-44")}>
        <ProductVisual
          brand={product.brand}
          className={cn("h-full rounded-none", density === "compact" ? "p-2" : "p-3")}
          name={product.name}
          tone={product.imageTone}
        />
        <div className="absolute bottom-3 right-3">
          {quantity > 0 ? (
            <div className="grid h-10 grid-cols-[36px_42px_36px] overflow-hidden rounded-full border border-accent bg-white text-accent shadow-sm">
              <button
                aria-label={`Reducir ${product.name}`}
                className="flex items-center justify-center transition hover:bg-accent-soft"
                onClick={onDecrement}
                type="button"
              >
                <Minus aria-hidden size={16} />
              </button>
              <output className="flex items-center justify-center font-subtitle text-base font-bold">
                {quantity}
              </output>
              <button
                aria-label={`Aumentar ${product.name}`}
                className="flex items-center justify-center bg-accent text-white transition hover:bg-accent-hover"
                onClick={onIncrement}
                type="button"
              >
                <Plus aria-hidden size={18} />
              </button>
            </div>
          ) : (
            <Button
              aria-label={`Agregar ${product.name}`}
              className={cn(
                "rounded-full border border-accent bg-white text-accent shadow-sm hover:bg-accent hover:text-white",
                density === "compact" && "-translate-x-6",
              )}
              onClick={() => onConfigure(product)}
              size="icon"
              variant="ghost"
            >
              <Plus aria-hidden size={24} />
            </Button>
          )}
        </div>
      </div>
      <div className={cn("grid gap-2", density === "compact" ? "p-3" : "p-4")}>
        <h4
          className={cn(
            "line-clamp-2 font-subtitle font-semibold text-text",
            density === "compact" ? "text-sm leading-5" : "text-lg leading-6",
          )}
        >
          {product.name}
        </h4>
        <PriceDisplay
          compareAtPrice={product.compareAtPrice}
          price={product.price}
          size={density === "compact" ? "sm" : "md"}
        />
        {discountPercentage ? (
          <p className={cn("font-subtitle font-bold uppercase text-accent", density === "compact" ? "text-xs" : "text-sm")}>
            {discountPercentage}% OFF
          </p>
        ) : null}
      </div>
    </article>
  );
}
