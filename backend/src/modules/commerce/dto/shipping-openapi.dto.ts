import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class WeightBandDto {
  @ApiProperty()
  cost!: number;

  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  maxGrams!: number | null;

  @ApiProperty()
  minGrams!: number;
}

export class ShippingOriginDto {
  @ApiProperty()
  city!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  number!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty()
  province!: string;

  @ApiProperty()
  senderName!: string;

  @ApiProperty()
  street!: string;

  @ApiPropertyOptional()
  apartment?: string;

  @ApiPropertyOptional()
  cuitCuil?: string;

  @ApiPropertyOptional()
  floor?: string;

  @ApiPropertyOptional()
  reference?: string;
}

export class ShippingProviderRequestDto {
  @ApiProperty({ enum: ["home_delivery", "branch_delivery"], isArray: true })
  enabledModalities!: string[];

  @ApiPropertyOptional()
  freeShippingThreshold?: number;

  @ApiPropertyOptional({ type: ShippingOriginDto })
  origin?: ShippingOriginDto;

  @ApiProperty({ enum: ["active", "configured_inactive", "not_configured"] })
  status!: string;

  @ApiProperty({ type: [WeightBandDto] })
  weightRanges!: WeightBandDto[];
}

export class ShippingProviderDto {
  @ApiProperty({ enum: ["home_delivery", "branch_delivery"], isArray: true })
  enabledModalities!: string[];

  @ApiPropertyOptional()
  freeShippingThreshold?: number;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: ShippingOriginDto })
  origin!: ShippingOriginDto;

  @ApiProperty({ enum: ["active", "configured_inactive", "not_configured"] })
  status!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: [WeightBandDto] })
  weightRanges!: WeightBandDto[];
}

export class PickupAddressDto {
  @ApiProperty()
  city!: string;

  @ApiProperty()
  number!: string;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty()
  province!: string;

  @ApiProperty()
  street!: string;
}

export class PickupScheduleDto {
  @ApiProperty()
  day!: string;

  @ApiProperty()
  from!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  to!: string;
}

export class PickupPointRequestDto {
  @ApiPropertyOptional({ type: PickupAddressDto })
  address?: PickupAddressDto;

  @ApiPropertyOptional()
  contactEmail?: string;

  @ApiPropertyOptional()
  contactName?: string;

  @ApiPropertyOptional()
  contactPhone?: string;

  @ApiProperty({ enum: ["free", "fixed"] })
  costType!: string;

  @ApiProperty({ enum: ["all", "provinces"] })
  coverageType!: string;

  @ApiPropertyOptional()
  fixedCost?: number;

  @ApiProperty()
  isMain!: boolean;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  preparationHours!: number;

  @ApiProperty({ type: [String] })
  provinces!: string[];

  @ApiProperty({ type: [PickupScheduleDto] })
  schedule!: PickupScheduleDto[];

  @ApiProperty({ enum: ["active", "configured_inactive", "not_configured"] })
  status!: string;
}

export class PickupPointDto {
  @ApiProperty({ type: PickupAddressDto })
  address!: PickupAddressDto;

  @ApiPropertyOptional()
  contactEmail?: string;

  @ApiPropertyOptional()
  contactName?: string;

  @ApiPropertyOptional()
  contactPhone?: string;

  @ApiProperty({ enum: ["free", "fixed"] })
  costType!: string;

  @ApiProperty({ enum: ["all", "provinces"] })
  coverageType!: string;

  @ApiPropertyOptional()
  fixedCost?: number;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  isMain!: boolean;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  preparationHours!: number;

  @ApiProperty({ type: [String] })
  provinces!: string[];

  @ApiProperty({ type: [PickupScheduleDto] })
  schedule!: PickupScheduleDto[];

  @ApiProperty({ enum: ["active", "configured_inactive", "not_configured"] })
  status!: string;

  @ApiProperty()
  updatedAt!: string;
}
