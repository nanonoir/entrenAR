import { notFound } from "next/navigation";
import { CategoryEditPage } from "@/components/admin/products-flow/categories/CategoryEditPage";
import { catalogData, getCatalogRepository } from "@/lib/api/catalog/catalog.repository";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const catalog = getCatalogRepository();
  const categories = catalogData(await catalog.getAdminCategories(), []);
  const category = categories.find((item) => item.id === id);

  if (!category) notFound();

  return <CategoryEditPage categories={categories} category={category} />;
}
