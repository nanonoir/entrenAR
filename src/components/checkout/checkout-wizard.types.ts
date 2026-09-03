export const CHECKOUT_STEP = {
  DELIVERY: "delivery",
  IDENTIFICATION: "identification",
  PAYMENT: "payment",
} as const;

export type CheckoutStep = (typeof CHECKOUT_STEP)[keyof typeof CHECKOUT_STEP];

export const checkoutStepOrder: CheckoutStep[] = [
  CHECKOUT_STEP.IDENTIFICATION,
  CHECKOUT_STEP.DELIVERY,
  CHECKOUT_STEP.PAYMENT,
];
