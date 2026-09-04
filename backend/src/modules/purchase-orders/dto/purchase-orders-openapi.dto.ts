import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { PurchaseOrderStatus } from "../../../generated/prisma/enums";
import { SupplierOpenApiResponseDto } from "../../suppliers/dto/suppliers-openapi.dto";

export class PurchaseOrderItemRequestDto {
  @ApiProperty() productId!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() sku!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() totalCost?: number;
  @ApiProperty() unitCost!: number;
  @ApiPropertyOptional({ nullable: true }) variantId?: string | null;
}

export class PurchaseOrderRequestDto {
  @ApiPropertyOptional({ format: "date-time", nullable: true }) expectedDate?: string | null;
  @ApiProperty({ type: [PurchaseOrderItemRequestDto] }) items!: PurchaseOrderItemRequestDto[];
  @ApiPropertyOptional({ nullable: true }) notes?: string | null;
  @ApiPropertyOptional() orderNumber?: string;
  @ApiPropertyOptional({ default: 0 }) shippingCost?: number;
  @ApiPropertyOptional() subtotal?: number;
  @ApiProperty() supplierId!: string;
  @ApiPropertyOptional({ default: 0 }) tax?: number;
  @ApiPropertyOptional() total?: number;
}

export class PurchaseOrderResponseDto {
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiPropertyOptional({ format: "date-time", nullable: true }) expectedDate?: string | null;
  @ApiProperty() id!: string;
  @ApiProperty({ type: [PurchaseOrderItemRequestDto] }) items!: PurchaseOrderItemRequestDto[];
  @ApiPropertyOptional({ nullable: true }) notes?: string | null;
  @ApiProperty() orderNumber!: string;
  @ApiPropertyOptional({ format: "date-time", nullable: true }) receivedAt?: string | null;
  @ApiProperty({ enum: Object.values(PurchaseOrderStatus) }) status!: PurchaseOrderStatus;
  @ApiProperty() subtotal!: number;
  @ApiProperty({ type: SupplierOpenApiResponseDto }) supplier!: SupplierOpenApiResponseDto;
  @ApiProperty() supplierId!: string;
  @ApiProperty() tax!: number;
  @ApiProperty() total!: number;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

export class PurchaseOrderListResponseDto {
  @ApiProperty({ type: [PurchaseOrderResponseDto] }) items!: PurchaseOrderResponseDto[];
  @ApiProperty() limit!: number;
  @ApiProperty() page!: number;
  @ApiProperty() total!: number;
}
