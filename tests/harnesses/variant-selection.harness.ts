import assert from "node:assert/strict";
import {
  findVariantByOptions,
  getInitialOptionSelection,
  getVariantAttributes,
  getVariantDisplayLabel,
  resolveOptionSelection,
  type VariantSelectableProduct,
} from "../../src/lib/variant-selection";

const variant = (id: string, color: string, size: string, stock: number) => ({
  id, label: `SKU-${id}`, optionValues: { color, talle: size }, price: 100, stock,
});

const shirt: VariantSelectableProduct = {
  variantOptions: [
    { id: "color", label: "Color", values: [{ id: "azul", label: "Azul" }, { id: "negro", label: "Negro" }] },
    { id: "talle", label: "Talle", values: ["s", "m", "l", "xl"].map((id) => ({ id, label: id.toUpperCase() })) },
  ],
  variants: [
    variant("1", "negro", "s", 0), variant("2", "negro", "m", 5), variant("3", "negro", "l", 2),
    variant("4", "azul", "s", 3), variant("5", "azul", "m", 0),
    // azul/l and azul/xl and negro/xl do not exist
  ],
};

// Independent attributes, never SKU combinations.
let attributes = getVariantAttributes(shirt, getInitialOptionSelection(shirt));
assert.deepEqual(attributes.map((attribute) => attribute.label), ["Color", "Talle"]);
assert.deepEqual(attributes[1]!.values.map((value) => value.label), ["S", "M", "L"], "values without any variant are dropped");
assert.ok(attributes.every((attribute) => attribute.values.every((value) => !value.label.startsWith("SKU-"))));

// Initial selection is the first in-stock variant (negro/m).
assert.deepEqual(getInitialOptionSelection(shirt), { color: "negro", talle: "m" });

// Keeping the combination when it exists, even if it is out of stock.
let selection = resolveOptionSelection(shirt, { color: "negro", talle: "m" }, "talle", "s");
assert.deepEqual(selection, { color: "negro", talle: "s" });
assert.equal(findVariantByOptions(shirt, selection)?.stock, 0);

// Absent combination: azul/l does not exist. Only the pressed attribute changes; no match, nothing to buy.
selection = resolveOptionSelection(shirt, { color: "negro", talle: "l" }, "color", "azul");
assert.deepEqual(selection, { color: "azul", talle: "l" }, "other attributes are never changed silently");
assert.equal(findVariantByOptions(shirt, selection), undefined, "no arbitrary variant for a missing combination");
attributes = getVariantAttributes(shirt, selection);
assert.equal(attributes[1]!.values.find((value) => value.id === "l")!.outOfStock, true, "azul/l is unavailable, not in stock");
assert.equal(attributes[1]!.values.find((value) => value.id === "l")!.disabled, false, "negro/l keeps l navigable");
assert.equal(attributes[1]!.values.find((value) => value.id === "s")!.outOfStock, false, "azul/s is in stock");

// Disjoint sets stay navigable: from azul/l (missing) the shopper can still pick any talle or go back to negro.
assert.deepEqual(resolveOptionSelection(shirt, selection, "talle", "s"), { color: "azul", talle: "s" });
assert.equal(findVariantByOptions(shirt, resolveOptionSelection(shirt, selection, "color", "negro"))?.id, "3");
// Exhausted combination exists but is out of stock; its value is still selectable when stocked elsewhere.
selection = resolveOptionSelection(shirt, { color: "azul", talle: "s" }, "talle", "m");
assert.equal(findVariantByOptions(shirt, selection)?.stock, 0);
assert.equal(getVariantAttributes(shirt, selection)[1]!.values.find((value) => value.id === "m")!.outOfStock, true);
// Unknown values are ignored.
assert.deepEqual(resolveOptionSelection(shirt, { color: "negro", talle: "m" }, "talle", "xl"), { color: "negro", talle: "m" });

// Stock flags per value.
attributes = getVariantAttributes(shirt, { color: "negro", talle: "s" });
assert.equal(attributes[1]!.values.find((value) => value.id === "s")!.outOfStock, true);
assert.equal(attributes[1]!.values.find((value) => value.id === "s")!.disabled, false, "azul/s is in stock");
assert.equal(attributes[1]!.values.find((value) => value.id === "l")!.outOfStock, false);

// Display label for cart/checkout summary.
assert.equal(getVariantDisplayLabel(shirt, shirt.variants[1]!), "Negro / M");

// Single-value attributes are informational (no choice) and stay in the label.
const combo: VariantSelectableProduct = {
  variantOptions: [
    { id: "color", label: "Color", values: [{ id: "negro", label: "Negro" }, { id: "azul", label: "Azul" }] },
    { id: "talle", label: "Talle", values: [{ id: "m", label: "M" }, { id: "l", label: "L" }] },
    { id: "shaker", label: "Shaker", values: [{ id: "incluido", label: "Incluido" }] },
  ],
  variants: ["negro", "azul"].flatMap((color) => ["m", "l"].map((size) => ({
    id: `${color}-${size}`, label: `COMBO-${color}-${size}`, price: 100, stock: 4,
    optionValues: { color, talle: size, shaker: "incluido" },
  }))),
};
const comboAttributes = getVariantAttributes(combo, getInitialOptionSelection(combo));
assert.deepEqual(comboAttributes.map((attribute) => [attribute.label, attribute.selectable]), [["Color", true], ["Talle", true], ["Shaker", false]]);
assert.equal(getVariantDisplayLabel(combo, combo.variants[0]!), "Negro / M / Incluido");

// Unique variant per product: no selectable attribute at all.
const single: VariantSelectableProduct = {
  variantOptions: [{ id: "sabor", label: "Sabor", values: [{ id: "vainilla", label: "Vainilla" }] }],
  variants: [{ id: "only", label: "SKU-ONLY", optionValues: { sabor: "vainilla" }, price: 1, stock: 1 }],
};
assert.deepEqual(getVariantAttributes(single, getInitialOptionSelection(single)).map((attribute) => attribute.selectable), [false]);

// Without structured options the stored label is kept.
const legacy: VariantSelectableProduct = { variants: [{ id: "x", label: "Chocolate", price: 1, stock: 1 }] };
assert.equal(getVariantDisplayLabel(legacy, legacy.variants[0]!), "Chocolate");
assert.deepEqual(getVariantAttributes(legacy, {}), []);

console.log("variant selection harness: passed");
