// Admin-specific DTO types — independent from customer-facing order types.

export type SalePaymentStatus = "pending" | "received" | "cancelled" | "refunded";
export type SaleShippingStatus = "to_pack" | "to_ship" | "shipped" | "delivered" | "pickup" | "cancelled";
export type PurchaseOrderStatus = "pending" | "converted" | "cancelled";

export type DiscountType = "percentage" | "fixed";

export type SaleHistoryEventType =
  | "sale_created"
  | "sale_updated"
  | "sale_cancelled"
  | "sale_reopened"
  | "sale_archived"
  | "payment_received"
  | "package_packed"
  | "package_unpacked"
  | "package_shipped"
  | "email_sent"
  | "email_failed"
  | "stock_reserved"
  | "stock_deducted"
  | "stock_restored"
  | "shipping_address_updated"
  | "order_converted";

export type SaleHistoryEvent = {
  id: string;
  type: SaleHistoryEventType;
  date: string; // ISO 8601
  actor: string;
  note?: string;
};

export type SaleCustomer = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dniOrCuil?: string;
};

export type SaleAddress = {
  street: string;
  number: string;
  floor?: string;
  unit?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  notes?: string;
};

export type SaleProduct = {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type AdminSale = {
  id: string; // e.g. "101"
  number: string; // e.g. "#101"
  customerId?: string;
  createdAt: string; // ISO 8601
  source?: string;
  customer: SaleCustomer;
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
};

export type AdminPurchaseOrder = {
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
};

export type AbandonedCartRecoveryStatus = "pending" | "sent" | "manual" | "recovered";

export type AbandonedCart = {
  id: string;
  abandonedAt: string; // ISO 8601
  customer: SaleCustomer;
  products: SaleProduct[];
  total: number;
  recoveryStatus: AbandonedCartRecoveryStatus;
  lastEmailSentAt?: string;
};

export type RecoveryTiming = "6hs" | "24hs" | "3_days" | "7_days" | "14_days" | "manual";

export type RecoveryConfig = {
  timing: RecoveryTiming;
  isActive: boolean;
};

export type RecoveryEmailTemplate = {
  subject: string;
  htmlBody: string;
  plainTextBody: string;
};
