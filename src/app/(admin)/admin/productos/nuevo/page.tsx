import { ProductCreateFormPage } from "@/components/admin/products-flow/ProductCreateFormPage";
import { getAdminProductCategories } from "@/lib/data/admin/sales-flow/mock-products";

export default async function NewProductPage() {
  const categories = await getAdminProductCategories();

  return <ProductCreateFormPage categories={categories} />;
}
