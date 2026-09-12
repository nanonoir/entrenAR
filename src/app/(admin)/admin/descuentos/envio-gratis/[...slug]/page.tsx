import { AdminDiscountOptionsBoundary } from "@/components/admin/discounts/AdminDiscountOptionsBoundary";

type ShippingDiscountRoutePageProps = {
  params: Promise<{ slug: string[] }>;
};

export default async function ShippingDiscountRoutePage({ params }: ShippingDiscountRoutePageProps) {
  const { slug } = await params;
  const [firstSegment] = slug;
  if (slug.length !== 1) return null;
  return <AdminDiscountOptionsBoundary mode="shipping" {...(firstSegment === "nuevo" ? {} : { id: firstSegment })} />;
}
