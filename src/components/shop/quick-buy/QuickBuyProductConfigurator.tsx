"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { ProductVisual } from "@/components/shop/products/ProductVisual";
import { useProductVariantSelection } from "@/hooks/useProductVariantSelection";
import { toCartPreviewItem } from "@/lib/cart-items";
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
    compareAtPrice,
    hasStructuredOptions,
    hasVariantSelector,
    maxQuantity,
    outOfStock,
    price,
    quantity,
    selectedOptions,
    selectedVariant,
    selectOption,
    selectVariant,
    setQuantity,
  } = useProductVariantSelection(product);

  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1fr] lg:gap-8">
      <div className="-mx-5 flex items-center justify-center sm:mx-0">
        <ProductVisual
          brand={product.brand}
          className={cn("min-h-[200px] w-full rounded-none bg-white sm:min-h-[420px] sm:max-w-md sm:rounded-card", imageClassName)}
          name={product.name}
          tone={product.imageTone}
        />
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

        {hasStructuredOptions ? (
          <div className="grid gap-5">
            {product.variantOptions?.map((option) => {
              const selectedValue = selectedOptions[option.id];
              const selectedLabel =
                option.values.find((value) => value.id === selectedValue)?.label ?? option.values[0]?.label;

              return (
                <div className="grid gap-3" key={option.id}>
                  <p className="text-base font-medium text-text">
                    {option.label}: <span className="font-bold">{selectedLabel}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                    {option.values.map((value) => {
                      const nextSelection = { ...selectedOptions, [option.id]: value.id };
                      const matchingVariants = product.variants.filter((variant) =>
                        product.variantOptions?.every((group) => {
                          const selectedOptionValue =
                            group.id === option.id ? value.id : nextSelection[group.id];

                          return (
                            !selectedOptionValue ||
                            variant.optionValues?.[group.id] === selectedOptionValue
                          );
                        }),
                      );
                      const disabled =
                        matchingVariants.length > 0 &&
                        matchingVariants.every((variant) => variant.stock <= 0);
                      const selected = selectedValue === value.id;

                      return (
                        <button
                          aria-pressed={selected}
                          className={cn(
                            "flex min-h-10 items-center justify-center gap-2 rounded-button border px-3 py-2 font-subtitle text-sm font-bold uppercase transition sm:min-h-12 sm:px-4 sm:py-3",
                            selected
                              ? "border-accent bg-accent-soft text-accent-hover"
                              : "border-border bg-white text-text hover:border-accent",
                            disabled && "cursor-not-allowed opacity-45",
                          )}
                          disabled={disabled}
                          key={value.id}
                          onClick={() => selectOption(option.id, value.id)}
                          type="button"
                        >
                          {value.swatch ? (
                            <span
                              aria-hidden
                              className="h-5 w-5 rounded-sm border border-border"
                              style={{ backgroundColor: value.swatch }}
                            />
                          ) : null}
                          {value.label}
                          {disabled ? <span className="text-sale">Sin stock</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : hasVariantSelector ? (
          <div className="grid gap-3">
            <p className="text-base font-medium text-text">
              Variante: <span className="font-bold">{selectedVariant?.label}</span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {product.variants.map((variant) => {
                const selected = variant.id === selectedVariant?.id;
                const disabled = variant.stock <= 0;

                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "min-h-10 rounded-button border px-3 py-2 text-left font-subtitle text-sm font-bold uppercase transition sm:min-h-12 sm:px-4 sm:py-3",
                      selected
                        ? "border-accent bg-accent-soft text-accent-hover"
                        : "border-border bg-white text-text hover:border-accent",
                      disabled && "cursor-not-allowed opacity-45",
                    )}
                    disabled={disabled}
                    key={variant.id}
                    onClick={() => selectVariant(variant.id)}
                    type="button"
                  >
                    {variant.label}
                    {disabled ? <span className="ml-2 text-sale">Sin stock</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

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
