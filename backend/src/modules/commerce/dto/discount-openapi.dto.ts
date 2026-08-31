import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CouponHistoryDto {
  @ApiProperty({ enum: ["created", "activated", "deactivated", "updated"] })
  action!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  userName!: string;
}

export class CouponRequestDto {
  @ApiProperty()
  canCombineWithPromotions!: boolean;

  @ApiProperty({ type: [String] })
  categoryIds!: string[];

  @ApiProperty()
  code!: string;

  @ApiProperty({ enum: ["unlimited", "limited", "first_purchase"] })
  customerLimitType!: string;

  @ApiPropertyOptional()
  customerUsageLimit?: number;

  @ApiProperty({ enum: ["unlimited", "period"] })
  dateLimitType!: string;

  @ApiProperty({ enum: ["percentage", "fixed", "free_shipping"] })
  discountType!: string;

  @ApiPropertyOptional()
  discountValue?: number;

  @ApiPropertyOptional({ format: "date" })
  endDate?: string;

  @ApiProperty()
  includeShippingCost!: boolean;

  @ApiPropertyOptional()
  maxDiscountAmount?: number;

  @ApiProperty({ enum: ["none", "amount"] })
  maxDiscountType!: string;

  @ApiProperty()
  minimumCartAmount!: number;

  @ApiProperty({ type: [String] })
  productIds!: string[];

  @ApiPropertyOptional({ format: "date" })
  startDate?: string;

  @ApiProperty({ enum: ["active", "inactive"], required: false, default: "active" })
  status!: string;

  @ApiProperty({ enum: ["all_store", "categories", "products"] })
  targetType!: string;

  @ApiPropertyOptional()
  totalUsageLimit?: number;

  @ApiProperty({ enum: ["unlimited", "limited"] })
  totalUsageLimitType!: string;
}

export class CouponDto {
  @ApiProperty()
  canCombineWithPromotions!: boolean;

  @ApiProperty({ type: [String] })
  categoryIds!: string[];

  @ApiProperty()
  code!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ enum: ["unlimited", "limited", "first_purchase"] })
  customerLimitType!: string;

  @ApiPropertyOptional()
  customerUsageLimit?: number;

  @ApiProperty({ enum: ["unlimited", "period"] })
  dateLimitType!: string;

  @ApiProperty({ enum: ["percentage", "fixed", "free_shipping"] })
  discountType!: string;

  @ApiPropertyOptional()
  discountValue?: number;

  @ApiPropertyOptional({ format: "date" })
  endDate?: string;

  @ApiProperty({ type: [CouponHistoryDto] })
  history!: CouponHistoryDto[];

  @ApiProperty()
  id!: string;

  @ApiProperty()
  includeShippingCost!: boolean;

  @ApiPropertyOptional()
  maxDiscountAmount?: number;

  @ApiProperty({ enum: ["none", "amount"] })
  maxDiscountType!: string;

  @ApiProperty()
  minimumCartAmount!: number;

  @ApiProperty({ type: [String] })
  productIds!: string[];

  @ApiPropertyOptional({ format: "date" })
  startDate?: string;

  @ApiProperty({ enum: ["active", "inactive"] })
  status!: string;

  @ApiProperty({ enum: ["all_store", "categories", "products"] })
  targetType!: string;

  @ApiPropertyOptional()
  totalUsageLimit?: number;

  @ApiProperty({ enum: ["unlimited", "limited"] })
  totalUsageLimitType!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty()
  usageCount!: number;
}

export class ShippingDiscountRequestDto {
  @ApiProperty()
  canCombineWithPromotions!: boolean;

  @ApiProperty({ type: [String] })
  categoryIds!: string[];

  @ApiProperty()
  minimumCartAmount!: number;

  @ApiProperty()
  onlyCheapestShippingMethod!: boolean;

  @ApiProperty({ type: [String] })
  shippingMethodIds!: string[];

  @ApiProperty({ enum: ["active", "inactive"], required: false, default: "active" })
  status!: string;

  @ApiProperty({ enum: ["all_store", "categories"] })
  targetType!: string;

  @ApiProperty({ type: [String] })
  zoneIds!: string[];

  @ApiProperty({ enum: ["all", "specific"] })
  zoneTargetType!: string;
}

export class ShippingDiscountDto {
  @ApiProperty()
  canCombineWithPromotions!: boolean;

  @ApiProperty({ type: [String] })
  categoryIds!: string[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  minimumCartAmount!: number;

  @ApiProperty()
  onlyCheapestShippingMethod!: boolean;

  @ApiProperty({ type: [String] })
  shippingMethodIds!: string[];

  @ApiProperty({ enum: ["active", "inactive"] })
  status!: string;

  @ApiProperty({ enum: ["all_store", "categories"] })
  targetType!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: [String] })
  zoneIds!: string[];

  @ApiProperty({ enum: ["all", "specific"] })
  zoneTargetType!: string;
}
