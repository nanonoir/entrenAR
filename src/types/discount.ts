export const DISCOUNT_STATUS = { ACTIVE: "active", INACTIVE: "inactive" } as const;
export type DiscountStatus = (typeof DISCOUNT_STATUS)[keyof typeof DISCOUNT_STATUS];

export const COUPON_DISCOUNT_TYPE = { PERCENTAGE: "percentage", FIXED: "fixed", FREE_SHIPPING: "free_shipping" } as const;
export type CouponDiscountType = (typeof COUPON_DISCOUNT_TYPE)[keyof typeof COUPON_DISCOUNT_TYPE];

export const COUPON_TARGET_TYPE = { ALL_STORE: "all_store", CATEGORIES: "categories", PRODUCTS: "products" } as const;
export type CouponTargetType = (typeof COUPON_TARGET_TYPE)[keyof typeof COUPON_TARGET_TYPE];

export const COUPON_DATE_LIMIT_TYPE = { UNLIMITED: "unlimited", PERIOD: "period" } as const;
export type CouponDateLimitType = (typeof COUPON_DATE_LIMIT_TYPE)[keyof typeof COUPON_DATE_LIMIT_TYPE];

export const COUPON_USAGE_LIMIT_TYPE = { UNLIMITED: "unlimited", LIMITED: "limited" } as const;
export type CouponUsageLimitType = (typeof COUPON_USAGE_LIMIT_TYPE)[keyof typeof COUPON_USAGE_LIMIT_TYPE];

export const COUPON_CUSTOMER_LIMIT_TYPE = { UNLIMITED: "unlimited", LIMITED: "limited", FIRST_PURCHASE: "first_purchase" } as const;
export type CouponCustomerLimitType = (typeof COUPON_CUSTOMER_LIMIT_TYPE)[keyof typeof COUPON_CUSTOMER_LIMIT_TYPE];

export const COUPON_MAX_DISCOUNT_TYPE = { NONE: "none", AMOUNT: "amount" } as const;
export type CouponMaxDiscountType = (typeof COUPON_MAX_DISCOUNT_TYPE)[keyof typeof COUPON_MAX_DISCOUNT_TYPE];

export const COUPON_HISTORY_ACTION = { CREATED: "created", ACTIVATED: "activated", DEACTIVATED: "deactivated", UPDATED: "updated" } as const;
export type CouponHistoryAction = (typeof COUPON_HISTORY_ACTION)[keyof typeof COUPON_HISTORY_ACTION];

export interface CouponHistoryItem {
  id: string;
  action: CouponHistoryAction;
  label: string;
  userName: string;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue?: number;
  includeShippingCost: boolean;
  targetType: CouponTargetType;
  categoryIds: string[];
  productIds: string[];
  canCombineWithPromotions: boolean;
  totalUsageLimitType: CouponUsageLimitType;
  totalUsageLimit?: number;
  usageCount: number;
  customerLimitType: CouponCustomerLimitType;
  customerUsageLimit?: number;
  dateLimitType: CouponDateLimitType;
  startDate?: string;
  endDate?: string;
  minimumCartAmount: number;
  maxDiscountType: CouponMaxDiscountType;
  maxDiscountAmount?: number;
  status: DiscountStatus;
  createdAt: string;
  updatedAt: string;
  history: CouponHistoryItem[];
}

export const SHIPPING_DISCOUNT_TARGET_TYPE = { ALL_STORE: "all_store", CATEGORIES: "categories" } as const;
export type ShippingDiscountTargetType = (typeof SHIPPING_DISCOUNT_TARGET_TYPE)[keyof typeof SHIPPING_DISCOUNT_TARGET_TYPE];

export const SHIPPING_ZONE_TARGET_TYPE = { ALL: "all", SPECIFIC: "specific" } as const;
export type ShippingZoneTargetType = (typeof SHIPPING_ZONE_TARGET_TYPE)[keyof typeof SHIPPING_ZONE_TARGET_TYPE];

export interface ShippingDiscount {
  id: string;
  shippingMethodIds: string[];
  onlyCheapestShippingMethod: boolean;
  targetType: ShippingDiscountTargetType;
  categoryIds: string[];
  canCombineWithPromotions: boolean;
  zoneTargetType: ShippingZoneTargetType;
  zoneIds: string[];
  minimumCartAmount: number;
  status: DiscountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountSelectOption {
  id: string;
  label: string;
  description?: string;
}
