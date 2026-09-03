export const CHECKOUT_CART_STATUS = {
  ABANDONED: "abandoned",
  ACTIVE: "active",
  COMPLETED: "completed",
} as const;

export type CheckoutCartStatus = (typeof CHECKOUT_CART_STATUS)[keyof typeof CHECKOUT_CART_STATUS];

export const CHECKOUT_SESSION_STATUS = {
  ABANDONED: "abandoned",
  ACTIVE: "active",
  COMPLETED: "completed",
} as const;

export type CheckoutSessionStatus = (typeof CHECKOUT_SESSION_STATUS)[keyof typeof CHECKOUT_SESSION_STATUS];

export const CHECKOUT_RECOVERY_STATUS = {
  MANUAL: "manual",
  PENDING: "pending",
  RECOVERED: "recovered",
  SENT: "sent",
} as const;

export type CheckoutRecoveryStatus = (typeof CHECKOUT_RECOVERY_STATUS)[keyof typeof CHECKOUT_RECOVERY_STATUS];

export const CHECKOUT_ORDER_STATUS = {
  CANCELLED: "cancelled",
  CONFIRMED: "confirmed",
  PENDING: "pending",
} as const;

export type CheckoutOrderStatus = (typeof CHECKOUT_ORDER_STATUS)[keyof typeof CHECKOUT_ORDER_STATUS];

export const CHECKOUT_PAYMENT_STATUS = {
  PAID: "paid",
  PENDING: "pending",
  REFUNDED: "refunded",
} as const;

export type CheckoutPaymentStatus = (typeof CHECKOUT_PAYMENT_STATUS)[keyof typeof CHECKOUT_PAYMENT_STATUS];

export const CHECKOUT_DELIVERY_TYPE = {
  PICKUP: "pickup",
  SHIPPING: "shipping",
} as const;

export type CheckoutDeliveryType = (typeof CHECKOUT_DELIVERY_TYPE)[keyof typeof CHECKOUT_DELIVERY_TYPE];

export const CHECKOUT_SHIPPING_MODALITY = {
  BRANCH_DELIVERY: "branch_delivery",
  HOME_DELIVERY: "home_delivery",
} as const;

export type CheckoutShippingModality = (typeof CHECKOUT_SHIPPING_MODALITY)[keyof typeof CHECKOUT_SHIPPING_MODALITY];

export const CHECKOUT_COUPON_RESULT = {
  APPLIED: "applied",
  NOT_PROVIDED: "not_provided",
  REJECTED: "rejected",
} as const;

export type CheckoutCouponResult = (typeof CHECKOUT_COUPON_RESULT)[keyof typeof CHECKOUT_COUPON_RESULT];

export const CHECKOUT_IDEMPOTENCY_STATUS = {
  COMPLETED: "completed",
  FAILED: "failed",
  PENDING: "pending",
} as const;

export type CheckoutIdempotencyStatus = (typeof CHECKOUT_IDEMPOTENCY_STATUS)[keyof typeof CHECKOUT_IDEMPOTENCY_STATUS];

export const CHECKOUT_PAYMENT_METHOD = {
  BANK_TRANSFER: "bank-transfer",
  MERCADO_PAGO: "mercado-pago",
  STRIPE: "stripe",
} as const;

export type CheckoutPaymentMethodId = (typeof CHECKOUT_PAYMENT_METHOD)[keyof typeof CHECKOUT_PAYMENT_METHOD];

export const CHECKOUT_PAYMENT_METHOD_IDS = [
  CHECKOUT_PAYMENT_METHOD.BANK_TRANSFER,
  CHECKOUT_PAYMENT_METHOD.MERCADO_PAGO,
  CHECKOUT_PAYMENT_METHOD.STRIPE,
] as const;

export const CHECKOUT_CURRENCY = "ARS" as const;
export const CHECKOUT_MAX_ITEMS = 100;
export const CHECKOUT_MAX_QUANTITY = 1_000;
export const CHECKOUT_IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const CHECKOUT_IDEMPOTENCY_KEY_MAX_LENGTH = 128;
export const CHECKOUT_QUOTE_TTL_SECONDS = 900;

export function isCheckoutPaymentMethodId(value: string): value is CheckoutPaymentMethodId {
  return CHECKOUT_PAYMENT_METHOD_IDS.some((candidate) => candidate === value);
}
