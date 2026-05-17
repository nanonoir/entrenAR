"use client";

import { useMemo, useState } from "react";
import type { ProductDetail, ProductVariant } from "@/types/product";

type VariantSelectableProduct = Pick<
  ProductDetail,
  "compareAtPrice" | "price" | "variantOptions" | "variants"
>;

function getInitialOptionSelection(product: VariantSelectableProduct) {
  if (!product.variantOptions?.length) {
    return {};
  }

  const firstVariant = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];

  return firstVariant?.optionValues ?? {};
}

function getSelectedVariant({
  product,
  selectedOptions,
  variantId,
}: {
  product: VariantSelectableProduct;
  selectedOptions: Record<string, string>;
  variantId: string | undefined;
}): ProductVariant | null {
  if (product.variantOptions?.length) {
    return (
      product.variants.find((variant) =>
        product.variantOptions?.every((option) => variant.optionValues?.[option.id] === selectedOptions[option.id]),
      ) ??
      product.variants.find((variant) => variant.stock > 0) ??
      product.variants[0] ??
      null
    );
  }

  return product.variants.find((variant) => variant.id === variantId) ?? product.variants[0] ?? null;
}

export function useProductVariantSelection(product: VariantSelectableProduct) {
  const firstVariantId = product.variants[0]?.id;
  const initialOptionSelection = useMemo(() => getInitialOptionSelection(product), [product]);
  const [variantId, setVariantId] = useState(firstVariantId);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(initialOptionSelection);

  const selectedVariant = useMemo(
    () => getSelectedVariant({ product, selectedOptions, variantId }),
    [product, selectedOptions, variantId],
  );

  const hasStructuredOptions = Boolean(product.variantOptions?.length);
  const hasVariantSelector = product.variants.length > 1;
  const price = selectedVariant?.price ?? product.price;
  const compareAtPrice = selectedVariant?.compareAtPrice ?? product.compareAtPrice;
  const outOfStock = !selectedVariant || selectedVariant.stock <= 0;
  const maxQuantity = selectedVariant?.stock ?? 1;

  function selectVariant(nextVariantId: string) {
    setVariantId(nextVariantId);
    setQuantity(1);
  }

  function selectOption(optionId: string, valueId: string) {
    setSelectedOptions((current) => ({ ...current, [optionId]: valueId }));
    setQuantity(1);
  }

  return {
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
  };
}
