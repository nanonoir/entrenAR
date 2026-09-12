import { AdminCatalogReadBoundary } from "@/components/admin/products-flow/AdminCatalogReadBoundary";

export default async function StockHistoryRoute({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <AdminCatalogReadBoundary mode="history" id={productId} />;
}
