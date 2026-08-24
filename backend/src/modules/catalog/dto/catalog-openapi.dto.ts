import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CatalogProductRequestDto {
  @ApiProperty()
  categoryIds!: string[];

  @ApiProperty()
  description!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  salePrice!: number;

  @ApiProperty({ enum: ["limited", "infinite"] })
  stockMode!: string;

  @ApiPropertyOptional()
  stockQuantity?: number;

  @ApiProperty({ enum: ["visible", "hidden"] })
  visibility!: string;
}

export class CatalogProductPriceRequestDto {
  @ApiProperty()
  salePrice!: number;

  @ApiPropertyOptional()
  compareAtPrice?: number;

  @ApiPropertyOptional()
  promotionalPrice?: number;
}

export class CatalogCategoryRequestDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["visible", "hidden"] })
  visibility!: string;

  @ApiPropertyOptional()
  parentId?: string;
}

export class CatalogCategoryVisibilityRequestDto {
  @ApiProperty({ enum: ["visible", "hidden"] })
  visibility!: string;
}

export class CatalogCategoryOrderRequestDto {
  @ApiProperty({ type: [String] })
  categoryIds!: string[];
}

export class CatalogSettingsRequestDto {
  @ApiProperty()
  showOutOfStockAtEnd!: boolean;
}

export class CatalogPageDto {
  @ApiProperty({ type: [Object] })
  items!: object[];

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  total!: number;
}
