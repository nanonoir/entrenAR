import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { CUSTOMER_SORT_BY, type CustomerSortBy } from "../customers.schemas";

export class CustomerAddressDto {
  @ApiProperty() city!: string;
  @ApiProperty() country!: string;
  @ApiPropertyOptional() floorOrApartment?: string;
  @ApiPropertyOptional() neighborhood?: string;
  @ApiProperty() number!: string;
  @ApiProperty() postalCode!: string;
  @ApiProperty() provinceOrState!: string;
  @ApiProperty() street!: string;
}

export class CustomerLastOrderDto {
  @ApiProperty({ format: "date-time" }) date!: string;
  @ApiProperty() id!: string;
  @ApiProperty() number!: string;
  @ApiProperty() total!: number;
}

export class CustomerSalesSummaryDto {
  @ApiPropertyOptional({ type: CustomerLastOrderDto }) lastOrder?: CustomerLastOrderDto;
  @ApiProperty() ordersCount!: number;
  @ApiProperty() totalSpent!: number;
}

export class CustomerResponseDto {
  @ApiPropertyOptional({ type: CustomerAddressDto }) address?: CustomerAddressDto;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiPropertyOptional() dniOrCuil?: string;
  @ApiProperty({ format: "email" }) email!: string;
  @ApiProperty({ format: "date-time" }) firstInteractionDate!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() id!: string;
  @ApiProperty() isAnonymized!: boolean;
  @ApiPropertyOptional() notes?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

export class CustomerDetailResponseDto extends CustomerResponseDto {
  @ApiProperty({ type: CustomerSalesSummaryDto }) summary!: CustomerSalesSummaryDto;
}

export class CustomerListResponseDto {
  @ApiProperty({ type: [CustomerResponseDto] }) items!: CustomerResponseDto[];
  @ApiProperty() limit!: number;
  @ApiProperty() page!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class CustomerEmailAvailabilityResponseDto {
  @ApiProperty() available!: boolean;
}

export class CustomerListQueryDto {
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() country?: string;
  @ApiPropertyOptional() hasOrders?: boolean;
  @ApiPropertyOptional() isAnonymized?: boolean;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 }) limit?: number;
  @ApiPropertyOptional({ default: 1, minimum: 1 }) page?: number;
  @ApiPropertyOptional() provinceOrState?: string;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional({ enum: Object.values(CUSTOMER_SORT_BY), default: CUSTOMER_SORT_BY.CREATED_AT }) sortBy?: CustomerSortBy;
  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" }) sortOrder?: "asc" | "desc";
}

export class CustomerEmailAvailabilityQueryDto {
  @ApiProperty({ format: "email" }) email!: string;
  @ApiPropertyOptional() excludeCustomerId?: string;
}

abstract class CustomerAddressRequestDto {
  @ApiPropertyOptional() city?: string | null;
  @ApiPropertyOptional() country?: string | null;
  @ApiPropertyOptional() floorOrApartment?: string | null;
  @ApiPropertyOptional() neighborhood?: string | null;
  @ApiPropertyOptional() number?: string | null;
  @ApiPropertyOptional() postalCode?: string | null;
  @ApiPropertyOptional() provinceOrState?: string | null;
  @ApiPropertyOptional() street?: string | null;
}

export class CreateCustomerRequestDto extends CustomerAddressRequestDto {
  @ApiPropertyOptional() dniOrCuil?: string | null;
  @ApiProperty({ format: "email" }) email!: string;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() notes?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional({ type: [String] }) tags?: string[];
}

export class UpdateCustomerRequestDto extends CustomerAddressRequestDto {
  @ApiPropertyOptional() dniOrCuil?: string | null;
  @ApiPropertyOptional({ format: "email" }) email?: string;
  @ApiPropertyOptional() fullName?: string;
  @ApiPropertyOptional() notes?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional({ type: [String] }) tags?: string[];
}

export class UpdateCustomerNotesRequestDto {
  @ApiProperty() notes!: string;
}

export class CustomerIdParamDto {
  @ApiProperty() id!: string;
}
