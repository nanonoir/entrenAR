import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { CheckoutRecoveryStatus } from "../../../generated/prisma/enums";
import {
  ABANDONED_CART_SORT_BY,
  RECOVERY_TIMING,
  type AbandonedCartSortBy,
  type AbandonedCartSortOrder,
  type RecoveryTiming,
} from "../abandoned-carts.schemas";

export class AbandonedCartCustomerSummaryDto {
  @ApiPropertyOptional({ nullable: true })
  dni?: string | null;

  @ApiPropertyOptional({ format: "email", nullable: true })
  email?: string | null;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiPropertyOptional({ nullable: true })
  phone?: string | null;
}

export class AbandonedCartProductSummaryDto {
  @ApiPropertyOptional()
  lineSubtotal?: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  quantity!: number;

  @ApiPropertyOptional()
  sku?: string;

  @ApiProperty()
  unitPrice!: number;

  @ApiPropertyOptional()
  variantId?: string;

  @ApiPropertyOptional()
  variantName?: string;
}

export class AbandonedCartRecoveryLinkDto {
  @ApiProperty({ format: "date-time" })
  expiresAt!: string;

  @ApiPropertyOptional()
  isExpired?: boolean;

  @ApiProperty()
  url!: string;
}

export class AbandonedCartTimelineEventDto {
  @ApiPropertyOptional({ nullable: true })
  actorId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  actorRole?: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;
}

export class AbandonedCartItemSummaryDto {
  @ApiProperty({ format: "date-time" })
  abandonedAt!: string;

  @ApiProperty({ type: AbandonedCartCustomerSummaryDto })
  customer!: AbandonedCartCustomerSummaryDto;

  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  lastEmailSentAt?: string | null;

  @ApiProperty({ type: [AbandonedCartProductSummaryDto] })
  products!: AbandonedCartProductSummaryDto[];

  @ApiProperty({ enum: Object.values(CheckoutRecoveryStatus), enumName: "CheckoutRecoveryStatus" })
  recoveryStatus!: CheckoutRecoveryStatus;

  @ApiProperty()
  total!: number;
}

export class AbandonedCartSummaryStatsDto {
  @ApiPropertyOptional()
  discardedCount?: number;

  @ApiPropertyOptional()
  manualCount?: number;

  @ApiProperty()
  pendingCount!: number;

  @ApiProperty()
  recoverableTotal!: number;

  @ApiProperty()
  recoveredCount!: number;

  @ApiPropertyOptional()
  sentCount?: number;

  @ApiPropertyOptional()
  totalCount?: number;
}

export class AbandonedCartPaginationDto {
  @ApiPropertyOptional()
  hasNextPage?: boolean;

  @ApiPropertyOptional()
  hasPreviousPage?: boolean;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AbandonedCartListResponseDto {
  @ApiProperty({ type: [AbandonedCartItemSummaryDto] })
  items!: AbandonedCartItemSummaryDto[];

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty({ type: AbandonedCartSummaryStatsDto })
  summary!: AbandonedCartSummaryStatsDto;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AbandonedCartDetailResponseDto extends AbandonedCartItemSummaryDto {
  @ApiProperty()
  cartId!: string;

  @ApiProperty({ type: [AbandonedCartProductSummaryDto] })
  items!: AbandonedCartProductSummaryDto[];

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  recoveryExpiresAt?: string | null;

  @ApiPropertyOptional({ type: AbandonedCartRecoveryLinkDto, nullable: true })
  recoveryLink?: AbandonedCartRecoveryLinkDto | null;

  @ApiProperty({ type: [AbandonedCartTimelineEventDto] })
  timeline!: AbandonedCartTimelineEventDto[];
}

export class AbandonedCartActionResponseDto {
  @ApiProperty({ type: AbandonedCartItemSummaryDto })
  cart!: AbandonedCartItemSummaryDto;

  @ApiPropertyOptional()
  orderId?: string;

  @ApiPropertyOptional({ type: AbandonedCartRecoveryLinkDto, nullable: true })
  recoveryLink?: AbandonedCartRecoveryLinkDto | null;
}

export class AbandonedCartListQueryDto {
  @ApiPropertyOptional({ format: "date-time" })
  from?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  limit?: number;

  @ApiPropertyOptional({ minimum: 0 })
  maxTotal?: number;

  @ApiPropertyOptional({ minimum: 0 })
  minTotal?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  page?: number;

  @ApiPropertyOptional()
  search?: string;

  @ApiPropertyOptional({ enum: Object.values(ABANDONED_CART_SORT_BY), default: ABANDONED_CART_SORT_BY.ABANDONED_AT })
  sortBy?: AbandonedCartSortBy;

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  sortOrder?: AbandonedCartSortOrder;

  @ApiPropertyOptional({ enum: Object.values(CheckoutRecoveryStatus) })
  status?: CheckoutRecoveryStatus;

  @ApiPropertyOptional({ format: "date-time" })
  to?: string;
}

export class SendRecoveryEmailRequestDto {
  @ApiPropertyOptional()
  note?: string;

  @ApiPropertyOptional()
  subjectOverride?: string;
}

export class ManualRecoveryRequestDto {
  @ApiPropertyOptional()
  note?: string;
}

export class ConvertCartRequestDto {
  @ApiPropertyOptional()
  notes?: string;
}

export class DiscardCartRequestDto {
  @ApiProperty({ minLength: 3 })
  reason!: string;
}

export class UpdateRecoveryConfigRequestDto {
  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ enum: Object.values(RECOVERY_TIMING), enumName: "RecoveryTiming" })
  timing!: RecoveryTiming;
}

export class UpdateRecoveryTemplateRequestDto {
  @ApiProperty({ minLength: 1 })
  htmlBody!: string;

  @ApiProperty({ minLength: 1 })
  plainTextBody!: string;

  @ApiProperty({ minLength: 1 })
  subject!: string;
}

export class RecoveryConfigResponseDto extends UpdateRecoveryConfigRequestDto {}
export class RecoveryTemplateResponseDto extends UpdateRecoveryTemplateRequestDto {}

export { AbandonedCartItemSummaryDto as AbandonedCartResponseDto };
