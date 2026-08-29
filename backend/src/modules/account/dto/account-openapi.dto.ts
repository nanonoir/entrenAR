import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AccountProfileRequestDto {
  @ApiProperty({ description: "Public account DNI, digits only." })
  dni!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  gender!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ format: "date" })
  birthDate!: string;

  @ApiProperty()
  phone!: string;
}

export class AccountProfileDto {
  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty({ nullable: true })
  firstName!: string | null;

  @ApiProperty({ nullable: true })
  lastName!: string | null;

  @ApiProperty({ nullable: true, pattern: "^[0-9]{6,9}$" })
  dni!: string | null;

  @ApiProperty({ nullable: true })
  gender!: string | null;

  @ApiProperty({ format: "date", nullable: true })
  birthDate!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;
}

export class AccountAddressRequestDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  recipient!: string;

  @ApiProperty()
  street!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  province!: string;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty()
  phone!: string;
}

export class AccountAddressDto extends AccountAddressRequestDto {
  @ApiProperty()
  id!: string;
}

export class AccountOrderItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ minimum: 1 })
  quantity!: number;

  @ApiProperty()
  price!: number;
}

export class AccountOrderDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ format: "date-time" })
  date!: string;

  @ApiProperty({ enum: ["preparacion", "en-camino", "entregado", "listo-para-retirar", "cancelado"] })
  status!: string;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  trackingCode!: string;

  @ApiProperty({ type: [AccountOrderItemDto] })
  items!: AccountOrderItemDto[];
}

export class AccountOrderListQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 100, minimum: 1 })
  limit?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  page?: number;
}

export class AccountSuccessResponseDto {
  @ApiProperty({ example: true })
  ok!: true;
}

export { AccountAddressDto as UserAddressDto };
export { AccountAddressRequestDto as UserAddressRequestDto };
export { AccountProfileDto as AccountProfileResponseDto };
