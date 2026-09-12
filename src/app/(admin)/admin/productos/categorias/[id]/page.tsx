import { AdminCatalogReadBoundary } from "@/components/admin/products-flow/AdminCatalogReadBoundary";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminCatalogReadBoundary mode="category" id={id} />;
}
