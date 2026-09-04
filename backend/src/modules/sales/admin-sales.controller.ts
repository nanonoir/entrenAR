import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { JwtAuthGuard, type AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Role } from "../../generated/prisma/enums";
import { Roles } from "../auth/decorators/roles.decorator";
import { AddSaleNoteRequestDto, AdminSaleDetailResponseDto, AdminSaleListResponseDto, CancelSaleRequestDto, ConvertOrderToSaleRequestDto, CreateManualSaleRequestDto, ShipSaleRequestDto } from "./dto/sales-openapi.dto";
import { addSaleNoteSchema, archiveSaleSchema, cancelSaleSchema, confirmSaleSchema, convertOrderToSaleSchema, createManualSaleSchema, deliverSaleSchema, packSaleSchema, reopenSaleSchema, salesIdentifierSchema, salesListQuerySchema, shipSaleSchema, unarchiveSaleSchema, unpackSaleSchema, type AddSaleNote, type CancelSale, type ConvertOrderToSale, type CreateManualSale, type SalesListQuery, type ShipSale } from "./sales.schemas";
import { SalesService } from "./sales.service";

interface RequestWithAuthenticatedUser extends Request { user: AccessTokenPayload; }

@ApiTags("Admin Sales")
@ApiBearerAuth("access-token")
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
@ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
@Controller("admin/sales")
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminSalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @ApiOperation({ summary: "List sales for administration" })
  @ApiOkResponse({ type: AdminSaleListResponseDto })
  list(@Query(new ZodValidationPipe(salesListQuerySchema)) query: SalesListQuery) { return this.salesService.list(query); }

  @Get(":id")
  @ApiOperation({ summary: "Get an immutable sale detail and timeline" })
  @ApiOkResponse({ type: AdminSaleDetailResponseDto })
  get(@Param("id", new ZodValidationPipe(salesIdentifierSchema)) id: string) { return this.salesService.get(id); }

  @Post()
  @ApiOperation({ summary: "Create a manual sale" })
  @ApiBody({ type: CreateManualSaleRequestDto })
  @ApiCreatedResponse({ type: AdminSaleDetailResponseDto })
  create(@Body(new ZodValidationPipe(createManualSaleSchema)) input: CreateManualSale, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.createManualSale(input, actor(request)); }

  @Post("convert-order")
  @ApiOperation({ summary: "Convert a customer purchase-order draft into a sale" })
  @ApiBody({ type: ConvertOrderToSaleRequestDto })
  @ApiCreatedResponse({ type: AdminSaleDetailResponseDto })
  convertOrder(@Body(new ZodValidationPipe(convertOrderToSaleSchema)) input: ConvertOrderToSale, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.convertOrderToSale(input, actor(request)); }

  @Post(":id/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm a sale" })
  @ApiOkResponse({ type: AdminSaleDetailResponseDto })
  confirm(@Param("id", new ZodValidationPipe(salesIdentifierSchema)) id: string, @Body(new ZodValidationPipe(confirmSaleSchema)) _input: object, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.confirm(id, actor(request)); }

  @Post(":id/pack")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Pack a sale" })
  @ApiOkResponse({ type: AdminSaleDetailResponseDto })
  pack(@Param("id", new ZodValidationPipe(salesIdentifierSchema)) id: string, @Body(new ZodValidationPipe(packSaleSchema)) _input: object, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.pack(id, actor(request)); }

  @Post(":id/unpack")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Unpack a sale" })
  @ApiOkResponse({ type: AdminSaleDetailResponseDto })
  unpack(@Param("id", new ZodValidationPipe(salesIdentifierSchema)) id: string, @Body(new ZodValidationPipe(unpackSaleSchema)) _input: object, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.unpack(id, actor(request)); }

  @Post(":id/ship")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Ship a sale" })
  @ApiBody({ type: ShipSaleRequestDto })
  @ApiOkResponse({ type: AdminSaleDetailResponseDto })
  ship(@Param("id", new ZodValidationPipe(salesIdentifierSchema)) id: string, @Body(new ZodValidationPipe(shipSaleSchema)) input: ShipSale, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.ship(id, input, actor(request)); }

  @Post(":id/deliver")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a sale as delivered" })
  @ApiOkResponse({ type: AdminSaleDetailResponseDto })
  deliver(@Param("id", new ZodValidationPipe(salesIdentifierSchema)) id: string, @Body(new ZodValidationPipe(deliverSaleSchema)) _input: object, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.deliver(id, actor(request)); }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel a sale" })
  @ApiBody({ type: CancelSaleRequestDto })
  @ApiOkResponse({ type: AdminSaleDetailResponseDto })
  cancel(@Param("id", new ZodValidationPipe(salesIdentifierSchema)) id: string, @Body(new ZodValidationPipe(cancelSaleSchema)) input: CancelSale, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.cancelSale(id, input, actor(request)); }

  @Post(":id/reopen")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reopen a sale" })
  @ApiOkResponse({ type: AdminSaleDetailResponseDto })
  reopen(@Param("id", new ZodValidationPipe(salesIdentifierSchema)) id: string, @Body(new ZodValidationPipe(reopenSaleSchema)) _input: object, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.reopen(id, actor(request)); }

  @Post(":id/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Archive a sale" })
  @ApiOkResponse({ type: AdminSaleDetailResponseDto })
  archive(@Param("id", new ZodValidationPipe(salesIdentifierSchema)) id: string, @Body(new ZodValidationPipe(archiveSaleSchema)) _input: object, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.archive(id, actor(request)); }

  @Post(":id/unarchive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Unarchive a sale" })
  @ApiOkResponse({ type: AdminSaleDetailResponseDto })
  unarchive(@Param("id", new ZodValidationPipe(salesIdentifierSchema)) id: string, @Body(new ZodValidationPipe(unarchiveSaleSchema)) _input: object, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.unarchive(id, actor(request)); }

  @Post(":id/notes")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Add an internal sale note" })
  @ApiBody({ type: AddSaleNoteRequestDto })
  @ApiOkResponse({ type: AdminSaleDetailResponseDto })
  addNote(@Param("id", new ZodValidationPipe(salesIdentifierSchema)) id: string, @Body(new ZodValidationPipe(addSaleNoteSchema)) input: AddSaleNote, @Req() request: RequestWithAuthenticatedUser) { return this.salesService.addNote(id, input, actor(request)); }
}

function actor(request: RequestWithAuthenticatedUser) { return { id: request.user.userId, role: request.user.role }; }
