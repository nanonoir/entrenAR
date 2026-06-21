import { notFound } from "next/navigation";
import { CategoryEditPage } from "@/components/admin/products-flow/categories/CategoryEditPage";
import { getAdminProductCategories, getAdminProductCategoryById } from "@/lib/data/admin/sales-flow/mock-products";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [categories, category] = await Promise.all([
    getAdminProductCategories(),
    getAdminProductCategoryById(id),
  ]);

  if (!category) notFound();

  return <CategoryEditPage categories={categories} category={category} />;
}
