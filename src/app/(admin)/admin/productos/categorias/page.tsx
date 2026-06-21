import { CategoriesManagementPage } from "@/components/admin/products-flow/categories/CategoriesManagementPage";
import { getAdminProductCategories } from "@/lib/data/admin/sales-flow/mock-products";

export default async function ProductCategoriesPage() {
  const categories = await getAdminProductCategories();

  return <CategoriesManagementPage categories={categories} />;
}
