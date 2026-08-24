import { ProductListClient } from "@/components/admin/products-flow/ProductListClient";
import { catalogData, getCatalogRepository } from "@/lib/api/catalog/catalog.repository";

export default async function ProductsPage() {
  const catalog = getCatalogRepository();
  const [productsResult, categoriesResult] = await Promise.all([
    catalog.getAdminProducts(),
    catalog.getAdminCategories(),
  ]);
  const products = catalogData(productsResult, []);
  const categories = catalogData(categoriesResult, []);

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <ProductListClient categories={categories} products={products} />
    </div>
  );
}
