import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CheckoutAddressDto {
  @ApiProperty()
  city!: string;

  @ApiPropertyOptional()
  label?: string;

  @ApiPropertyOptional()
  number?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty()
  province!: string;

  @ApiPropertyOptional()
  recipient?: string;

  @ApiProperty()
  street!: string;
}

export class CheckoutCustomerDto {
  @ApiPropertyOptional({ pattern: "^[0-9]{6,11}$" })
  dni?: string;

  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiPropertyOptional()
  phone?: string;
}
