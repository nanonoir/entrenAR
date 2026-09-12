"use client";

import { useEffect, useState } from "react";
import { CouponFormPageClient } from "./CouponFormPageClient";
import { ShippingDiscountFormPageClient } from "./ShippingDiscountFormPageClient";
import { ShippingDiscountsPageClient } from "./ShippingDiscountsPageClient";
import { getDiscountCategoryOptions, getDiscountProductOptions, getDiscountShippingMethodOptions, getDiscountZoneOptions } from "@/lib/data/admin/discounts/options";
import type { DiscountSelectOption } from "@/types/discount";

type Props = { mode: "coupon" | "shipping" | "shipping-list"; id?: string };

export function AdminDiscountOptionsBoundary({ mode, id }: Props) {
  const [options, setOptions] = useState<{ categories: DiscountSelectOption[]; products: DiscountSelectOption[]; methods: DiscountSelectOption[]; zones: DiscountSelectOption[] } | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([getDiscountCategoryOptions(), getDiscountProductOptions(), getDiscountShippingMethodOptions(), getDiscountZoneOptions()]).then(([categories, products, methods, zones]) => {
      if (active) setOptions({ categories, products, methods, zones });
    });
    return () => { active = false; };
  }, []);
  if (!options) return <div className="min-h-64" aria-busy="true" />;
  if (mode === "coupon") return <CouponFormPageClient mode={id ? "edit" : "create"} {...(id ? { couponId: id } : {})} categoryOptions={options.categories} productOptions={options.products} />;
  if (mode === "shipping-list") return <ShippingDiscountsPageClient categoryOptions={options.categories} shippingMethodOptions={options.methods} zoneOptions={options.zones} />;
  return <ShippingDiscountFormPageClient mode={id ? "edit" : "create"} {...(id ? { shippingDiscountId: id } : {})} categoryOptions={options.categories} shippingMethodOptions={options.methods} zoneOptions={options.zones} />;
}
