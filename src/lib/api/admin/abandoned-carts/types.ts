export const ABANDONED_CARTS_DATA_SOURCE = {
  API: "api",
  MOCK: "mock",
} as const;

export type AbandonedCartsDataSource = (typeof ABANDONED_CARTS_DATA_SOURCE)[keyof typeof ABANDONED_CARTS_DATA_SOURCE];

export const RECOVERY_TIMING = {
  FOURTEEN_DAYS: "14_days",
  THREE_DAYS: "3_days",
  SIX_HOURS: "6hs",
  SEVEN_DAYS: "7_days",
  TWENTY_FOUR_HOURS: "24hs",
  MANUAL: "manual",
} as const;

export type RecoveryTiming = (typeof RECOVERY_TIMING)[keyof typeof RECOVERY_TIMING];

export const RECOVERY_STATUS = {
  DISCARDED: "DISCARDED",
  MANUAL: "MANUAL",
  PENDING: "PENDING",
  RECOVERED: "RECOVERED",
  SENT: "SENT",
} as const;

export type RecoveryStatus = (typeof RECOVERY_STATUS)[keyof typeof RECOVERY_STATUS];
export type AbandonedCartRecoveryStatus = RecoveryStatus;

export const ABANDONED_CART_SORT_BY = {
  ABANDONED_AT: "abandonedAt",
  CREATED_AT: "createdAt",
  CUSTOMER_NAME: "customerName",
  LAST_ACTIVITY_AT: "lastActivityAt",
  RECOVERY_STATUS: "recoveryStatus",
  TOTAL: "total",
  UPDATED_AT: "updatedAt",
} as const;

export type AbandonedCartSortBy = (typeof ABANDONED_CART_SORT_BY)[keyof typeof ABANDONED_CART_SORT_BY];

export const ABANDONED_CART_SORT_ORDER = {
  ASC: "asc",
  DESC: "desc",
} as const;

export type AbandonedCartSortOrder = (typeof ABANDONED_CART_SORT_ORDER)[keyof typeof ABANDONED_CART_SORT_ORDER];
export type SortOrder = AbandonedCartSortOrder;

export interface AbandonedCartCustomerSummary {
  dni?: string | null;
  email?: string | null;
  firstName: string;
  lastName: string;
  phone?: string | null;
}

export interface AbandonedCartProductSummary {
  lineSubtotal?: number;
  name: string;
  productId: string;
  quantity: number;
  sku?: string;
  unitPrice: number;
  variantId?: string;
  variantName?: string;
}

export interface AbandonedCartRecoveryLink {
  expiresAt: string;
  isExpired?: boolean;
  url: string;
}

export interface CheckoutSessionHistoryEvent {
  actorId?: string | null;
  actorRole?: string | null;
  createdAt: string;
  eventType: string;
  id: string;
  metadata?: Record<string, unknown>;
  notes?: string | null;
}

export type AbandonedCartTimelineEvent = CheckoutSessionHistoryEvent;

export interface AbandonedCartListItem {
  abandonedAt: string;
  customer: AbandonedCartCustomerSummary;
  id: string;
  lastEmailSentAt?: string | null;
  products: AbandonedCartProductSummary[];
  recoveryStatus: RecoveryStatus;
  total: number;
}

export type AbandonedCart = AbandonedCartListItem;

export interface AbandonedCartDetail extends AbandonedCartListItem {
  cartId: string;
  items: AbandonedCartProductSummary[];
  recoveryExpiresAt?: string | null;
  recoveryLink?: AbandonedCartRecoveryLink | null;
  timeline: CheckoutSessionHistoryEvent[];
}

export type AbandonedCartDetailResult = AbandonedCartDetail;

export interface AbandonedCartSummaryStats {
  discardedCount?: number;
  manualCount?: number;
  pendingCount: number;
  recoverableTotal: number;
  recoveredCount: number;
  sentCount?: number;
  totalCount?: number;
}

export interface AbandonedCartPagination {
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export interface AbandonedCartListResult {
  items: AbandonedCartListItem[];
  limit: number;
  page: number;
  summary: AbandonedCartSummaryStats;
  total: number;
  totalPages: number;
}

export interface RecoveryActionResult {
  cart: AbandonedCartListItem;
  orderId?: string;
  recoveryLink?: AbandonedCartRecoveryLink | null;
}

export interface RecoveryConfig {
  isActive: boolean;
  timing: RecoveryTiming;
}

export interface RecoveryEmailTemplate {
  htmlBody: string;
  plainTextBody: string;
  subject: string;
}

export interface AbandonedCartListQuery {
  from?: Date | string;
  limit?: number;
  maxTotal?: number;
  minTotal?: number;
  page?: number;
  search?: string;
  sortBy?: AbandonedCartSortBy;
  sortOrder?: AbandonedCartSortOrder;
  status?: RecoveryStatus;
  to?: Date | string;
}

export type ParsedAbandonedCartListQuery = Required<Pick<AbandonedCartListQuery, "limit" | "page" | "sortBy" | "sortOrder">> & AbandonedCartListQuery;
export type SendRecoveryEmailInput = { note?: string; subjectOverride?: string };
export type ManualRecoveryInput = { note?: string };
export type ConvertCartInput = { notes?: string };
export type DiscardCartInput = { reason: string };
export type AbandonedCartListItemResult = AbandonedCartListItem;
export type RecoveryConfigResult = RecoveryConfig;
export type RecoveryEmailTemplateResult = RecoveryEmailTemplate;

export interface AbandonedCartsApiIssue {
  code: string;
  field: string;
  message: string;
}
