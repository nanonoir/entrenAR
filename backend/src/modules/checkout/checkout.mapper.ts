import type { Prisma } from "../../generated/prisma/client";
import { OrderStatus } from "../../generated/prisma/enums";

import {
  CHECKOUT_CURRENCY,
  CHECKOUT_ORDER_STATUS,
  type CheckoutCouponResult,
  type CheckoutOrderStatus,
  type CheckoutPaymentMethodId,
  type CheckoutShippingModality,
} from "./checkout.constants";
import type {
  CheckoutCompleteResponse,
  CheckoutQuoteResponse,
} from "./checkout.schemas";

export const checkoutOrderSelect = {
  currency: true,
  id: true,
  number: true,
  status: true,
  total: true,
} satisfies Prisma.OrderSelect;

export type CheckoutOrderRecord = Prisma.OrderGetPayload<{ select: typeof checkoutOrderSelect }>;

export interface CheckoutQuoteItemProjection {
  availableQuantity?: number | null;
  compareAtPrice?: number;
  lineSubtotal: number;
  productId: string;
  productName: string;
  quantity: number;
  sku: string;
  unitPrice: number;
  variantId?: string;
  variantName?: string;
  weightGrams?: number | null;
}

export interface CheckoutShippingOptionProjection {
  cost: number;
  estimatedDelivery?: string;
  id: string;
  label: string;
  modality: CheckoutShippingModality;
  providerId: string;
  providerName: string;
}

export interface CheckoutPickupAddressProjection {
  city: string;
  label?: string;
  number?: string;
  phone?: string;
  postalCode: string;
  province: string;
  recipient?: string;
  street: string;
}

export interface CheckoutPickupPointProjection {
  address: CheckoutPickupAddressProjection;
  id: string;
  name: string;
  preparationHours: number;
}

export interface CheckoutPaymentOptionProjection {
  fee: string;
  id: string;
  receiveIn: string;
  salesIn: string;
}

export interface CheckoutBankTransferProjection {
  alias: string;
  bankName: string;
  cbuCvu: string;
  cuitCuil: string;
  holderName: string;
}

export interface CheckoutPaymentMethodProjection {
  acceptedMethods: string[];
  bankConfig?: CheckoutBankTransferProjection;
  description: string;
  id: CheckoutPaymentMethodId;
  logoSrc: string;
  name: string;
  options: CheckoutPaymentOptionProjection[];
  selectedOptionId?: string;
}

export interface CheckoutCouponResultProjection {
  code?: string;
  discountAmount: number;
  message?: string;
  result: CheckoutCouponResult;
}

export interface CheckoutWarningProjection {
  code: string;
  message: string;
}

export interface CheckoutQuoteProjection {
  coupon?: CheckoutCouponResultProjection | null;
  currency: typeof CHECKOUT_CURRENCY;
  discount: number;
  expiresAt?: string;
  items: CheckoutQuoteItemProjection[];
  paymentMethods: CheckoutPaymentMethodProjection[];
  pickupPoints: CheckoutPickupPointProjection[];
  quoteId: string;
  sessionToken?: string;
  shipping: number;
  shippingOptions: CheckoutShippingOptionProjection[];
  subtotal: number;
  total: number;
  warnings: CheckoutWarningProjection[];
}

export interface CheckoutOrderProjection {
  currency: typeof CHECKOUT_CURRENCY;
  id: string;
  number: string;
  status: CheckoutOrderStatus;
  total: number;
}

export interface CheckoutCompleteProjection {
  currency: typeof CHECKOUT_CURRENCY;
  number: string;
  orderId: string;
  status: CheckoutOrderStatus;
  total: number;
}

export function toCheckoutQuoteResponse(quote: CheckoutQuoteProjection): CheckoutQuoteResponse {
  return {
    ...quote,
    ok: true,
  };
}

export function toCheckoutOrderProjection(order: CheckoutOrderRecord): CheckoutOrderProjection {
  if (order.currency !== CHECKOUT_CURRENCY) {
    throw new Error("Checkout orders must use the configured checkout currency.");
  }

  return {
    currency: CHECKOUT_CURRENCY,
    id: order.id,
    number: order.number,
    status: toCheckoutOrderStatus(order.status),
    total: decimalToNumber(order.total),
  };
}

export function toCheckoutCompleteResponse(order: CheckoutOrderRecord): CheckoutCompleteResponse {
  const projection = toCheckoutOrderProjection(order);

  return {
    currency: projection.currency,
    number: projection.number,
    ok: true,
    order: projection,
    orderId: projection.id,
    status: projection.status,
    total: projection.total,
  };
}

export const toCheckoutQuote = toCheckoutQuoteResponse;
export const toCheckoutOrder = toCheckoutOrderProjection;
export const toCheckoutComplete = toCheckoutCompleteResponse;

function toCheckoutOrderStatus(status: OrderStatus): CheckoutOrderStatus {
  if (status === OrderStatus.CONFIRMED) return CHECKOUT_ORDER_STATUS.CONFIRMED;
  if (status === OrderStatus.CANCELLED) return CHECKOUT_ORDER_STATUS.CANCELLED;
  return CHECKOUT_ORDER_STATUS.PENDING;
}

function decimalToNumber(value: { toString(): string } | number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error("Checkout money values must serialize to finite numbers.");
  return numberValue;
}
