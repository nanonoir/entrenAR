import { ProductCreateFormPage } from "@/components/admin/products-flow/ProductCreateFormPage";
import { catalogData, getCatalogRepository } from "@/lib/api/catalog/catalog.repository";

export default async function NewProductPage() {
  const categories = catalogData(await getCatalogRepository().getAdminCategories(), []);

  return <ProductCreateFormPage categories={categories} />;
}
