import assert from "node:assert/strict";
import { getAllProductDetails } from "../../src/lib/data/products";
import { isProductAvailable, selectBestSellers, selectRelatedProducts } from "../../src/lib/product-discovery";
import type { ProductDetail } from "../../src/types/product";

const baseline = getAllProductDetails()[0];
assert.ok(baseline);
function product(id: string, overrides: Partial<ProductDetail> = {}): ProductDetail {
  return { ...baseline, id, brand: " Real Brand ", categories: [{ id: "direct", name: "Direct", slug: "direct" }], stock: 1,
    variants: [{ id: `${id}-variant`, label: "Default", price: 1, stock: 1 }], ...overrides };
}
const current = product("current");
const category = product("z-category", { brand: "Other", isFeatured: false });
const brand = product("a-brand", { categories: [], brand: "ＲＥＡＬ Brand" });
const depleted = product("depleted", { stock: 0, isBestSeller: true, variants: [{ id: "zero", label: "Zero", price: 1, stock: 0 }] });
const mixed = product("mixed", { isBestSeller: true, variants: [...depleted.variants, { id: "remaining", label: "Remaining", price: 1, stock: 1 }] });
const infinite = product("infinite", { stock: Number.MAX_SAFE_INTEGER, variants: [{ id: "infinite-v", label: "Infinite", price: 1, stock: Number.MAX_SAFE_INTEGER }] });
assert.equal(isProductAvailable(depleted), false);
assert.equal(isProductAvailable(mixed), true);
assert.equal(isProductAvailable(infinite), true);
assert.deepEqual(selectBestSellers([depleted, mixed, infinite]).map(({ id }) => id), ["mixed", "infinite"]);
assert.deepEqual(selectRelatedProducts(current, [brand, current, depleted, category, category, product("unrelated", { brand: "Other", categories: [] })]).map(({ id }) => id), ["z-category", "a-brand"]);
assert.deepEqual(selectRelatedProducts(product("empty", { brand: "", categories: [] }), [product("missing", { brand: "", categories: [] })]), []);
assert.deepEqual(selectRelatedProducts(product("canonical-empty", { categories: [], brand: "Other" }), [product("legacy", { categories: undefined })]), []);
assert.equal(selectRelatedProducts(product("legacy-current", { categories: undefined }), [product("legacy", { categories: undefined, brand: "Other" })]).length, 1);
assert.equal(selectRelatedProducts(current, Array.from({ length: 8 }, (_, index) => product(String(index)))).length, 4);
assert.deepEqual(selectBestSellers([{ ...mixed, variants: depleted.variants }]), []);
console.log("product discovery harness: passed; affinity, deduplication, cap, depletion, multi-variant and infinite availability");
