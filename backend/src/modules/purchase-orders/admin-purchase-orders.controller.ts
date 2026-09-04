import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { JwtAuthGuard, type AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Role } from "../../generated/prisma/enums";
import { Roles } from "../auth/decorators/roles.decorator";
import { PurchaseOrderListResponseDto, PurchaseOrderRequestDto, PurchaseOrderResponseDto } from "./dto/purchase-orders-openapi.dto";
import { purchaseOrderCommandSchema, createPurchaseOrderSchema, purchaseOrderFilterQuerySchema, purchaseOrderIdentifierSchema, updatePurchaseOrderSchema, type CreatePurchaseOrderDto, type PurchaseOrderFilterQueryDto, type UpdatePurchaseOrderDto } from "./purchase-orders.schemas";
import { PurchaseOrdersService } from "./purchase-orders.service";

interface RequestWithAuthenticatedUser extends Request { user: AccessTokenPayload; }

@ApiTags("Admin Purchase Orders")
@ApiBearerAuth("access-token")
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
@ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
@Controller("admin/purchase-orders")
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @ApiOperation({ summary: "List supplier purchase orders" })
  @ApiOkResponse({ type: PurchaseOrderListResponseDto })
  list(@Query(new ZodValidationPipe(purchaseOrderFilterQuerySchema)) query: PurchaseOrderFilterQueryDto) { return this.purchaseOrdersService.list(query); }

  @Get(":id")
  @ApiOperation({ summary: "Get a supplier purchase order" })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  get(@Param("id", new ZodValidationPipe(purchaseOrderIdentifierSchema)) id: string) { return this.purchaseOrdersService.get(id); }

  @Post()
  @ApiOperation({ summary: "Create a supplier purchase order" })
  @ApiBody({ type: PurchaseOrderRequestDto })
  @ApiCreatedResponse({ type: PurchaseOrderResponseDto })
  create(@Body(new ZodValidationPipe(createPurchaseOrderSchema)) input: CreatePurchaseOrderDto) { return this.purchaseOrdersService.create(input); }

  @Put(":id")
  @ApiOperation({ summary: "Update a draft supplier purchase order" })
  @ApiBody({ type: PurchaseOrderRequestDto })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  update(@Param("id", new ZodValidationPipe(purchaseOrderIdentifierSchema)) id: string, @Body(new ZodValidationPipe(updatePurchaseOrderSchema)) input: UpdatePurchaseOrderDto) { return this.purchaseOrdersService.update(id, input); }

  @Post(":id/submit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Submit a supplier purchase order" })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  submit(@Param("id", new ZodValidationPipe(purchaseOrderIdentifierSchema)) id: string, @Body(new ZodValidationPipe(purchaseOrderCommandSchema)) input: object) { void input; return this.purchaseOrdersService.submit(id); }

  @Post(":id/receive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Receive a supplier purchase order and increase stock" })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  receive(@Param("id", new ZodValidationPipe(purchaseOrderIdentifierSchema)) id: string, @Body(new ZodValidationPipe(purchaseOrderCommandSchema)) _input: object, @Req() request: RequestWithAuthenticatedUser) { return this.purchaseOrdersService.receive(id, { id: request.user.userId }); }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel a supplier purchase order" })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  cancel(@Param("id", new ZodValidationPipe(purchaseOrderIdentifierSchema)) id: string, @Body(new ZodValidationPipe(purchaseOrderCommandSchema)) input: object) { void input; return this.purchaseOrdersService.cancel(id); }
}
