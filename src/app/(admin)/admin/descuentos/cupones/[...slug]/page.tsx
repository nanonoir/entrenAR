import { notFound } from "next/navigation";
import { CouponFormPageClient } from "@/components/admin/discounts/CouponFormPageClient";
import { getDiscountCategoryOptions, getDiscountProductOptions } from "@/lib/data/admin/discounts/options";

type CouponRoutePageProps = {
  params: Promise<{ slug: string[] }>;
};

export default async function CouponRoutePage({ params }: CouponRoutePageProps) {
  const { slug } = await params;
  const [firstSegment] = slug;
  const [categoryOptions, productOptions] = await Promise.all([getDiscountCategoryOptions(), getDiscountProductOptions()]);

  if (slug.length !== 1) notFound();
  if (firstSegment === "nuevo") return <CouponFormPageClient mode="create" categoryOptions={categoryOptions} productOptions={productOptions} />;
  return <CouponFormPageClient mode="edit" couponId={firstSegment} categoryOptions={categoryOptions} productOptions={productOptions} />;
}
