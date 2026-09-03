import { DATA_SOURCE, getCheckoutDataSource, type DataSource } from "@/lib/api/config";
import { CheckoutApiRepository } from "@/lib/api/checkout/api-checkout.repository";
import { MockCheckoutRepository } from "@/lib/api/checkout/mock-checkout.repository";

export const CHECKOUT_CURRENCY = "ARS" as const;

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

export const CHECKOUT_ORDER_STATUS = {
  CANCELLED: "cancelled",
  CONFIRMED: "confirmed",
  PENDING: "pending",
} as const;

export type CheckoutOrderStatus = (typeof CHECKOUT_ORDER_STATUS)[keyof typeof CHECKOUT_ORDER_STATUS];

export const CHECKOUT_COUPON_RESULT = {
  APPLIED: "applied",
  NOT_PROVIDED: "not_provided",
  REJECTED: "rejected",
} as const;

export type CheckoutCouponResultStatus = (typeof CHECKOUT_COUPON_RESULT)[keyof typeof CHECKOUT_COUPON_RESULT];

export interface CheckoutLineItemInput {
  productId: string;
  quantity: number;
  variantId?: string;
}

export type CheckoutCartItemInput = CheckoutLineItemInput;
export type CheckoutLineItem = CheckoutLineItemInput;

export interface CheckoutAddressInput {
  city: string;
  postalCode: string;
  province: string;
  street: string;
  label?: string;
  number?: string;
  phone?: string;
  recipient?: string;
}

export interface CheckoutCustomerInput {
  email: string;
  firstName: string;
  lastName: string;
  dni?: string;
  phone?: string;
}

export interface CheckoutQuoteInput {
  items: readonly CheckoutLineItemInput[];
  address?: CheckoutAddressInput;
  addressId?: string;
  city?: string;
  couponCode?: string;
  deliveryType?: CheckoutDeliveryType;
  pickupPointId?: string;
  postalCode?: string;
  province?: string;
  sessionToken?: string;
  shippingMethodId?: string;
  shippingProviderId?: string;
}

export interface CheckoutCompleteInput extends CheckoutQuoteInput {
  customer: CheckoutCustomerInput;
  idempotencyKey: string;
  paymentMethodId: CheckoutPaymentMethodId;
  paymentOptionId?: string;
  quoteId?: string;
}

export type CheckoutQuoteRequest = CheckoutQuoteInput;
export type CheckoutCompleteRequest = CheckoutCompleteInput;

export interface CheckoutQuoteItem {
  lineSubtotal: number;
  productId: string;
  productName: string;
  quantity: number;
  sku: string;
  unitPrice: number;
  availableQuantity?: number | null;
  compareAtPrice?: number;
  variantId?: string;
  variantName?: string;
  weightGrams?: number | null;
}

export interface CheckoutShippingOption {
  cost: number;
  id: string;
  label: string;
  modality: CheckoutShippingModality;
  providerId: string;
  providerName: string;
  estimatedDelivery?: string;
}

export interface CheckoutPickupPoint {
  address: CheckoutAddressInput;
  id: string;
  name: string;
  preparationHours: number;
}

export interface CheckoutPaymentOption {
  fee: string;
  id: string;
  receiveIn: string;
  salesIn: string;
}

export interface CheckoutBankTransferConfig {
  alias: string;
  bankName: string;
  cbuCvu: string;
  cuitCuil: string;
  holderName: string;
}

export interface CheckoutPaymentMethod {
  acceptedMethods: string[];
  description: string;
  id: CheckoutPaymentMethodId;
  logoSrc: string;
  name: string;
  options: CheckoutPaymentOption[];
  bankConfig?: CheckoutBankTransferConfig;
  selectedOptionId?: string;
}

export interface CheckoutCouponResult {
  discountAmount: number;
  result: CheckoutCouponResultStatus;
  code?: string;
  message?: string;
}

export interface CheckoutWarning {
  code: string;
  message: string;
}

export interface CheckoutQuote {
  currency: typeof CHECKOUT_CURRENCY;
  discount: number;
  items: CheckoutQuoteItem[];
  paymentMethods: CheckoutPaymentMethod[];
  pickupPoints: CheckoutPickupPoint[];
  quoteId: string;
  shipping: number;
  shippingOptions: CheckoutShippingOption[];
  subtotal: number;
  total: number;
  warnings: CheckoutWarning[];
  ok: true;
  coupon?: CheckoutCouponResult | null;
  expiresAt?: string;
  sessionToken?: string;
}

export interface CheckoutOrderProjection {
  currency: typeof CHECKOUT_CURRENCY;
  id: string;
  number: string;
  status: CheckoutOrderStatus;
  total: number;
}

export interface CheckoutCompletion {
  number: string;
  ok: true;
  orderId: string;
  currency?: typeof CHECKOUT_CURRENCY;
  order?: CheckoutOrderProjection;
  status?: CheckoutOrderStatus;
  total?: number;
}

export type CheckoutQuoteResponse = CheckoutQuote;
export type CheckoutCompleteResponse = CheckoutCompletion;

export interface CheckoutApiIssue {
  code: string;
  field: string;
  message: string;
}

export interface CheckoutOperationError {
  ok: false;
  code: string;
  message: string;
  issues?: readonly CheckoutApiIssue[];
  status?: number;
}

export interface CheckoutRepository {
  readonly source: DataSource;

  quote(input: CheckoutQuoteInput): Promise<CheckoutQuote>;
  complete(input: CheckoutCompleteInput): Promise<CheckoutCompletion>;
}

export function reconcileCheckoutCartItems(
  items: readonly CheckoutCartItemInput[],
): CheckoutLineItemInput[] {
  const reconciled = new Map<string, CheckoutLineItemInput>();

  for (const item of items) {
    const variantId = item.variantId?.trim() || undefined;
    const key = `${item.productId.trim()}:${variantId ?? ""}`;
    const current = reconciled.get(key);

    if (current) {
      current.quantity += item.quantity;
      continue;
    }

    reconciled.set(key, {
      productId: item.productId.trim(),
      quantity: item.quantity,
      ...(variantId ? { variantId } : {}),
    });
  }

  return [...reconciled.values()];
}

const mockCheckoutRepository = new MockCheckoutRepository();
const apiCheckoutRepository = new CheckoutApiRepository();

export function getCheckoutRepository(source = getCheckoutDataSource()): CheckoutRepository {
  return source === DATA_SOURCE.API ? apiCheckoutRepository : mockCheckoutRepository;
}

export { DATA_SOURCE };
export type { DataSource };
