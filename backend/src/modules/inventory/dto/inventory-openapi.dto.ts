import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InventoryUpdateRequestDto {
  @ApiProperty({ enum: ["add", "subtract", "replace"] })
  operation!: string;

  @ApiPropertyOptional({ description: "Positive delta for add/subtract or the limited replacement quantity." })
  quantity?: number;

  @ApiPropertyOptional({ description: "Optional audit reason." })
  reason?: string;

  @ApiPropertyOptional({ enum: ["limited", "infinite"], description: "Required for replace operations." })
  stockMode?: string;

  @ApiPropertyOptional({ description: "Optional product variant ID. It must belong to the route product." })
  variantId?: string;
}

export class InventoryRecordDto {
  @ApiProperty()
  productId!: string;

  @ApiPropertyOptional({ nullable: true })
  quantity!: number | null;

  @ApiProperty({ oneOf: [{ type: "number" }, { type: "string", enum: ["infinite"] }] })
  stock!: number | "infinite";

  @ApiProperty({ enum: ["limited", "infinite"] })
  stockMode!: string;

  @ApiPropertyOptional()
  variantId?: string;
}
