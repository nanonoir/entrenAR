import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { SUPPORTED_CARD_PAYMENT_METHOD_IDS } from "./payment-card";
import { PAYMENT_IDENTIFICATION_TYPES } from "./payments.schemas";

export class PaymentIdentificationDto {
  @ApiProperty({ description: "Payer document number (digits only)." })
  number!: string;

  @ApiProperty({ enum: PAYMENT_IDENTIFICATION_TYPES })
  type!: string;
}

export class PaymentCardDto {
  @ApiProperty({ minimum: 1, maximum: 24 })
  installments!: number;

  @ApiProperty({ format: "email" })
  payerEmail!: string;

  @ApiProperty({ type: PaymentIdentificationDto })
  payerIdentification!: PaymentIdentificationDto;

  @ApiProperty({ enum: SUPPORTED_CARD_PAYMENT_METHOD_IDS, description: "Mercado Pago card brand; credit/debit type is derived server-side." })
  paymentMethodId!: string;

  @ApiProperty({ description: "Single-use card token created in the browser by Mercado Pago. Never stored or logged." })
  token!: string;
}

export class PaymentRetryRequestDto {
  @ApiProperty({ type: PaymentCardDto })
  card!: PaymentCardDto;

  @ApiPropertyOptional({ description: "Mercado Pago device/session id for fraud prevention." })
  deviceId?: string;

  @ApiProperty({ minLength: 8, maxLength: 128, description: "Client retry key; a new key is required for every attempt." })
  idempotencyKey!: string;

  @ApiPropertyOptional({ description: "Opaque guest checkout session credential." })
  sessionToken?: string;
}

export class PaymentAttemptSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  number!: number;

  @ApiProperty({ description: "Lowercase attempt status, e.g. submitting, unknown, processing, action_required, approved, rejected." })
  status!: string;
}

export class PaymentRetryWindowDto {
  @ApiProperty()
  eligible!: boolean;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  until!: string | null;
}

export class PaymentChallengeDto {
  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  expectedExpiresAt!: string;

  @ApiProperty()
  pollAfterSeconds!: number;

  @ApiProperty({ description: "Validated https Mercado Pago 3DS challenge URL. Never persisted." })
  url!: string;
}

export class PaymentStatusResponseDto {
  @ApiProperty()
  acceptedPending!: boolean;

  @ApiProperty()
  amount!: number;

  @ApiProperty({ nullable: true, type: PaymentAttemptSummaryDto })
  attempt!: PaymentAttemptSummaryDto | null;

  @ApiProperty()
  cartFinalized!: boolean;

  @ApiProperty({ nullable: true, type: PaymentChallengeDto })
  challenge!: PaymentChallengeDto | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ nullable: true, type: Number })
  nextPollSeconds!: number | null;

  @ApiProperty()
  ok!: true;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  orderNumber!: string;

  @ApiProperty()
  orderStatus!: string;

  @ApiProperty()
  paymentStatus!: string;

  @ApiProperty({ nullable: true, type: String })
  reasonCode!: string | null;

  @ApiProperty()
  reconciling!: boolean;

  @ApiProperty()
  refundedAmount!: number;

  @ApiProperty({ type: PaymentRetryWindowDto })
  retry!: PaymentRetryWindowDto;

  @ApiProperty({ description: "Normalized overall payment status." })
  status!: string;

  @ApiProperty({ description: "Monotonic payment version for client change detection." })
  version!: number;
}

export class ActivePaymentResponseDto {
  @ApiProperty({ nullable: true, type: PaymentStatusResponseDto })
  active!: PaymentStatusResponseDto | null;

  @ApiProperty()
  ok!: true;
}
