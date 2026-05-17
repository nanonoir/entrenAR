export const FREE_SHIPPING_THRESHOLD = 75000;

export function hasFreeShipping(total: number) {
  return total >= FREE_SHIPPING_THRESHOLD;
}

export function getFreeShippingRemaining(total: number) {
  return Math.max(0, FREE_SHIPPING_THRESHOLD - total);
}

export function getFreeShippingProgress(total: number) {
  return Math.min(100, (total / FREE_SHIPPING_THRESHOLD) * 100);
}
