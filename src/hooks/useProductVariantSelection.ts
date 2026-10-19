"use client";

import { useMemo, useState } from "react";
import {
  findVariantByOptions,
  getInitialOptionSelection,
  getStructuredOptions,
  getVariantAttributes,
  resolveOptionSelection,
} from "@/lib/variant-selection";
import type { ProductDetail, ProductVariant } from "@/types/product";

type VariantSelectableProduct = Pick<
  ProductDetail,
  "compareAtPrice" | "price" | "variantOptions" | "variants"
>;

function getSelectedVariant({
  hasStructuredOptions,
  product,
  selectedOptions,
  variantId,
}: {
  hasStructuredOptions: boolean;
  product: VariantSelectableProduct;
  selectedOptions: Record<string, string>;
  variantId: string | undefined;
}): ProductVariant | null {
  if (hasStructuredOptions) {
    return findVariantByOptions(product, selectedOptions) ?? null;
  }

  return product.variants.find((variant) => variant.id === variantId) ?? product.variants[0] ?? null;
}

export function useProductVariantSelection(product: VariantSelectableProduct) {
  const firstVariantId = product.variants[0]?.id;
  const initialOptionSelection = useMemo(() => getInitialOptionSelection(product), [product]);
  const hasStructuredOptions = useMemo(() => getStructuredOptions(product).length > 0, [product]);
  const [variantId, setVariantId] = useState(firstVariantId);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(initialOptionSelection);

  const selectedVariant = useMemo(
    () => getSelectedVariant({ hasStructuredOptions, product, selectedOptions, variantId }),
    [hasStructuredOptions, product, selectedOptions, variantId],
  );
  const attributes = useMemo(
    () => getVariantAttributes(product, selectedVariant?.optionValues ?? selectedOptions),
    [product, selectedOptions, selectedVariant],
  );

  const hasVariantSelector = product.variants.length > 1;
  const price = product.price;
  const compareAtPrice = product.compareAtPrice;
  const outOfStock = !selectedVariant || selectedVariant.stock <= 0;
  const maxQuantity = selectedVariant?.stock ?? 1;

  function selectVariant(nextVariantId: string) {
    setVariantId(nextVariantId);
    setQuantity(1);
  }

  function selectOption(optionId: string, valueId: string) {
    setSelectedOptions((current) => resolveOptionSelection(product, current, optionId, valueId));
    setQuantity(1);
  }

  return {
    attributes,
    compareAtPrice,
    hasStructuredOptions,
    hasVariantSelector,
    maxQuantity,
    outOfStock,
    price,
    primaryImageId: selectedVariant?.primaryImageId,
    quantity,
    selectedOptions,
    selectedVariant,
    selectOption,
    selectVariant,
    setQuantity,
  };
}
