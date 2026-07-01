import { notFound } from "next/navigation";
import { ShippingDiscountFormPageClient } from "@/components/admin/discounts/ShippingDiscountFormPageClient";
import { getDiscountCategoryOptions, getDiscountShippingMethodOptions, getDiscountZoneOptions } from "@/lib/data/admin/discounts/options";

type ShippingDiscountRoutePageProps = {
  params: Promise<{ slug: string[] }>;
};

export default async function ShippingDiscountRoutePage({ params }: ShippingDiscountRoutePageProps) {
  const { slug } = await params;
  const [firstSegment] = slug;
  const [categoryOptions, shippingMethodOptions, zoneOptions] = await Promise.all([getDiscountCategoryOptions(), getDiscountShippingMethodOptions(), getDiscountZoneOptions()]);

  if (slug.length !== 1) notFound();
  if (firstSegment === "nuevo") return <ShippingDiscountFormPageClient mode="create" categoryOptions={categoryOptions} shippingMethodOptions={shippingMethodOptions} zoneOptions={zoneOptions} />;
  return <ShippingDiscountFormPageClient mode="edit" shippingDiscountId={firstSegment} categoryOptions={categoryOptions} shippingMethodOptions={shippingMethodOptions} zoneOptions={zoneOptions} />;
}
