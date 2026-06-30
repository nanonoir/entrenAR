import type { Coupon, DiscountSelectOption, ShippingDiscount } from "@/lib/data/admin/discounts/types";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  currency: "ARS",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value).replace("ARS", "$").trim();
}

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatTime(value: string) {
  return timeFormatter.format(new Date(value));
}

export function getCouponDiscountLabel(coupon: Coupon) {
  if (coupon.discountType === "free_shipping") return "Envío gratis";
  if (coupon.discountType === "percentage") return `${coupon.discountValue ?? 0} %`;
  return formatCurrency(coupon.discountValue ?? 0);
}

export function getCouponValidityLabel(coupon: Coupon) {
  if (coupon.dateLimitType === "unlimited") return "Indeterminada";
  return `${coupon.startDate ?? "--"} / ${coupon.endDate ?? "--"}`;
}

export function getCouponUsageLabel(coupon: Coupon) {
  if (coupon.totalUsageLimitType === "unlimited") return `${coupon.usageCount} usos`;
  return `${coupon.usageCount} de ${coupon.totalUsageLimit ?? 0}`;
}

export function getCouponLimitsLabel(coupon: Coupon) {
  let count = 0;
  if (coupon.totalUsageLimitType === "limited") count += 1;
  if (coupon.customerLimitType !== "unlimited") count += 1;
  if (coupon.dateLimitType === "period") count += 1;
  if (coupon.minimumCartAmount > 0) count += 1;
  if (coupon.maxDiscountType === "amount") count += 1;
  if (count === 0) return "Sin límites";
  return `${count} ${count === 1 ? "límite" : "límites"}`;
}

export function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function getSelectedOptionLabels(ids: string[], options: DiscountSelectOption[]) {
  return ids.map((id) => options.find((option) => option.id === id)?.label).filter((label): label is string => Boolean(label));
}

export function getShippingMethodsLabel(discount: ShippingDiscount, options: DiscountSelectOption[]) {
  const labels = getSelectedOptionLabels(discount.shippingMethodIds, options);
  if (labels.length === 0) return "Sin medios";
  if (labels.length === 1) return labels[0];
  return `${labels[0]} +${labels.length - 1}`;
}

export function getShippingCategoriesLabel(discount: ShippingDiscount, options: DiscountSelectOption[]) {
  if (discount.targetType === "all_store") return "Toda la tienda";
  const labels = getSelectedOptionLabels(discount.categoryIds, options);
  if (labels.length === 0) return "Sin categorías";
  if (labels.length === 1) return labels[0];
  return `${labels[0]} +${labels.length - 1}`;
}

export function getShippingZonesLabel(discount: ShippingDiscount, options: DiscountSelectOption[]) {
  if (discount.zoneTargetType === "all") return "Todas las zonas";
  const labels = getSelectedOptionLabels(discount.zoneIds, options);
  if (labels.length === 0) return "Sin zonas";
  if (labels.length === 1) return labels[0];
  return `${labels[0]} +${labels.length - 1}`;
}
