import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { ROLE } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../auth/decorators/roles.decorator";
import { CatalogSettingsService } from "./catalog-settings.service";
import { toAdminCatalogCategory } from "./catalog.mapper";
import { CatalogQueryService } from "./catalog-query.service";
import { CategoryService } from "./category.service";
import {
  AdminProductListQuery,
  CatalogSettingsUpdateInput,
  CategoryCreateInput,
  CategoryOrderInput,
  CategoryUpdateInput,
  CategoryVisibilityInput,
  ProductCreateInput,
  ProductPriceUpdateInput,
  ProductUpdateInput,
  adminProductListQuerySchema,
  catalogSettingsUpdateSchema,
  categoryCreateSchema,
  categoryOrderSchema,
  categoryUpdateSchema,
  categoryVisibilitySchema,
  identifierSchema,
  productCreateSchema,
  productPriceUpdateSchema,
  productUpdateSchema,
} from "./catalog.schemas";
import {
  CatalogCategoryOrderRequestDto,
  CatalogCategoryRequestDto,
  CatalogCategoryVisibilityRequestDto,
  CatalogPageDto,
  CatalogProductPriceRequestDto,
  CatalogProductRequestDto,
  CatalogSettingsRequestDto,
} from "./dto/catalog-openapi.dto";
import { ProductService } from "./product.service";

@ApiTags("Administration")
@ApiBearerAuth("access-token")
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@Controller("admin")
@Roles(ROLE.ADMIN)
export class AdminCatalogController {
  constructor(
    private readonly catalogQueries: CatalogQueryService,
    private readonly categoryService: CategoryService,
    private readonly catalogSettingsService: CatalogSettingsService,
    private readonly productService: ProductService,
  ) {}

  @Get("products")
  @ApiOperation({ summary: "List catalog products for administration" })
  @ApiOkResponse({ description: "Bounded, filtered admin product page.", type: CatalogPageDto })
  async products(@Query(new ZodValidationPipe(adminProductListQuerySchema)) query: AdminProductListQuery) {
    return this.catalogQueries.adminProducts(query);
  }

  @Post("products")
  @ApiOperation({ summary: "Create a catalog product" })
  @ApiBody({ type: CatalogProductRequestDto })
  @ApiCreatedResponse({ description: "Current admin product projection." })
  @ApiResponse({ description: "SLUG_CONFLICT, SKU_CONFLICT, or VALIDATION_ERROR", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  async createProduct(@Body(new ZodValidationPipe(productCreateSchema)) input: ProductCreateInput) {
    return this.productService.create(input);
  }

  @Put("products/:id/price")
  @ApiOperation({ summary: "Update a product's authoritative prices" })
  @ApiBody({ type: CatalogProductPriceRequestDto })
  @ApiOkResponse({ description: "Current admin product projection." })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async updateProductPrice(
    @Param("id", new ZodValidationPipe(identifierSchema)) id: string,
    @Body(new ZodValidationPipe(productPriceUpdateSchema)) input: ProductPriceUpdateInput,
  ) {
    return this.productService.updatePrices(id, input);
  }

  @Post("products/:id/duplicate")
  @ApiOperation({ summary: "Duplicate a product with independent identities" })
  @ApiCreatedResponse({ description: "Independent duplicated admin product projection." })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async duplicateProduct(@Param("id", new ZodValidationPipe(identifierSchema)) id: string) {
    return this.productService.duplicate(id);
  }

  @Get("products/:id")
  @ApiOperation({ summary: "Get one catalog product for administration" })
  @ApiOkResponse({ description: "Admin product projection." })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async product(@Param("id", new ZodValidationPipe(identifierSchema)) id: string) {
    return this.productService.get(id);
  }

  @Put("products/:id")
  @ApiOperation({ summary: "Replace a catalog product" })
  @ApiBody({ type: CatalogProductRequestDto })
  @ApiOkResponse({ description: "Current admin product projection." })
  async updateProduct(
    @Param("id", new ZodValidationPipe(identifierSchema)) id: string,
    @Body(new ZodValidationPipe(productCreateSchema)) input: ProductCreateInput,
  ) {
    return this.productService.update(productUpdateSchema.parse({ ...input, id }) as ProductUpdateInput);
  }

  @Delete("products/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a catalog product" })
  @ApiNoContentResponse({ description: "Product and owned variant identities removed." })
  @ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
  async deleteProduct(@Param("id", new ZodValidationPipe(identifierSchema)) id: string): Promise<void> {
    await this.productService.delete(id);
  }

  @Put("categories/order")
  @ApiOperation({ summary: "Persist the full stable category order" })
  @ApiBody({ type: CatalogCategoryOrderRequestDto })
  @ApiOkResponse({ description: "Category order persisted." })
  async setCategoryOrder(@Body(new ZodValidationPipe(categoryOrderSchema)) input: CategoryOrderInput): Promise<{ ok: true }> {
    await this.categoryService.setOrder(input.categoryIds);
    return { ok: true };
  }

  @Get("categories")
  @ApiOperation({ summary: "List the recursive admin category tree" })
  @ApiOkResponse({ description: "Recursive adjacency-list category collection." })
  async categories() {
    return this.catalogQueries.adminCategories();
  }

  @Post("categories")
  @ApiOperation({ summary: "Create a catalog category" })
  @ApiBody({ type: CatalogCategoryRequestDto })
  @ApiCreatedResponse({ description: "Created category." })
  async createCategory(@Body(new ZodValidationPipe(categoryCreateSchema)) input: CategoryCreateInput) {
    return toAdminCatalogCategory(await this.categoryService.create(input));
  }

  @Put("categories/:id/visibility")
  @ApiOperation({ summary: "Set category visibility and cascade hiding to descendants" })
  @ApiBody({ type: CatalogCategoryVisibilityRequestDto })
  @ApiOkResponse({ description: "Category visibility updated." })
  async setCategoryVisibility(
    @Param("id", new ZodValidationPipe(identifierSchema)) id: string,
    @Body(new ZodValidationPipe(categoryVisibilitySchema)) input: CategoryVisibilityInput,
  ): Promise<{ ok: true }> {
    await this.categoryService.setVisibility(id, input.visibility);
    return { ok: true };
  }

  @Put("categories/:id")
  @ApiOperation({ summary: "Update a catalog category" })
  @ApiBody({ type: CatalogCategoryRequestDto })
  @ApiOkResponse({ description: "Updated category." })
  async updateCategory(
    @Param("id", new ZodValidationPipe(identifierSchema)) id: string,
    @Body(new ZodValidationPipe(categoryCreateSchema)) input: CategoryCreateInput,
  ) {
    return toAdminCatalogCategory(await this.categoryService.update(categoryUpdateSchema.parse({ ...input, id }) as CategoryUpdateInput));
  }

  @Delete("categories/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an unused category hierarchy" })
  @ApiNoContentResponse({ description: "Unused category hierarchy deleted." })
  @ApiResponse({ description: "CATEGORY_IN_USE", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  async deleteCategory(@Param("id", new ZodValidationPipe(identifierSchema)) id: string): Promise<void> {
    await this.categoryService.delete(id);
  }

  @Get("catalog/settings")
  @ApiOperation({ summary: "Get catalog organization settings" })
  @ApiOkResponse({ description: "Persisted catalog settings." })
  async settings() {
    return this.toSettingsResponse(await this.catalogSettingsService.get());
  }

  @Put("catalog/settings")
  @ApiOperation({ summary: "Update catalog organization settings" })
  @ApiBody({ type: CatalogSettingsRequestDto })
  @ApiOkResponse({ description: "Persisted catalog settings." })
  async updateSettings(@Body(new ZodValidationPipe(catalogSettingsUpdateSchema)) input: CatalogSettingsUpdateInput) {
    return this.toSettingsResponse(await this.catalogSettingsService.setShowOutOfStockAtEnd(input.showOutOfStockAtEnd));
  }

  private toSettingsResponse(settings: { persistOrder: boolean; showOutOfStockAtEnd: boolean }) {
    return {
      persistOrder: settings.persistOrder,
      showOutOfStockAtEnd: settings.showOutOfStockAtEnd,
    };
  }
}
