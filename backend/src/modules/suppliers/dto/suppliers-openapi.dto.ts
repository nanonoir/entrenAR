import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { SupplierStatus } from "../../../generated/prisma/enums";

export class SupplierOpenApiResponseDto {
  @ApiProperty() code!: string;
  @ApiPropertyOptional({ nullable: true }) contactName?: string | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiPropertyOptional({ format: "email", nullable: true }) email?: string | null;
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) notes?: string | null;
  @ApiPropertyOptional({ nullable: true }) phone?: string | null;
  @ApiProperty({ enum: Object.values(SupplierStatus) }) status!: SupplierStatus;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

export class SupplierListResponseDto {
  @ApiProperty({ type: [SupplierOpenApiResponseDto] }) items!: SupplierOpenApiResponseDto[];
  @ApiProperty() limit!: number;
  @ApiProperty() page!: number;
  @ApiProperty() total!: number;
}

export class SupplierRequestDto {
  @ApiProperty() code!: string;
  @ApiPropertyOptional() contactName?: string;
  @ApiPropertyOptional({ format: "email" }) email?: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() notes?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional({ enum: Object.values(SupplierStatus), default: SupplierStatus.ACTIVE }) status?: SupplierStatus;
}

export class SupplierStatusRequestDto {
  @ApiProperty({ enum: Object.values(SupplierStatus) }) status!: SupplierStatus;
}
