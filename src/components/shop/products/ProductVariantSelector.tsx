"use client";

import { cn } from "@/lib/utils";
import type { VariantAttribute } from "@/lib/variant-selection";
import type { ProductVariant } from "@/types/product";

type ProductVariantSelectorProps = {
  attributes: VariantAttribute[];
  hasStructuredOptions: boolean;
  hasVariantSelector: boolean;
  onSelectOption: (optionId: string, valueId: string) => void;
  onSelectVariant: (variantId: string) => void;
  selectedVariant: ProductVariant | null;
  variants: ProductVariant[];
};

const choiceClassName =
  "flex min-h-10 items-center justify-center gap-2 rounded-button border px-3 py-2 font-subtitle text-sm font-bold uppercase transition sm:min-h-12 sm:px-4 sm:py-3";

function choiceStateClassName(selected: boolean, unavailable: boolean) {
  return cn(
    selected ? "border-accent bg-accent-soft text-accent-hover" : "border-border bg-white text-text hover:border-accent",
    unavailable && "opacity-45",
  );
}

/**
 * Shared variant picker for product detail and quick-buy. Structured attributes render one independent
 * selector each; single-value attributes are informational. Without structured data it falls back to
 * one button per variant label.
 */
export function ProductVariantSelector({
  attributes,
  hasStructuredOptions,
  hasVariantSelector,
  onSelectOption,
  onSelectVariant,
  selectedVariant,
  variants,
}: ProductVariantSelectorProps) {
  if (hasStructuredOptions) {
    return (
      <div className="grid gap-5">
        {attributes.map((attribute) =>
          attribute.selectable ? (
            <div className="grid gap-3" key={attribute.id}>
              <p className="text-base font-medium text-text">
                {attribute.label}: <span className="font-bold">{attribute.selectedLabel}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                {attribute.values.map((value) => {
                  const selected = attribute.selectedValueId === value.id;

                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(choiceClassName, choiceStateClassName(selected, value.outOfStock), value.disabled && "cursor-not-allowed")}
                      disabled={value.disabled}
                      key={value.id}
                      onClick={() => onSelectOption(attribute.id, value.id)}
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
                      {value.outOfStock ? <span className="text-sale">Sin stock</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-base font-medium text-text" key={attribute.id}>
              {attribute.label}: <span className="font-bold">{attribute.values[0]?.label}</span>
            </p>
          ),
        )}
      </div>
    );
  }

  if (!hasVariantSelector) return null;

  return (
    <div className="grid gap-3">
      <p className="text-base font-medium text-text">
        Variante: <span className="font-bold">{selectedVariant?.label}</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {variants.map((variant) => {
          const selected = variant.id === selectedVariant?.id;
          const disabled = variant.stock <= 0;

          return (
            <button
              aria-pressed={selected}
              className={cn(choiceClassName, "justify-start text-left", choiceStateClassName(selected, disabled), disabled && "cursor-not-allowed")}
              disabled={disabled}
              key={variant.id}
              onClick={() => onSelectVariant(variant.id)}
              type="button"
            >
              {variant.label}
              {disabled ? <span className="text-sale">Sin stock</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
