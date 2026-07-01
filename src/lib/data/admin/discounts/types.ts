export type DiscountStatus = "active" | "inactive";

export type CouponDiscountType = "percentage" | "fixed" | "free_shipping";
export type CouponTargetType = "all_store" | "categories" | "products";
export type CouponDateLimitType = "unlimited" | "period";
export type CouponUsageLimitType = "unlimited" | "limited";
export type CouponCustomerLimitType = "unlimited" | "limited" | "first_purchase";
export type CouponMaxDiscountType = "none" | "amount";

export type CouponHistoryAction = "created" | "activated" | "deactivated" | "updated";

export type CouponHistoryItem = {
  id: string;
  action: CouponHistoryAction;
  label: string;
  userName: string;
  createdAt: string;
};

export type Coupon = {
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
};

export type ShippingDiscountTargetType = "all_store" | "categories";
export type ShippingZoneTargetType = "all" | "specific";

export type ShippingDiscount = {
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
};

export type DiscountSelectOption = {
  id: string;
  label: string;
  description?: string;
};
