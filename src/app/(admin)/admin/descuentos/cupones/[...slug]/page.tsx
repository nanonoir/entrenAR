import { AdminDiscountOptionsBoundary } from "@/components/admin/discounts/AdminDiscountOptionsBoundary";

type CouponRoutePageProps = {
  params: Promise<{ slug: string[] }>;
};

export default async function CouponRoutePage({ params }: CouponRoutePageProps) {
  const { slug } = await params;
  const [firstSegment] = slug;
  if (slug.length !== 1) return null;
  return <AdminDiscountOptionsBoundary mode="coupon" {...(firstSegment === "nuevo" ? {} : { id: firstSegment })} />;
}
