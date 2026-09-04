import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "../../common/auth/jwt-authentication.guard";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Role, type SupplierStatus } from "../../generated/prisma/enums";
import { Roles } from "../auth/decorators/roles.decorator";
import { SupplierListResponseDto, SupplierOpenApiResponseDto, SupplierRequestDto, SupplierStatusRequestDto } from "./dto/suppliers-openapi.dto";
import { createSupplierSchema, supplierFilterQuerySchema, supplierIdentifierSchema, supplierStatusSchema, updateSupplierSchema, type CreateSupplierDto, type SupplierFilterQueryDto, type UpdateSupplierDto } from "./suppliers.schemas";
import { SuppliersService } from "./suppliers.service";

@ApiTags("Admin Suppliers")
@ApiBearerAuth("access-token")
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
@ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
@Controller("admin/suppliers")
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminSuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: "List suppliers for administration" })
  @ApiOkResponse({ type: SupplierListResponseDto })
  list(@Query(new ZodValidationPipe(supplierFilterQuerySchema)) query: SupplierFilterQueryDto) { return this.suppliersService.list(query); }

  @Get(":id")
  @ApiOperation({ summary: "Get a supplier" })
  @ApiOkResponse({ type: SupplierOpenApiResponseDto })
  get(@Param("id", new ZodValidationPipe(supplierIdentifierSchema)) id: string) { return this.suppliersService.get(id); }

  @Post()
  @ApiOperation({ summary: "Create a supplier" })
  @ApiBody({ type: SupplierRequestDto })
  @ApiCreatedResponse({ type: SupplierOpenApiResponseDto })
  create(@Body(new ZodValidationPipe(createSupplierSchema)) input: CreateSupplierDto) { return this.suppliersService.create(input); }

  @Put(":id")
  @ApiOperation({ summary: "Update a supplier" })
  @ApiBody({ type: SupplierRequestDto })
  @ApiOkResponse({ type: SupplierOpenApiResponseDto })
  update(@Param("id", new ZodValidationPipe(supplierIdentifierSchema)) id: string, @Body(new ZodValidationPipe(updateSupplierSchema)) input: UpdateSupplierDto) { return this.suppliersService.update(id, input); }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate a supplier" })
  @ApiNoContentResponse({ description: "Supplier deactivated." })
  delete(@Param("id", new ZodValidationPipe(supplierIdentifierSchema)) id: string) { return this.suppliersService.delete(id); }

  @Patch(":id/status")
  @ApiOperation({ summary: "Set a supplier status" })
  @ApiBody({ type: SupplierStatusRequestDto })
  @ApiOkResponse({ type: SupplierOpenApiResponseDto })
  setStatus(@Param("id", new ZodValidationPipe(supplierIdentifierSchema)) id: string, @Body(new ZodValidationPipe(supplierStatusSchema)) input: { status: SupplierStatus }) { return this.suppliersService.setStatus(id, input.status); }
}
