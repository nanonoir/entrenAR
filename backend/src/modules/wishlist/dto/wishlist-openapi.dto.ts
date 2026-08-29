import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class WishlistProductDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  brand!: string;

  @ApiProperty()
  categorySlug!: string;

  @ApiProperty()
  categoryName!: string;

  @ApiProperty({ enum: ["green", "black", "red", "amber", "blue"] })
  imageTone!: string;

  @ApiProperty()
  shortDescription!: string;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty()
  price!: number;

  @ApiPropertyOptional()
  compareAtPrice?: number;

  @ApiProperty()
  rating!: number;

  @ApiProperty()
  reviews!: number;

  @ApiProperty()
  stock!: number;

  @ApiPropertyOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  isBestSeller?: boolean;

  @ApiPropertyOptional({ type: [String] })
  subcategorySlugs?: string[];
}

export class WishlistMutationResponseDto {
  @ApiProperty({ example: true })
  ok!: true;
}

export { WishlistProductDto as WishlistProductSummaryDto };
