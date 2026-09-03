import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  CHECKOUT_DELIVERY_TYPE,
  CHECKOUT_PAYMENT_METHOD_IDS,
} from "../checkout.constants";
import { CheckoutAddressDto, CheckoutCustomerDto } from "./checkout-common.dto";

export class CheckoutLineItemRequestDto {
  @ApiProperty({ description: "Canonical product identifier." })
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 1_000 })
  quantity!: number;

  @ApiPropertyOptional({ description: "Optional canonical variant identifier." })
  variantId?: string;
}

export class CheckoutQuoteRequestDto {
  @ApiPropertyOptional({ type: CheckoutAddressDto })
  address?: CheckoutAddressDto;

  @ApiPropertyOptional({ description: "Authenticated customer-owned address identifier." })
  addressId?: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  couponCode?: string;

  @ApiPropertyOptional({ enum: Object.values(CHECKOUT_DELIVERY_TYPE) })
  deliveryType?: string;

  @ApiProperty({ type: [CheckoutLineItemRequestDto] })
  items!: CheckoutLineItemRequestDto[];

  @ApiPropertyOptional()
  pickupPointId?: string;

  @ApiPropertyOptional()
  postalCode?: string;

  @ApiPropertyOptional()
  province?: string;

  @ApiPropertyOptional({ description: "Opaque checkout session credential; raw values are never persisted." })
  sessionToken?: string;

  @ApiPropertyOptional({ description: "Canonical provider service identifier." })
  shippingMethodId?: string;

  @ApiPropertyOptional({ description: "Canonical shipping provider identifier." })
  shippingProviderId?: string;
}

export class CheckoutCompleteRequestDto extends CheckoutQuoteRequestDto {
  @ApiProperty({ type: CheckoutCustomerDto })
  customer!: CheckoutCustomerDto;

  @ApiProperty({ minLength: 8, maxLength: 128, description: "Client retry key scoped to the authenticated or guest owner." })
  idempotencyKey!: string;

  @ApiProperty({ enum: CHECKOUT_PAYMENT_METHOD_IDS })
  paymentMethodId!: string;

  @ApiPropertyOptional()
  paymentOptionId?: string;

  @ApiPropertyOptional({ description: "Opaque server-issued quote identifier." })
  quoteId?: string;
}
