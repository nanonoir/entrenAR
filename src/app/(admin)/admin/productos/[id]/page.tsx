import { notFound } from "next/navigation";
import { ProductCreateFormPage } from "@/components/admin/products-flow/ProductCreateFormPage";
import { catalogData, getCatalogRepository } from "@/lib/api/catalog/catalog.repository";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const catalog = getCatalogRepository();
  const [categoriesResult, productResult] = await Promise.all([
    catalog.getAdminCategories(),
    catalog.getAdminProductById(id),
  ]);
  const categories = catalogData(categoriesResult, []);
  const product = catalogData(productResult, null);

  if (!product) notFound();

  return <ProductCreateFormPage categories={categories} mode="edit" product={product} />;
}
