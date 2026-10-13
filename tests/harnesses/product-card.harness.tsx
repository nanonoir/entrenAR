import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductCard } from "../../src/components/shop/products/ProductCard";
import { getAllProductDetails } from "../../src/lib/data/products";

const baseline = getAllProductDetails()[0];
assert.ok(baseline);
const { variants: baselineVariants, ...summary } = baseline;
const html = renderToStaticMarkup(
  <main style={{ display: "flex", flexWrap: "wrap", gap: 24, padding: 24 }}>
    <section aria-label="Standard depleted" style={{ width: 280, height: 460 }}><ProductCard product={{ ...summary, name: "Standard depleted", stock: 0, price: 100000, compareAtPrice: 120000 }} /></section>
    <section aria-label="Compact depleted" style={{ width: 280, height: 460 }}><ProductCard density="compactMobile" product={{ ...summary, name: "Compact depleted", stock: 0, price: 100000, compareAtPrice: 120000 }} /></section>
    <section aria-label="Available" style={{ width: 280, height: 460 }}><ProductCard product={{ ...summary, name: "Available", stock: 1 }} /></section>
    <section aria-label="Infinite" style={{ width: 280, height: 460 }}><ProductCard product={{ ...summary, name: "Infinite", stock: Number.MAX_SAFE_INTEGER }} /></section>
  </main>,
);
assert.equal(html.match(/Sin stock/g)?.length, 2);
assert.equal(html.match(/aria-label="Ver /g)?.length, 4);
assert.equal(html.match(/disabled=""/g)?.length, 2);
assert.equal(html.match(/data-quick-buy-product-id=/g)?.length, 2);
assert.equal(html.match(/<span>Comprar<\/span>/g)?.length, 2);
assert.ok(!/<a[^>]*disabled/.test(html));
const variant = baselineVariants[0];
assert.ok(variant);
const mixed = { ...summary, stock: 0, variants: [{ ...variant, stock: 0 }, { ...variant, id: "second", stock: 1 }] };
assert.ok(!renderToStaticMarkup(<ProductCard product={mixed} />).includes('disabled=""'));
const emptyVariants = { ...mixed, stock: 100, variants: [] };
assert.ok(renderToStaticMarkup(<ProductCard product={emptyVariants} />).includes('disabled=""'));
const persistedImage = { ...emptyVariants, images: [{ id: "persisted", alt: "Real catalog image", label: "Image", tone: summary.imageTone, url: "https://assets.example.test/catalog.webp" }] };
const imageHtml = renderToStaticMarkup(<ProductCard product={persistedImage} />);
assert.ok(imageHtml.includes('src="https://assets.example.test/catalog.webp"'));
assert.ok(imageHtml.includes('alt="Real catalog image"') && imageHtml.includes('disabled=""'));
assert.ok(!html.includes('role="alert"') && !html.includes('aria-live='));
if (process.argv.includes("--html")) console.log(html);
else console.log("product card harness: passed; both densities, detail links, available/infinite and static accessible stock labels");
