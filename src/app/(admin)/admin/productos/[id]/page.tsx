import { notFound } from "next/navigation";
import { ProductCreateFormPage } from "@/components/admin/products-flow/ProductCreateFormPage";
import { getAdminProductById, getAdminProductCategories } from "@/lib/data/admin/sales-flow/mock-products";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [categories, product] = await Promise.all([
    getAdminProductCategories(),
    getAdminProductById(id),
  ]);

  if (!product) notFound();

  return <ProductCreateFormPage categories={categories} mode="edit" product={product} />;
}
