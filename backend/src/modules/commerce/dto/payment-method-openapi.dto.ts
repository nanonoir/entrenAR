import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BankTransferConfigDto {
  @ApiProperty()
  alias!: string;

  @ApiProperty()
  bankName!: string;

  @ApiProperty()
  cbuCvu!: string;

  @ApiProperty()
  cuitCuil!: string;

  @ApiProperty()
  holderName!: string;
}

export class PaymentProviderOptionDto {
  @ApiProperty()
  fee!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  receiveIn!: string;

  @ApiProperty()
  salesIn!: string;
}

export class PaymentMethodUpdateRequestDto {
  @ApiPropertyOptional({ nullable: true, type: BankTransferConfigDto })
  bankConfig?: BankTransferConfigDto | null;

  @ApiPropertyOptional({ nullable: true })
  selectedOptionId?: string | null;

  @ApiProperty({ enum: ["active", "inactive"] })
  status!: string;
}

export class PaymentMethodConfigDto {
  @ApiProperty({ type: [String] })
  acceptedMethods!: string[];

  @ApiPropertyOptional({ nullable: true, type: BankTransferConfigDto })
  bankConfig?: BankTransferConfigDto;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  logoSrc!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [PaymentProviderOptionDto] })
  options!: PaymentProviderOptionDto[];

  @ApiPropertyOptional()
  selectedOptionId?: string;

  @ApiProperty({ enum: ["active", "inactive"] })
  status!: string;

  @ApiProperty()
  updatedAt!: string;
}
