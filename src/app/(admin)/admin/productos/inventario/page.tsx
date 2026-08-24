import { InventoryPage } from "@/components/admin/products-flow/inventory/InventoryPage";
import { catalogData, getCatalogRepository } from "@/lib/api/catalog/catalog.repository";

export default async function ProductInventoryPage() {
  const products = catalogData(await getCatalogRepository().getAdminProducts(), []);

  return <InventoryPage products={products} />;
}
