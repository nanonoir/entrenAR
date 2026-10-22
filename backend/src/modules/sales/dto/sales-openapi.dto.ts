import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { OrderDeliveryType, OrderShippingStatus, OrderStatus, PaymentAttemptStatus, PaymentProvider, PaymentStatus, Role } from "../../../generated/prisma/enums";

export class AdminSaleCustomerResponseDto {
  @ApiProperty({ format: "email" }) email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiPropertyOptional() dni?: string;
  @ApiPropertyOptional() phone?: string;
}

export class AdminSaleItemResponseDto {
  @ApiProperty({ type: Object }) attributes!: Record<string, unknown>;
  @ApiPropertyOptional() compareAtPrice?: number;
  @ApiProperty() lineSubtotal!: number;
  @ApiPropertyOptional() name?: string;
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() sku!: string;
  @ApiProperty({ type: Object }) snapshot!: Record<string, unknown>;
  @ApiProperty() unitPrice!: number;
  @ApiPropertyOptional() variantId?: string;
  @ApiPropertyOptional() variantName?: string;
  @ApiPropertyOptional() weightGrams?: number;
}

export class CreateManualSaleItemRequestDto {
  @ApiProperty({ type: Object }) attributes!: Record<string, unknown>;
  @ApiPropertyOptional() compareAtPrice?: number;
  @ApiPropertyOptional() name?: string;
  @ApiProperty() productId!: string;
  @ApiPropertyOptional() productName?: string;
  @ApiProperty() quantity!: number;
  @ApiPropertyOptional() sku?: string;
  @ApiProperty({ type: Object }) snapshot!: Record<string, unknown>;
  @ApiProperty() unitPrice!: number;
  @ApiPropertyOptional() variantId?: string;
  @ApiPropertyOptional() variantName?: string;
  @ApiPropertyOptional() weightGrams?: number;
}

export class AdminSaleHistoryResponseDto {
  @ApiPropertyOptional() actorId?: string;
  @ApiPropertyOptional({ enum: Object.values(Role) }) actorRole?: Role;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ type: Object }) metadata?: unknown;
  @ApiProperty() title!: string;
  @ApiProperty() type!: string;
}

export class AdminSalePaymentAttemptResponseDto {
  @ApiProperty() attemptNumber!: number;
  @ApiPropertyOptional({ format: "date-time" }) challengeCreatedAt?: string;
  @ApiPropertyOptional({ format: "date-time" }) outcomeAt?: string;
  @ApiPropertyOptional() providerOrderId?: string;
  @ApiPropertyOptional() providerReferenceId?: string;
  @ApiPropertyOptional() providerTransactionId?: string;
  @ApiPropertyOptional({ format: "date-time" }) providerUpdatedAt?: string;
  @ApiPropertyOptional() rawOrderStatus?: string;
  @ApiPropertyOptional() rawOrderStatusDetail?: string;
  @ApiPropertyOptional() rawTransactionStatus?: string;
  @ApiPropertyOptional() rawTransactionStatusDetail?: string;
  @ApiProperty() refundedAmount!: number;
  @ApiProperty({ enum: Object.values(PaymentAttemptStatus) }) status!: PaymentAttemptStatus;
  @ApiProperty({ format: "date-time" }) submittedAt!: string;
}

export class AdminSaleProviderPaymentResponseDto {
  @ApiProperty() attemptCount!: number;
  @ApiProperty({ type: [AdminSalePaymentAttemptResponseDto] }) attempts!: AdminSalePaymentAttemptResponseDto[];
  @ApiPropertyOptional() attentionReason?: string;
  @ApiPropertyOptional({ format: "date-time" }) attentionRequiredAt?: string;
  @ApiProperty() chargedBack!: boolean;
  @ApiProperty() dispute!: boolean;
  @ApiProperty() fraudAlert!: boolean;
  @ApiProperty() fullRefund!: boolean;
  @ApiProperty({ type: [String] }) holds!: string[];
  @ApiPropertyOptional({ format: "date-time" }) lastVerifiedAt?: string;
  @ApiProperty({ enum: Object.values(PaymentProvider) }) provider!: PaymentProvider;
  @ApiPropertyOptional() rawStatus?: string;
  @ApiPropertyOptional() rawStatusDetail?: string;
  @ApiProperty() refundedAmount!: number;
  @ApiPropertyOptional({ format: "date-time" }) retryUntil?: string;
  @ApiPropertyOptional({ format: "date-time" }) reviewStartedAt?: string;
  @ApiProperty() unresolvedReconciliation!: boolean;
}

export class AdminPaymentRiskAlertResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() reason?: string;
  @ApiProperty({ format: "date-time" }) receivedAt!: string;
  @ApiProperty() resourceId!: string;
  @ApiProperty() topic!: string;
}

export class AdminPaymentRiskAlertListResponseDto {
  @ApiProperty({ type: [AdminPaymentRiskAlertResponseDto] }) items!: AdminPaymentRiskAlertResponseDto[];
}

export class AdminSalePaymentResponseDto {
  @ApiPropertyOptional({ type: AdminSaleProviderPaymentResponseDto }) providerPayment?: AdminSaleProviderPaymentResponseDto;
  @ApiProperty() amount!: number;
  @ApiPropertyOptional({ type: Object }) bankTransferSnapshot?: Record<string, unknown>;
  @ApiProperty() currency!: string;
  @ApiProperty() paymentMethodId!: string;
  @ApiProperty({ type: Object }) paymentMethodSnapshot!: Record<string, unknown>;
  @ApiPropertyOptional() paymentOptionId?: string;
  @ApiProperty({ enum: Object.values(PaymentStatus), nullable: true }) status!: PaymentStatus;
}

export class AdminSaleSummaryResponseDto {
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ type: AdminSaleCustomerResponseDto }) customer!: AdminSaleCustomerResponseDto;
  @ApiPropertyOptional() customerId?: string;
  @ApiProperty({ enum: Object.values(OrderDeliveryType) }) deliveryType!: OrderDeliveryType;
  @ApiProperty() id!: string;
  @ApiProperty() isArchived!: boolean;
  @ApiProperty() itemCount!: number;
  @ApiProperty() number!: string;
  @ApiPropertyOptional() paymentAttention?: boolean;
  @ApiPropertyOptional() paymentDispute?: boolean;
  @ApiPropertyOptional({ enum: Object.values(PaymentProvider) }) paymentProvider?: PaymentProvider;
  @ApiPropertyOptional() paymentRefundedAmount?: number;
  @ApiProperty({ enum: Object.values(PaymentStatus), nullable: true }) paymentStatus!: PaymentStatus | null;
  @ApiProperty({ enum: Object.values(OrderShippingStatus) }) shippingStatus!: OrderShippingStatus;
  @ApiPropertyOptional() sourceOrderId?: string;
  @ApiProperty({ enum: Object.values(OrderStatus) }) status!: OrderStatus;
  @ApiProperty() total!: number;
  @ApiPropertyOptional() trackingCode?: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

export class AdminSaleDetailResponseDto extends AdminSaleSummaryResponseDto {
  @ApiPropertyOptional({ format: "date-time" }) archivedAt?: string;
  @ApiPropertyOptional() cancellationReason?: string;
  @ApiPropertyOptional({ format: "date-time" }) cancelledAt?: string;
  @ApiPropertyOptional({ format: "date-time" }) confirmedAt?: string;
  @ApiProperty({ type: Object }) customerSnapshot!: Record<string, unknown>;
  @ApiPropertyOptional({ format: "date-time" }) deliveredAt?: string;
  @ApiProperty() discountAmount!: number;
  @ApiProperty({ type: Object }) discountSnapshot!: Record<string, unknown>;
  @ApiProperty({ type: [AdminSaleHistoryResponseDto] }) history!: AdminSaleHistoryResponseDto[];
  @ApiPropertyOptional() internalNotes?: string;
  @ApiProperty({ type: [CreateManualSaleItemRequestDto] }) items!: CreateManualSaleItemRequestDto[];
  @ApiPropertyOptional({ format: "date-time" }) packedAt?: string;
  @ApiProperty({ type: AdminSalePaymentResponseDto, nullable: true }) payment!: AdminSalePaymentResponseDto | null;
  @ApiPropertyOptional({ enum: Object.values(PaymentStatus) }) previousPaymentStatus?: PaymentStatus;
  @ApiPropertyOptional({ enum: Object.values(OrderShippingStatus) }) previousShippingStatus?: OrderShippingStatus;
  @ApiPropertyOptional({ enum: Object.values(OrderStatus) }) previousStatus?: OrderStatus;
  @ApiPropertyOptional({ type: Object }) shippingAddress?: Record<string, unknown>;
  @ApiPropertyOptional() shippingCarrier?: string;
  @ApiProperty() shippingCost!: number;
  @ApiPropertyOptional() shippingTrackingUrl?: string;
  @ApiPropertyOptional({ format: "date-time" }) shippedAt?: string;
  @ApiProperty() subtotal!: number;
  @ApiProperty({ type: Object }) deliverySnapshot!: Record<string, unknown>;
}

export class AdminSaleListResponseDto {
  @ApiProperty({ type: [AdminSaleSummaryResponseDto] }) items!: AdminSaleSummaryResponseDto[];
  @ApiProperty() limit!: number;
  @ApiProperty() page!: number;
  @ApiProperty() total!: number;
}

export class CreateManualSaleRequestDto {
  @ApiPropertyOptional({ default: "ARS" }) currency?: string;
  @ApiProperty({ type: AdminSaleCustomerResponseDto }) customer!: AdminSaleCustomerResponseDto;
  @ApiPropertyOptional() customerId?: string;
  @ApiPropertyOptional({ type: Object }) deliverySnapshot?: Record<string, unknown>;
  @ApiPropertyOptional({ enum: Object.values(OrderDeliveryType), default: OrderDeliveryType.SHIPPING }) deliveryType?: OrderDeliveryType;
  @ApiPropertyOptional({ default: 0 }) discountAmount?: number;
  @ApiPropertyOptional({ type: Object }) discountSnapshot?: Record<string, unknown>;
  @ApiPropertyOptional() internalNotes?: string;
  @ApiProperty({ type: [AdminSaleItemResponseDto] }) items!: AdminSaleItemResponseDto[];
  @ApiPropertyOptional({ default: "manual" }) paymentMethodId?: string;
  @ApiPropertyOptional({ type: Object }) paymentMethodSnapshot?: Record<string, unknown>;
  @ApiPropertyOptional() paymentOptionId?: string;
  @ApiPropertyOptional({ enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING }) paymentStatus?: PaymentStatus;
  @ApiPropertyOptional({ type: Object }) shippingAddress?: Record<string, unknown>;
  @ApiPropertyOptional({ default: 0 }) shippingCost?: number;
  @ApiPropertyOptional() source?: string;
}

export class ConvertOrderToSaleRequestDto {
  @ApiPropertyOptional() orderId?: string;
  @ApiPropertyOptional() sourceOrderId?: string;
}

export class ShipSaleRequestDto {
  @ApiProperty() carrier!: string;
  @ApiProperty() trackingCode!: string;
  @ApiPropertyOptional({ format: "uri" }) trackingUrl?: string;
}

export class CancelSaleRequestDto {
  @ApiProperty() cancellationReason!: string;
  @ApiProperty() restoreStock!: boolean;
}

export class AddSaleNoteRequestDto {
  @ApiProperty() note!: string;
}
