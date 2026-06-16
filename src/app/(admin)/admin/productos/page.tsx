import { ProductListClient } from "@/components/admin/products-flow/ProductListClient";
import { getAdminProductCategories, getAdminProducts } from "@/lib/data/admin/sales-flow/mock-products";

export default async function ProductsPage() {
  const products = await getAdminProducts();
  const categories = await getAdminProductCategories();

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <ProductListClient categories={categories} products={products} />
    </div>
  );
}
