import { ShippingDiscountsPageClient } from "@/components/admin/discounts/ShippingDiscountsPageClient";
import { getDiscountCategoryOptions, getDiscountShippingMethodOptions, getDiscountZoneOptions } from "@/lib/data/admin/discounts/options";

export default async function ShippingDiscountsPage() {
  const [categoryOptions, shippingMethodOptions, zoneOptions] = await Promise.all([getDiscountCategoryOptions(), getDiscountShippingMethodOptions(), getDiscountZoneOptions()]);
  return <ShippingDiscountsPageClient categoryOptions={categoryOptions} shippingMethodOptions={shippingMethodOptions} zoneOptions={zoneOptions} />;
}
