import { CategoriesManagementPage } from "@/components/admin/products-flow/categories/CategoriesManagementPage";
import { catalogData, getCatalogRepository } from "@/lib/api/catalog/catalog.repository";

export default async function ProductCategoriesPage() {
  const categories = catalogData(await getCatalogRepository().getAdminCategories(), []);

  return <CategoriesManagementPage categories={categories} />;
}
