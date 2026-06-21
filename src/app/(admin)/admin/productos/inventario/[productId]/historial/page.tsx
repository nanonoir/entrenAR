import { notFound } from "next/navigation";
import { InventoryHistoryPage } from "@/components/admin/products-flow/inventory/InventoryHistoryPage";
import { getAdminProductById } from "@/lib/data/admin/sales-flow/mock-products";

export default async function StockHistoryRoute({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = await getAdminProductById(productId);

  if (!product) notFound();

  return <InventoryHistoryPage product={product} />;
}
