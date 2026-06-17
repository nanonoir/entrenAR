import { InventoryPage } from "@/components/admin/products-flow/inventory/InventoryPage";
import { getAdminProducts } from "@/lib/data/admin/sales-flow/mock-products";

export default async function ProductInventoryPage() {
  const products = await getAdminProducts();

  return <InventoryPage products={products} />;
}
