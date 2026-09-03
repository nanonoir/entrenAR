import {
  bankTransferInstructions,
  checkoutPaymentMethods,
  checkoutPostalCodeLocations,
  checkoutShippingProviders,
} from "@/lib/data/checkout";
import { getAllProductDetails } from "@/lib/data/products";
import type {
  CheckoutAddressInput,
  CheckoutLineItemInput,
  CheckoutPaymentMethod,
  CheckoutPickupPoint,
  CheckoutQuote,
  CheckoutQuoteInput,
  CheckoutQuoteItem,
  CheckoutShippingOption,
} from "@/lib/api/checkout/checkout.repository";

import {
  couponNotValid,
  outOfStock,
  productNotFound,
  shippingUnavailable,
  variantNotFound,
} from "./mock-checkout.validation";

export {
  assertCompleteInput,
  assertMockPaymentSelection,
  assertQuoteInput,
  cloneCompletion,
  cloneQuote,
  idempotencyKeyReused,
  invalidSession,
  outOfStock,
  priceChanged,
  quoteFingerprint,
  reconcileCheckoutCartItems,
  shippingUnavailable,
  stableSerialize,
  toCompletionFingerprint,
  toQuoteItem,
} from "./mock-checkout.validation";

export const CHECKOUT_CURRENCY = "ARS" as const;

export const CHECKOUT_COUPON_RESULT = {
  APPLIED: "applied",
} as const;

export const CHECKOUT_DELIVERY_TYPE = {
  PICKUP: "pickup",
  SHIPPING: "shipping",
} as const;

export const CHECKOUT_ORDER_STATUS = {
  PENDING: "pending",
} as const;

export const CHECKOUT_PAYMENT_METHOD = {
  BANK_TRANSFER: "bank-transfer",
  MERCADO_PAGO: "mercado-pago",
  STRIPE: "stripe",
} as const;

export const CHECKOUT_SHIPPING_MODALITY = {
  BRANCH_DELIVERY: "branch_delivery",
  HOME_DELIVERY: "home_delivery",
} as const;

const MOCK_COUPON_CODES = {
  MOCK10: "MOCK10",
  WELCOME10: "WELCOME10",
} as const;

export const MOCK_ID_PREFIX = {
  ORDER: "mock-order",
  ORDER_NUMBER: "EN-MOCK",
  QUOTE: "mock-quote",
  SESSION: "mock-checkout-session",
} as const;

export type MockResolvedLine = {
  inventoryKey: string;
  quantity: number;
  unitPrice: number;
  variantId?: string;
};

let idSequence = 0;

export function createMockInventory(): Map<string, number> {
  const inventoryByKey = new Map<string, number>();

  for (const product of getAllProductDetails()) {
    if (product.variants.length === 0) {
      inventoryByKey.set(inventoryKey(product.id), product.stock);
      continue;
    }

    for (const variant of product.variants) {
      inventoryByKey.set(inventoryKey(product.id, variant.id), variant.stock);
    }
  }

  return inventoryByKey;
}

export function resolveMockLines(
  items: readonly CheckoutLineItemInput[],
  inventoryByKey: ReadonlyMap<string, number>,
): Array<CheckoutQuoteItem & MockResolvedLine> {
  return items.map((item) => {
    const product = getAllProductDetails().find((candidate) => candidate.id === item.productId);
    if (!product) throw productNotFound();

    const variant = item.variantId
      ? product.variants.find((candidate) => candidate.id === item.variantId)
      : product.variants[0];
    if (item.variantId && !variant) throw variantNotFound();

    const inventoryKeyValue = inventoryKey(product.id, variant?.id);
    const availableQuantity = inventoryByKey.get(inventoryKeyValue) ?? product.stock;
    if (item.quantity > availableQuantity) throw outOfStock();

    const unitPrice = variant?.price ?? product.price;
    const weightGrams = undefined;
    return {
      availableQuantity,
      inventoryKey: inventoryKeyValue,
      lineSubtotal: roundMoney(unitPrice * item.quantity),
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      sku: variant ? `${product.id}-${variant.id}` : product.id,
      unitPrice,
      ...(item.variantId || variant ? { variantId: variant?.id } : {}),
      ...(variant ? { variantName: variant.label } : {}),
      ...(variant?.compareAtPrice === undefined && product.compareAtPrice === undefined
        ? {}
        : { compareAtPrice: variant?.compareAtPrice ?? product.compareAtPrice }),
      ...(weightGrams === undefined ? {} : { weightGrams }),
    };
  });
}

export function mockPaymentMethods(): CheckoutPaymentMethod[] {
  return checkoutPaymentMethods.map((method) => ({
    acceptedMethods: [method.title],
    description: method.description,
    id: method.id,
    logoSrc: method.logoSrc,
    name: method.title,
    options: [mockPaymentOption(method.id)],
    ...(method.id === CHECKOUT_PAYMENT_METHOD.BANK_TRANSFER
      ? {
        bankConfig: {
          alias: bankTransferInstructions.alias,
          bankName: "EntrenAR Demo",
          cbuCvu: bankTransferInstructions.cbu,
          cuitCuil: "20-00000000-0",
          holderName: bankTransferInstructions.accountHolder,
        },
      }
      : {}),
    selectedOptionId: mockPaymentOption(method.id).id,
  }));
}

function mockPaymentOption(id: CheckoutPaymentMethod["id"]): CheckoutPaymentMethod["options"][number] {
  if (id === CHECKOUT_PAYMENT_METHOD.BANK_TRANSFER) {
    return { fee: "0%", id: "direct-transfer", receiveIn: "En el momento", salesIn: "En el momento" };
  }
  if (id === CHECKOUT_PAYMENT_METHOD.MERCADO_PAGO) {
    return { fee: "6.29%", id: "mp-instant", receiveIn: "En el momento", salesIn: "En el momento" };
  }
  return { fee: "2.9% + USD0.30", id: "stripe-eea-standard", receiveIn: "En el momento", salesIn: "En el momento" };
}

export function mockShippingOptions(): CheckoutShippingOption[] {
  return checkoutShippingProviders.map((provider, index) => ({
    cost: provider.price,
    estimatedDelivery: provider.eta,
    id: index === 0 ? "andreani:envío-a-domicilio" : "correo-argentino:retiro-en-sucursal",
    label: provider.name,
    modality: index === 0 ? CHECKOUT_SHIPPING_MODALITY.HOME_DELIVERY : CHECKOUT_SHIPPING_MODALITY.BRANCH_DELIVERY,
    providerId: index === 0 ? "andreani" : "correo-argentino",
    providerName: provider.name,
  }));
}

export function mockPickupPoints(input: CheckoutQuoteInput): CheckoutPickupPoint[] {
  return checkoutPostalCodeLocations
    .filter((location) => !input.postalCode || location.postalCode === input.postalCode)
    .filter((location) => !input.province || location.province === input.province)
    .flatMap((location) => location.pickupPoints.map((point) => ({
      address: pickupAddress(point.address, location.postalCode, location.province, location.cities[0] ?? location.province),
      id: point.id,
      name: point.name,
      preparationHours: preparationHours(point.eta),
    })));
}

export function resolveMockDelivery(
  input: CheckoutQuoteInput,
  shippingOptions: readonly CheckoutShippingOption[],
  pickupPoints: readonly CheckoutPickupPoint[],
): number {
  if (input.pickupPointId) {
    if (!pickupPoints.some((point) => point.id === input.pickupPointId)) throw shippingUnavailable();
    return 0;
  }

  if (!input.shippingMethodId && !input.shippingProviderId) return 0;
  const shippingMethodId = input.shippingMethodId;
  const selected = shippingMethodId
    ? shippingOptions.find((option) => option.id === normalizeShippingOptionId(shippingMethodId))
    : shippingOptions.find((option) => option.providerId === input.shippingProviderId);
  if (!selected) throw shippingUnavailable();
  return selected.cost;
}

export function mockCoupon(code: string | undefined, subtotal: number): CheckoutQuote["coupon"] {
  if (!code) return undefined;
  const normalized = code.trim().toLocaleUpperCase();
  if (normalized !== MOCK_COUPON_CODES.MOCK10 && normalized !== MOCK_COUPON_CODES.WELCOME10) throw couponNotValid();
  return {
    code: normalized,
    discountAmount: roundMoney(subtotal * 0.1),
    result: CHECKOUT_COUPON_RESULT.APPLIED,
  };
}

function pickupAddress(value: string, postalCode: string, province: string, city: string): CheckoutAddressInput {
  const match = /^(.*?)(?:\s+(\d+)),/.exec(value);
  return {
    city,
    number: match?.[2] ?? "0",
    postalCode,
    province,
    street: match?.[1] ?? value,
  };
}

function preparationHours(value: string): number {
  const match = /\d+/.exec(value);
  return match ? Number(match[0]) : 24;
}

export function createId(prefix: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++idSequence}`;
  return `${prefix}-${suffix}`;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function inventoryKey(productId: string, variantId?: string): string {
  return `${productId}:${variantId ?? ""}`;
}

export function sessionOwnerKey(sessionToken: string): string {
  return `session:${sessionToken}`;
}

function normalizeShippingOptionId(value: string): string {
  const normalized = value.trim().toLocaleLowerCase();
  const aliases: Record<string, string> = {
    "andreani-home": "andreani:envío-a-domicilio",
    "correo-argentino-branch": "correo-argentino:retiro-en-sucursal",
  };
  return aliases[normalized] ?? normalized;
}
