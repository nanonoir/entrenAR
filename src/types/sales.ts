// Admin-specific DTO types — independent from customer-facing order types.

export const SALE_PAYMENT_STATUS = { PENDING: "pending", RECEIVED: "received", CANCELLED: "cancelled", REFUNDED: "refunded" } as const;
export type SalePaymentStatus = (typeof SALE_PAYMENT_STATUS)[keyof typeof SALE_PAYMENT_STATUS];

export const SALE_SHIPPING_STATUS = { TO_PACK: "to_pack", TO_SHIP: "to_ship", SHIPPED: "shipped", DELIVERED: "delivered", PICKUP: "pickup", CANCELLED: "cancelled" } as const;
export type SaleShippingStatus = (typeof SALE_SHIPPING_STATUS)[keyof typeof SALE_SHIPPING_STATUS];

export const PURCHASE_ORDER_STATUS = { PENDING: "pending", CONVERTED: "converted", CANCELLED: "cancelled" } as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUS)[keyof typeof PURCHASE_ORDER_STATUS];

export const DISCOUNT_TYPE = { PERCENTAGE: "percentage", FIXED: "fixed" } as const;
export type DiscountType = (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE];

export const SALE_HISTORY_EVENT_TYPE = {
  SALE_CREATED: "sale_created",
  SALE_UPDATED: "sale_updated",
  SALE_CANCELLED: "sale_cancelled",
  SALE_REOPENED: "sale_reopened",
  SALE_ARCHIVED: "sale_archived",
  PAYMENT_RECEIVED: "payment_received",
  PACKAGE_PACKED: "package_packed",
  PACKAGE_UNPACKED: "package_unpacked",
  PACKAGE_SHIPPED: "package_shipped",
  EMAIL_SENT: "email_sent",
  EMAIL_FAILED: "email_failed",
  STOCK_RESERVED: "stock_reserved",
  STOCK_DEDUCTED: "stock_deducted",
  STOCK_RESTORED: "stock_restored",
  SHIPPING_ADDRESS_UPDATED: "shipping_address_updated",
  ORDER_CONVERTED: "order_converted",
} as const;
export type SaleHistoryEventType = (typeof SALE_HISTORY_EVENT_TYPE)[keyof typeof SALE_HISTORY_EVENT_TYPE];

export interface SaleHistoryEvent {
  id: string;
  type: SaleHistoryEventType;
  date: string; // ISO 8601
  actor: string;
  note?: string;
}

export interface SaleCustomer {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dniOrCuil?: string;
}

export interface SaleAddress {
  street: string;
  number: string;
  floor?: string;
  unit?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  notes?: string;
}

export interface SaleProduct {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface AdminSale {
  id: string; // e.g. "101"
  number: string; // e.g. "#101"
  customerId?: string;
  createdAt: string; // ISO 8601
  source?: string;
  customer: SaleCustomer;
  itemCount?: number;
  shippingAddress?: SaleAddress;
  products: SaleProduct[];
  paymentStatus: SalePaymentStatus;
  shippingStatus: SaleShippingStatus;
  subtotal: number;
  discountType?: DiscountType;
  discountValue?: number;
  shippingCost: number;
  total: number;
  archived: boolean;
  cancellationReason?: string;
  previousPaymentStatus?: SalePaymentStatus;
  previousShippingStatus?: SaleShippingStatus;
  notes?: string;
  history: SaleHistoryEvent[];
  sourceOrderId?: string; // set when converted from a purchase order
  trackingCode?: string;
}

export interface AdminPurchaseOrder {
  id: string; // e.g. "OC-2026-483921"
  createdAt: string; // ISO 8601
  source?: string;
  customer: SaleCustomer;
  shippingAddress?: SaleAddress;
  products: SaleProduct[];
  status: PurchaseOrderStatus;
  subtotal: number;
  discountType?: DiscountType;
  discountValue?: number;
  shippingCost: number;
  total: number;
  notes?: string;
  history: SaleHistoryEvent[];
  convertedSaleId?: string; // set after conversion
}

export const ABANDONED_CART_RECOVERY_STATUS = { PENDING: "pending", SENT: "sent", MANUAL: "manual", RECOVERED: "recovered" } as const;
export type AbandonedCartRecoveryStatus = (typeof ABANDONED_CART_RECOVERY_STATUS)[keyof typeof ABANDONED_CART_RECOVERY_STATUS];

export interface AbandonedCart {
  id: string;
  abandonedAt: string; // ISO 8601
  customer: SaleCustomer;
  products: SaleProduct[];
  total: number;
  recoveryStatus: AbandonedCartRecoveryStatus;
  lastEmailSentAt?: string;
}

export const RECOVERY_TIMING = { SIX_HOURS: "6hs", TWENTY_FOUR_HOURS: "24hs", THREE_DAYS: "3_days", SEVEN_DAYS: "7_days", FOURTEEN_DAYS: "14_days", MANUAL: "manual" } as const;
export type RecoveryTiming = (typeof RECOVERY_TIMING)[keyof typeof RECOVERY_TIMING];

export interface RecoveryConfig {
  timing: RecoveryTiming;
  isActive: boolean;
}

export interface RecoveryEmailTemplate {
  subject: string;
  htmlBody: string;
  plainTextBody: string;
}
