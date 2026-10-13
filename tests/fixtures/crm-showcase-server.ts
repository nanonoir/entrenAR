import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { getAllProductDetails } from "../../src/lib/data/products";

// Synthetic catalog only: this process never imports backend/Prisma or connects to a database.
const baseline = getAllProductDetails()[0];
if (!baseline) throw new Error("Missing safe catalog fixture");
let depleted = false;
const products = ["current", "category", "brand", "mixed", "infinite", "empty", "unrelated"].map((id) => ({
  ...baseline, id, slug: `fixture-${id}`, name: `Fixture ${id}`, brand: id === "category" ? "Other" : id === "unrelated" ? "Unrelated" : "Real Brand",
  categories: [{ id: ["current", "category", "mixed", "infinite", "empty"].includes(id) ? "direct" : "other", name: "Fixture category", slug: "fixture-category" }],
  categorySlug: "fixture-category", categorySlugs: ["fixture-category"], categoryName: "Fixture category",
  images: [], variantProperties: [], price: 100000, compareAtPrice: 120000,
  isBestSeller: id !== "unrelated", isFeatured: false,
  stock: id === "empty" ? 0 : id === "infinite" ? "infinite" : 1,
  variants: id === "mixed" ? [
    { id: "mixed-zero", label: "Zero", price: 100000, stock: 0 },
    { id: "mixed-one", label: "One", price: 100000, stock: 1 },
  ] : [{ id: `${id}-v`, label: "Default", price: 100000, stock: id === "empty" ? 0 : id === "infinite" ? "infinite" : 1 }],
}));
const snapshot = () => products.map((product) => depleted && product.id === "mixed"
  ? { ...product, stock: 0, variants: product.variants.map((variant) => ({ ...variant, stock: 0 })) } : product);

// Detail-only fixtures do not affect the existing discovery/listing scenario.
function galleryProduct(single: boolean) {
  const count = single ? 1 : 13;
  return {
    ...products[0], id: single ? "gallery-single" : "gallery-many", slug: single ? "fixture-gallery-single" : "fixture-gallery-many", name: "Fixture gallery",
    images: Array.from({ length: count }, (_, index) => ({ id: `frame-${index + 1}`, alt: `Gallery frame ${index + 1}`, position: index + 1, storageKey: `fixture/frame-${index + 1}.svg`, url: `http://127.0.0.1:3218/__fixture/gallery-image/${index + 1}` })),
    description: `${Array.from({ length: 30 }, (_, index) => `<p>Paragraph ${index + 1}: complete long product description retained for this safe gallery fixture.</p>`).join("")}<img alt="Description illustration" width="2400" src="http://127.0.0.1:3218/__fixture/gallery-image/1" /><table style="width:1800px"><tbody><tr><td>${"LongUnbrokenText".repeat(80)}</td></tr></tbody></table><p>END OF COMPLETE DESCRIPTION</p>`,
    variantProperties: single ? [] : [{ id: "flavor", name: "Sabor", values: ["First", "Middle", "Last"] }],
    variants: (single ? [1] : [1, 7, 13]).map((frame, index) => ({ id: `gallery-variant-${index}`, label: ["First", "Middle", "Last"][index], optionValues: { flavor: ["first", "middle", "last"][index] }, primaryImageId: `frame-${frame}`, stock: 5, price: 100000 })),
  };
}

const server = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3217");
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3218");
  if (url.pathname.startsWith("/__fixture/gallery-image/") && request.method === "GET") {
    const frame = Number(url.pathname.split("/").at(-1));
    const width = frame % 3 === 0 ? 1200 : 400;
    const height = frame % 3 === 1 ? 1200 : 400;
    response.setHeader("Content-Type", "image/svg+xml");
    response.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${frame % 2 ? "#e8f5e9" : "#ffebee"}"/><rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="#111" stroke-width="10"/><text x="50%" y="50%" text-anchor="middle" font-size="48">FRAME ${frame}</text></svg>`); return;
  }
  if (url.pathname === "/__fixture/reset" && request.method === "POST") { depleted = false; response.end("{}"); return; }
  if (url.pathname === "/__fixture/deplete" && request.method === "POST") { depleted = true; response.end("{}"); return; }
  if (request.method !== "GET") { response.writeHead(405).end("{}"); return; }
  const items = snapshot();
  if (url.pathname === "/api/v1/categories") { response.end(JSON.stringify([{ id: "direct", slug: "fixture-category", name: "Fixture category", description: "Synthetic fixture" }])); return; }
  if (url.pathname === "/api/v1/brands") { response.end("[]"); return; }
  if (url.pathname.startsWith("/api/v1/products/")) {
    if (url.pathname.endsWith("/fixture-gallery-many") || url.pathname.endsWith("/fixture-gallery-single")) {
      response.end(JSON.stringify(galleryProduct(url.pathname.endsWith("-single")))); return;
    }
    const product = items.find((entry) => entry.slug === url.pathname.split("/").at(-1));
    response.writeHead(product ? 200 : 404).end(JSON.stringify(product ?? {})); return;
  }
  if (url.pathname === "/api/v1/products") {
    response.end(JSON.stringify({ items, total: items.length, page: 1, limit: Number(url.searchParams.get("limit") ?? 100), totalPages: 1,
      facets: { brands: [], categories: [], subcategories: [] }, priceBounds: { min: 100000, max: 100000 } })); return;
  }
  response.writeHead(404).end("{}");
});
server.listen(3218, "127.0.0.1", () => {
  const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3217"], {
    windowsHide: true, stdio: "inherit", env: { ...process.env,
      NEXT_PUBLIC_DATA_SOURCE: "api", NEXT_PUBLIC_CATALOG_API_BASE_URL: "http://127.0.0.1:3218/api/v1",
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:3218/api/v1", NEXT_PUBLIC_ACCOUNT_API_BASE_URL: "http://127.0.0.1:3218/api/v1",
      NEXT_PUBLIC_COMMERCE_DATA_SOURCE: "mock", NEXT_PUBLIC_CHECKOUT_DATA_SOURCE: "mock",
      ADMIN_GATE_SIGNING_SECRET: "fixture-only-secret-0123456789012345" },
  });
  const stop = () => { next.kill(); server.close(); };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
  next.on("exit", (code) => { server.close(); process.exitCode = code ?? 0; });
});
