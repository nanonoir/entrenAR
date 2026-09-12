import { AdminCatalogReadBoundary } from "@/components/admin/products-flow/AdminCatalogReadBoundary";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminCatalogReadBoundary mode="edit" id={id} />;
}
