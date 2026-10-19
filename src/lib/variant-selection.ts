import type { ProductVariant, ProductVariantOption } from "@/types/product";

export type VariantSelectableProduct = {
  variantOptions?: ProductVariantOption[];
  variants: ProductVariant[];
};

export type OptionSelection = Record<string, string>;

export type VariantAttributeValue = {
  id: string;
  label: string;
  swatch?: string;
  /** No variant with this value is in stock: the value cannot be chosen. */
  disabled: boolean;
  /** The combination with the current selection of the other attributes is out of stock or does not exist. */
  outOfStock: boolean;
};

export type VariantAttribute = {
  id: string;
  label: string;
  values: VariantAttributeValue[];
  /** More than one value exists: the shopper has a real choice. */
  selectable: boolean;
  selectedLabel?: string;
  selectedValueId?: string;
};

/**
 * Attributes that have structured data on the variants. Values that no variant carries are dropped,
 * and attributes left without values are ignored, so a selector never offers something that cannot exist.
 */
export function getStructuredOptions(product: VariantSelectableProduct): ProductVariantOption[] {
  return (product.variantOptions ?? []).flatMap((option) => {
    const values = option.values.filter((value) =>
      product.variants.some((variant) => variant.optionValues?.[option.id] === value.id),
    );

    return values.length > 0 ? [{ ...option, values }] : [];
  });
}

export function getInitialOptionSelection(product: VariantSelectableProduct): OptionSelection {
  if (getStructuredOptions(product).length === 0) return {};

  const firstVariant = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];

  return firstVariant?.optionValues ?? {};
}

export function findVariantByOptions(
  product: VariantSelectableProduct,
  selection: OptionSelection,
): ProductVariant | undefined {
  const options = getStructuredOptions(product);

  return product.variants.find((variant) =>
    options.every((option) => variant.optionValues?.[option.id] === selection[option.id]),
  );
}

/**
 * Applies a single attribute change and never touches the other attributes. The resulting combination may
 * not exist; `findVariantByOptions` then returns undefined and the shopper cannot buy until choosing a real one.
 */
export function resolveOptionSelection(
  product: VariantSelectableProduct,
  current: OptionSelection,
  optionId: string,
  valueId: string,
): OptionSelection {
  const exists = getStructuredOptions(product).some(
    (option) => option.id === optionId && option.values.some((value) => value.id === valueId),
  );

  return exists ? { ...current, [optionId]: valueId } : current;
}

export function getVariantAttributes(
  product: VariantSelectableProduct,
  selection: OptionSelection,
): VariantAttribute[] {
  return getStructuredOptions(product).map((option) => {
    const values = option.values.map((value) => {
      const candidates = product.variants.filter((variant) => variant.optionValues?.[option.id] === value.id);
      const matching = candidates.filter((variant) =>
        getStructuredOptions(product).every(
          (other) => other.id === option.id || !selection[other.id] || variant.optionValues?.[other.id] === selection[other.id],
        ),
      );

      return {
        ...value,
        disabled: candidates.every((variant) => variant.stock <= 0),
        outOfStock: matching.every((variant) => variant.stock <= 0),
      };
    });
    const selected = values.find((value) => value.id === selection[option.id]);

    return {
      id: option.id,
      label: option.label,
      selectable: values.length > 1,
      ...(selected ? { selectedLabel: selected.label, selectedValueId: selected.id } : {}),
      values,
    };
  });
}

/** `Negro / M` built from structured values; falls back to the stored label when data is incomplete. */
export function getVariantDisplayLabel(product: VariantSelectableProduct, variant: ProductVariant): string {
  const options = getStructuredOptions(product);
  const labels = options.map(
    (option) => option.values.find((value) => value.id === variant.optionValues?.[option.id])?.label,
  );

  return options.length > 0 && labels.every((label): label is string => Boolean(label))
    ? labels.join(" / ")
    : variant.label;
}
