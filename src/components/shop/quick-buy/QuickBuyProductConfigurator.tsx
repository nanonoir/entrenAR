"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { ProductVariantSelector } from "@/components/shop/products/ProductVariantSelector";
import { ProductVisual } from "@/components/shop/products/ProductVisual";
import { useProductVariantSelection } from "@/hooks/useProductVariantSelection";
import { getProductImage, toCartPreviewItem } from "@/lib/cart-items";
import { formatCurrency } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { CartPreviewItem } from "@/types/cart";
import type { QuickBuyProduct } from "@/types/product";

type QuickBuyProductConfiguratorProps = {
  product: QuickBuyProduct;
  submitLabel: string;
  onConfirm: (item: CartPreviewItem) => void;
  imageClassName?: string;
};

export function QuickBuyProductConfigurator({
  product,
  submitLabel,
  onConfirm,
  imageClassName,
}: QuickBuyProductConfiguratorProps) {
  const {
    attributes,
    compareAtPrice,
    hasStructuredOptions,
    hasVariantSelector,
    maxQuantity,
    outOfStock,
    price,
    quantity,
    selectedVariant,
    selectOption,
    selectVariant,
    setQuantity,
  } = useProductVariantSelection(product);
  const image = getProductImage(product.images, selectedVariant);

  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1fr] lg:gap-8">
      <div className="-mx-5 flex items-center justify-center sm:mx-0">
        {image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={image.alt || product.name}
            className={cn("min-h-[200px] w-full rounded-none bg-white object-contain sm:min-h-[420px] sm:max-w-md sm:rounded-card", imageClassName)}
            src={image.url}
          />
        ) : (
          <ProductVisual
            brand={product.brand}
            className={cn("min-h-[200px] w-full rounded-none bg-white sm:min-h-[420px] sm:max-w-md sm:rounded-card", imageClassName)}
            name={product.name}
            tone={product.imageTone}
          />
        )}
      </div>

      <div className="grid content-center gap-4 sm:gap-6">
        <div>
          <p className="font-subtitle text-sm font-bold uppercase text-text-muted">{product.brand}</p>
          <h2 className="mt-2 font-subtitle text-3xl font-semibold leading-8 text-text sm:text-4xl sm:leading-10">
            {product.name}
          </h2>
          <div className="mt-3 flex flex-wrap items-baseline gap-3 sm:mt-4">
            <span className="font-subtitle text-2xl font-bold tabular-nums text-text sm:text-4xl">
              {formatCurrency(price)}
            </span>
            {compareAtPrice && compareAtPrice > price ? (
              <span className="text-sm font-semibold tabular-nums text-text-muted line-through sm:text-base">
                {formatCurrency(compareAtPrice)}
              </span>
            ) : null}
          </div>
        </div>

        <ProductVariantSelector
          attributes={attributes}
          hasStructuredOptions={hasStructuredOptions}
          hasVariantSelector={hasVariantSelector}
          onSelectOption={selectOption}
          onSelectVariant={selectVariant}
          selectedVariant={selectedVariant}
          variants={product.variants}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <QuantitySelector
            max={maxQuantity}
            onChange={setQuantity}
            value={Math.min(quantity, maxQuantity)}
          />
          <Button
            className="h-12 w-full justify-center text-base sm:flex-1"
            disabled={outOfStock}
            onClick={() => {
              if (selectedVariant) {
                onConfirm(toCartPreviewItem({ product, quantity, variant: selectedVariant }));
              }
            }}
            size="lg"
          >
            <ShoppingCart aria-hidden size={20} />
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
