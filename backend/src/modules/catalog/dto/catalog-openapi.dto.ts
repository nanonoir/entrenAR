import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CatalogProductRequestDto {
  @ApiProperty()
  categoryIds!: string[];

  @ApiProperty()
  description!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  price!: number;

  @ApiPropertyOptional()
  compareAtPrice?: number;

  @ApiPropertyOptional({ type: [Object] })
  variantProperties?: object[];

  @ApiPropertyOptional({ type: [Object] })
  variantCombinations?: object[];

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

  @ApiPropertyOptional()
  slug?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  googleShoppingCategory?: string;

  @ApiPropertyOptional()
  seoTitle?: string;

  @ApiPropertyOptional()
  seoDescription?: string;
}

/** PUT body: omitted optional fields are preserved; `null` clears them (`parentId: null` moves to the root). */
export class CatalogCategoryUpdateRequestDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["visible", "hidden"] })
  visibility!: string;

  @ApiPropertyOptional()
  slug?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  parentId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  imageUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  googleShoppingCategory?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  seoTitle?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  seoDescription?: string | null;
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

  @ApiProperty()
  totalPages!: number;

  @ApiPropertyOptional({ type: Object })
  facets?: object;

  @ApiPropertyOptional({ type: Object })
  priceBounds?: object;
}

export class PublicBrandDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  count!: number;
}
