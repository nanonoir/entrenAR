import { Controller, Get, HttpStatus, Param, Query } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/auth/public.decorator";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CatalogQueryService } from "./catalog-query.service";
import { identifierSchema, publicProductListQuerySchema, type PublicProductListQuery } from "./catalog.schemas";
import { CatalogPageDto } from "./dto/catalog-openapi.dto";

@Public()
@ApiTags("Catalog")
@Controller()
export class PublicCatalogController {
  constructor(private readonly catalogQueries: CatalogQueryService) {}

  @Get("categories")
  @ApiOperation({ summary: "List visible storefront categories as a flat collection" })
  @ApiOkResponse({ description: "Visible flat category collection." })
  async categories() {
    return this.catalogQueries.publicCategories();
  }

  @Get("products")
  @ApiOperation({ summary: "List visible storefront products" })
  @ApiOkResponse({ description: "Bounded public product page.", type: CatalogPageDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  async products(@Query(new ZodValidationPipe(publicProductListQuerySchema)) query: PublicProductListQuery) {
    return this.catalogQueries.publicProducts(query);
  }

  @Get("products/:publicSlug")
  @ApiOperation({ summary: "Get a visible storefront product by its public URL slug" })
  @ApiOkResponse({ description: "Public product detail projection." })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async product(@Param("publicSlug", new ZodValidationPipe(identifierSchema)) publicSlug: string) {
    return this.catalogQueries.publicProduct(publicSlug);
  }
}
