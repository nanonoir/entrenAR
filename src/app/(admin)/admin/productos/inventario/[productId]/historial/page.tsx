import { notFound } from "next/navigation";
import { InventoryHistoryPage } from "@/components/admin/products-flow/inventory/InventoryHistoryPage";
import { catalogData, getCatalogRepository } from "@/lib/api/catalog/catalog.repository";

export default async function StockHistoryRoute({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = catalogData(await getCatalogRepository().getAdminProductById(productId), null);

  if (!product) notFound();

  return <InventoryHistoryPage product={product} />;
}
