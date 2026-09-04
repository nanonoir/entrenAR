import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request, Response } from "express";

import { JwtAuthGuard, type AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Role } from "../../generated/prisma/enums";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  CustomerDetailResponseDto,
  CustomerEmailAvailabilityQueryDto,
  CustomerEmailAvailabilityResponseDto,
  CustomerIdParamDto,
  CustomerListQueryDto,
  CustomerListResponseDto,
  CustomerResponseDto,
  CreateCustomerRequestDto,
  UpdateCustomerNotesRequestDto,
  UpdateCustomerRequestDto,
} from "./dto/customers-openapi.dto";
import {
  createCustomerSchema,
  customerAnonymizeBodySchema,
  customerEmailAvailabilityQuerySchema,
  customerIdParamSchema,
  customerListQuerySchema,
  updateCustomerNotesSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type CustomerAnonymizeBody,
  type CustomerEmailAvailabilityQuery,
  type CustomerIdParam,
  type CustomerListQuery,
  type UpdateCustomerInput,
  type UpdateCustomerNotesInput,
} from "./customers.schemas";
import { CustomersService } from "./customers.service";

interface RequestWithAuthenticatedUser extends Request {
  user: AccessTokenPayload;
}

@ApiTags("Admin Customers")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "UNAUTHORIZED", type: ApiErrorResponseDto })
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
@ApiConflictResponse({ description: "EMAIL_EXISTS", type: ApiErrorResponseDto })
@ApiNotFoundResponse({ description: "CUSTOMER_NOT_FOUND", type: ApiErrorResponseDto })
@Controller("admin/customers")
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminCustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: "List customers for administration" })
  @ApiQuery({ type: CustomerListQueryDto, required: false })
  @ApiOkResponse({ type: CustomerListResponseDto })
  list(@Query(new ZodValidationPipe(customerListQuerySchema)) query: CustomerListQuery) {
    return this.customersService.listCustomers(query);
  }

  @Get("export")
  @ApiOperation({ summary: "Export all matching customers as CSV" })
  @ApiQuery({ type: CustomerListQueryDto, required: false })
  @ApiProduces("text/csv")
  @ApiCsvResponse()
  export(@Query(new ZodValidationPipe(customerListQuerySchema)) query: CustomerListQuery, @Res({ passthrough: true }) response: Response) {
    setCsvHeaders(response, "clientes.csv");
    return this.customersService.exportCustomersListCsv(query);
  }

  @Get("availability")
  @ApiOperation({ summary: "Check active customer email availability" })
  @ApiQuery({ type: CustomerEmailAvailabilityQueryDto })
  @ApiOkResponse({ type: CustomerEmailAvailabilityResponseDto })
  async availability(@Query(new ZodValidationPipe(customerEmailAvailabilityQuerySchema)) query: CustomerEmailAvailabilityQuery) {
    return { available: await this.customersService.isEmailAvailable(query.email, query.excludeCustomerId) };
  }

  @Get(":id/export")
  @ApiOperation({ summary: "Export one customer as CSV" })
  @ApiProduces("text/csv")
  @ApiCsvResponse()
  exportDetail(@Param(new ZodValidationPipe(customerIdParamSchema)) params: CustomerIdParam, @Res({ passthrough: true }) response: Response) {
    setCsvHeaders(response, `cliente-${params.id}.csv`);
    return this.customersService.exportCustomerDetailCsv(params.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a customer detail" })
  @ApiOkResponse({ type: CustomerDetailResponseDto })
  get(@Param(new ZodValidationPipe(customerIdParamSchema)) params: CustomerIdParam) {
    return this.customersService.getCustomer(params.id);
  }

  @Post()
  @ApiOperation({ summary: "Create a customer" })
  @ApiBody({ type: CreateCustomerRequestDto })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  create(@Body(new ZodValidationPipe(createCustomerSchema)) input: CreateCustomerInput) {
    return this.customersService.createCustomer(input);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a customer" })
  @ApiBody({ type: UpdateCustomerRequestDto })
  @ApiOkResponse({ type: CustomerResponseDto })
  update(@Param(new ZodValidationPipe(customerIdParamSchema)) params: CustomerIdParam, @Body(new ZodValidationPipe(updateCustomerSchema)) input: UpdateCustomerInput) {
    return this.customersService.updateCustomer(params.id, input);
  }

  @Patch(":id/notes")
  @ApiOperation({ summary: "Update customer notes" })
  @ApiBody({ type: UpdateCustomerNotesRequestDto })
  @ApiOkResponse({ type: CustomerResponseDto })
  updateNotes(@Param(new ZodValidationPipe(customerIdParamSchema)) params: CustomerIdParam, @Body(new ZodValidationPipe(updateCustomerNotesSchema)) input: UpdateCustomerNotesInput) {
    return this.customersService.updateCustomerNotes(params.id, input);
  }

  @Post(":id/anonymize")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Anonymize a customer and linked order PII" })
  @ApiBody({ schema: { type: "object", additionalProperties: false } })
  @ApiOkResponse({ type: CustomerResponseDto })
  anonymize(
    @Param(new ZodValidationPipe(customerIdParamSchema)) params: CustomerIdParam,
    @Body(new ZodValidationPipe(customerAnonymizeBodySchema)) _input: CustomerAnonymizeBody,
    @Req() request: RequestWithAuthenticatedUser,
  ) {
    return this.customersService.anonymizeCustomer(params.id, { id: request.user.userId, role: request.user.role });
  }
}

function setCsvHeaders(response: Response, filename: string): void {
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
}

function ApiCsvResponse(): MethodDecorator {
  return ApiResponse({
    content: { "text/csv": { schema: { format: "binary", type: "string" } } },
    description: "CSV export.",
    status: HttpStatus.OK,
  });
}
