export const productVariantPresets = [
  {
    name: "Sabor",
    values: ["Chocolate", "Vainilla", "Frutilla"],
  },
  {
    name: "Color",
    values: ["Negro", "Blanco", "Rojo", "Azul"],
  },
  {
    name: "Tamaño",
    values: ["Chico", "Mediano", "Grande"],
  },
  {
    name: "Talle",
    values: ["S", "M", "L", "XL"],
  },
] as const;

export type ProductVariantPresetName = (typeof productVariantPresets)[number]["name"];

export function getProductVariantPresetValues(name: string): readonly string[] {
  return productVariantPresets.find((preset) => preset.name === name)?.values ?? [];
}
