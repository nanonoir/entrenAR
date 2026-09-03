import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  CHECKOUT_COUPON_RESULT,
  CHECKOUT_ORDER_STATUS,
  CHECKOUT_PAYMENT_METHOD_IDS,
  CHECKOUT_PAYMENT_STATUS,
  CHECKOUT_SHIPPING_MODALITY,
} from "../checkout.constants";
import { CheckoutAddressDto } from "./checkout-common.dto";

export class CheckoutQuoteItemDto {
  @ApiPropertyOptional({ minimum: 0, nullable: true })
  availableQuantity?: number | null;

  @ApiPropertyOptional({ minimum: 0 })
  compareAtPrice?: number;

  @ApiProperty({ minimum: 0 })
  lineSubtotal!: number;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty({ minimum: 1 })
  quantity!: number;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ minimum: 0 })
  unitPrice!: number;

  @ApiPropertyOptional()
  variantId?: string;

  @ApiPropertyOptional()
  variantName?: string;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  weightGrams?: number | null;
}

export class CheckoutShippingOptionDto {
  @ApiProperty({ minimum: 0 })
  cost!: number;

  @ApiPropertyOptional()
  estimatedDelivery?: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ enum: Object.values(CHECKOUT_SHIPPING_MODALITY) })
  modality!: string;

  @ApiProperty()
  providerId!: string;

  @ApiProperty()
  providerName!: string;
}

export class CheckoutPickupPointDto {
  @ApiProperty({ type: CheckoutAddressDto })
  address!: CheckoutAddressDto;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ minimum: 1 })
  preparationHours!: number;
}

export class CheckoutPaymentOptionDto {
  @ApiProperty()
  fee!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  receiveIn!: string;

  @ApiProperty()
  salesIn!: string;
}

export class CheckoutBankTransferDto {
  @ApiProperty()
  alias!: string;

  @ApiProperty()
  bankName!: string;

  @ApiProperty({ pattern: "^[0-9]{22}$" })
  cbuCvu!: string;

  @ApiProperty({ pattern: "^[0-9]{2}-[0-9]{8}-[0-9]$" })
  cuitCuil!: string;

  @ApiProperty()
  holderName!: string;
}

export class CheckoutPaymentMethodDto {
  @ApiProperty({ type: [String] })
  acceptedMethods!: string[];

  @ApiPropertyOptional({ type: CheckoutBankTransferDto })
  bankConfig?: CheckoutBankTransferDto;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: CHECKOUT_PAYMENT_METHOD_IDS })
  id!: string;

  @ApiProperty()
  logoSrc!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [CheckoutPaymentOptionDto] })
  options!: CheckoutPaymentOptionDto[];

  @ApiPropertyOptional()
  selectedOptionId?: string;
}

export class CheckoutCouponResultDto {
  @ApiPropertyOptional()
  code?: string;

  @ApiProperty({ minimum: 0 })
  discountAmount!: number;

  @ApiPropertyOptional()
  message?: string;

  @ApiProperty({ enum: Object.values(CHECKOUT_COUPON_RESULT) })
  result!: string;
}

export class CheckoutWarningDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  message!: string;
}

export class CheckoutQuoteResponseDto {
  @ApiPropertyOptional({ nullable: true, type: CheckoutCouponResultDto })
  coupon?: CheckoutCouponResultDto | null;

  @ApiProperty({ example: "ARS" })
  currency!: string;

  @ApiProperty({ minimum: 0 })
  discount!: number;

  @ApiPropertyOptional({ format: "date-time" })
  expiresAt?: string;

  @ApiProperty({ type: [CheckoutQuoteItemDto] })
  items!: CheckoutQuoteItemDto[];

  @ApiProperty({ type: [CheckoutPaymentMethodDto] })
  paymentMethods!: CheckoutPaymentMethodDto[];

  @ApiProperty({ type: [CheckoutPickupPointDto] })
  pickupPoints!: CheckoutPickupPointDto[];

  @ApiProperty()
  quoteId!: string;

  @ApiProperty({ minimum: 0 })
  shipping!: number;

  @ApiProperty({ type: [CheckoutShippingOptionDto] })
  shippingOptions!: CheckoutShippingOptionDto[];

  @ApiPropertyOptional({ description: "Opaque guest session credential returned only when a guest session is created." })
  sessionToken?: string;

  @ApiProperty({ minimum: 0 })
  subtotal!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ type: [CheckoutWarningDto] })
  warnings!: CheckoutWarningDto[];

  @ApiProperty({ example: true })
  ok!: true;
}

export class CheckoutOrderDto {
  @ApiProperty({ example: "ARS" })
  currency!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  number!: string;

  @ApiProperty({ enum: Object.values(CHECKOUT_ORDER_STATUS) })
  status!: string;

  @ApiProperty({ minimum: 0 })
  total!: number;
}

export class CheckoutCompleteResponseDto {
  @ApiPropertyOptional({ example: "ARS" })
  currency?: string;

  @ApiProperty()
  number!: string;

  @ApiProperty({ example: true })
  ok!: true;

  @ApiPropertyOptional({ type: CheckoutOrderDto })
  order?: CheckoutOrderDto;

  @ApiProperty()
  orderId!: string;

  @ApiPropertyOptional({ enum: Object.values(CHECKOUT_ORDER_STATUS) })
  status?: string;

  @ApiPropertyOptional({ minimum: 0 })
  total?: number;
}

export class CheckoutPaymentDto {
  @ApiProperty({ minimum: 0 })
  amount!: number;

  @ApiProperty({ example: "ARS" })
  currency!: string;

  @ApiProperty({ enum: CHECKOUT_PAYMENT_METHOD_IDS })
  paymentMethodId!: string;

  @ApiPropertyOptional()
  paymentOptionId?: string;

  @ApiProperty({ enum: Object.values(CHECKOUT_PAYMENT_STATUS) })
  status!: string;
}
