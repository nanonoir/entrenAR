export type ProductVariantPropertyDraft = {
  name: string;
  values: string[];
};

export function getActiveVariantProperties(properties: ProductVariantPropertyDraft[]) {
  return properties
    .map((property) => ({
      name: property.name.trim(),
      values: property.values.map((value) => value.trim()).filter(Boolean),
    }))
    .filter((property) => property.name !== "" && property.values.length > 0)
    .slice(0, 2);
}

export function buildCombinations(properties: ProductVariantPropertyDraft[]) {
  const activeProperties = getActiveVariantProperties(properties);
  if (activeProperties.length === 0) return [];

  const combos = activeProperties.reduce<string[][]>((acc, property) => {
    if (acc.length === 0) return property.values.map((value) => [value]);
    return acc.flatMap((combo) => property.values.map((value) => [...combo, value]));
  }, []);

  return combos.map((combo, index) => ({
    id: `combo-${index + 1}`,
    name: combo.join(" / "),
    sku: `VAR-${String(index + 1).padStart(3, "0")}`,
    stock: 0,
  }));
}
