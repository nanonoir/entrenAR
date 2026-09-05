import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import { JwtAuthGuard, type AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Role } from "../../generated/prisma/enums";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  AbandonedCartActionResponseDto,
  AbandonedCartItemSummaryDto,
  AbandonedCartDetailResponseDto,
  AbandonedCartListQueryDto,
  AbandonedCartListResponseDto,
  ConvertCartRequestDto,
  DiscardCartRequestDto,
  ManualRecoveryRequestDto,
  RecoveryConfigResponseDto,
  RecoveryTemplateResponseDto,
  SendRecoveryEmailRequestDto,
  UpdateRecoveryConfigRequestDto,
  UpdateRecoveryTemplateRequestDto,
} from "./dto/abandoned-carts-openapi.dto";
import {
  abandonedCartIdParamSchema,
  abandonedCartListQuerySchema,
  convertCartSchema,
  discardCartSchema,
  manualRecoverySchema,
  sendRecoveryEmailSchema,
  updateRecoveryConfigSchema,
  updateRecoveryTemplateSchema,
  type AbandonedCartIdParam,
  type AbandonedCartListQuery,
  type ConvertCartInput,
  type DiscardCartInput,
  type ManualRecoveryInput,
  type SendRecoveryEmailInput,
  type UpdateRecoveryConfigInput,
  type UpdateRecoveryTemplateInput,
} from "./abandoned-carts.schemas";
import { AbandonedCartsService } from "./abandoned-carts.service";

interface RequestWithAuthenticatedUser extends Request {
  user: AccessTokenPayload;
}

@ApiTags("Admin Abandoned Carts")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "UNAUTHORIZED", type: ApiErrorResponseDto })
@ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
@ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
@ApiConflictResponse({ description: "CONFLICT", type: ApiErrorResponseDto })
@ApiNotFoundResponse({ description: "NOT_FOUND", type: ApiErrorResponseDto })
@Controller("admin/abandoned-carts")
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminAbandonedCartsController {
  constructor(private readonly abandonedCartsService: AbandonedCartsService) {}

  @Get()
  @ApiOperation({ summary: "List abandoned carts for administration" })
  @ApiQuery({ type: AbandonedCartListQueryDto, required: false })
  @ApiOkResponse({ type: AbandonedCartListResponseDto })
  list(@Query(new ZodValidationPipe(abandonedCartListQuerySchema)) query: AbandonedCartListQuery) {
    return this.abandonedCartsService.listAbandonedCarts(query);
  }

  // Static routes must precede /:id so config and template are not parsed as cart IDs.
  @Get("config")
  @ApiOperation({ summary: "Get abandoned-cart recovery configuration" })
  @ApiOkResponse({ type: RecoveryConfigResponseDto })
  getConfig() {
    return this.abandonedCartsService.getRecoveryConfig();
  }

  @Put("config")
  @ApiOperation({ summary: "Update abandoned-cart recovery configuration" })
  @ApiBody({ type: UpdateRecoveryConfigRequestDto })
  @ApiOkResponse({ type: RecoveryConfigResponseDto })
  updateConfig(@Body(new ZodValidationPipe(updateRecoveryConfigSchema)) input: UpdateRecoveryConfigInput) {
    return this.abandonedCartsService.updateRecoveryConfig(input);
  }

  @Get("template")
  @ApiOperation({ summary: "Get the abandoned-cart recovery email template" })
  @ApiOkResponse({ type: RecoveryTemplateResponseDto })
  getTemplate() {
    return this.abandonedCartsService.getRecoveryTemplate();
  }

  @Put("template")
  @ApiOperation({ summary: "Update the abandoned-cart recovery email template" })
  @ApiBody({ type: UpdateRecoveryTemplateRequestDto })
  @ApiOkResponse({ type: RecoveryTemplateResponseDto })
  updateTemplate(@Body(new ZodValidationPipe(updateRecoveryTemplateSchema)) input: UpdateRecoveryTemplateInput) {
    return this.abandonedCartsService.updateRecoveryTemplate(input);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an abandoned-cart detail and recovery timeline" })
  @ApiOkResponse({ type: AbandonedCartDetailResponseDto })
  get(@Param(new ZodValidationPipe(abandonedCartIdParamSchema)) params: AbandonedCartIdParam) {
    return this.abandonedCartsService.getAbandonedCartById(params.id);
  }

  @Post(":id/email")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send a simulated recovery email" })
  @ApiBody({ type: SendRecoveryEmailRequestDto, required: false })
  @ApiOkResponse({ type: AbandonedCartActionResponseDto })
  async sendRecoveryEmail(
    @Param(new ZodValidationPipe(abandonedCartIdParamSchema)) params: AbandonedCartIdParam,
    @Body(new ZodValidationPipe(sendRecoveryEmailSchema)) input: SendRecoveryEmailInput,
    @Req() request: RequestWithAuthenticatedUser,
  ): Promise<AbandonedCartActionResponseDto> {
    const result = await this.abandonedCartsService.sendRecoveryEmail(params.id, input, request.user.userId, request.user.role);
    return this.toActionResponse(result.cart);
  }

  @Post(":id/manual")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Record manual customer contact" })
  @ApiBody({ type: ManualRecoveryRequestDto, required: false })
  @ApiOkResponse({ type: AbandonedCartActionResponseDto })
  async markManualRecovery(
    @Param(new ZodValidationPipe(abandonedCartIdParamSchema)) params: AbandonedCartIdParam,
    @Body(new ZodValidationPipe(manualRecoverySchema)) input: ManualRecoveryInput,
    @Req() request: RequestWithAuthenticatedUser,
  ): Promise<AbandonedCartActionResponseDto> {
    const detail = await this.abandonedCartsService.markManualRecovery(params.id, input, request.user.userId, request.user.role);
    return this.toActionResponse(detail);
  }

  @Post(":id/convert")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Convert an abandoned cart into a pending order" })
  @ApiBody({ type: ConvertCartRequestDto, required: false })
  @ApiOkResponse({ type: AbandonedCartActionResponseDto })
  async convert(
    @Param(new ZodValidationPipe(abandonedCartIdParamSchema)) params: AbandonedCartIdParam,
    @Body(new ZodValidationPipe(convertCartSchema)) input: ConvertCartInput,
    @Req() request: RequestWithAuthenticatedUser,
  ): Promise<AbandonedCartActionResponseDto> {
    const detail = await this.abandonedCartsService.convertAbandonedCart(params.id, input, request.user.userId, request.user.role);
    return this.toActionResponse(detail, detail.orderId);
  }

  @Post(":id/discard")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Discard an abandoned cart" })
  @ApiBody({ type: DiscardCartRequestDto })
  @ApiOkResponse({ type: AbandonedCartActionResponseDto })
  async discard(
    @Param(new ZodValidationPipe(abandonedCartIdParamSchema)) params: AbandonedCartIdParam,
    @Body(new ZodValidationPipe(discardCartSchema)) input: DiscardCartInput,
    @Req() request: RequestWithAuthenticatedUser,
  ): Promise<AbandonedCartActionResponseDto> {
    const detail = await this.abandonedCartsService.discardAbandonedCart(params.id, input, request.user.userId, request.user.role);
    return this.toActionResponse(detail);
  }

  private toActionResponse(
    detail: AbandonedCartDetailResponseDto,
    orderId?: string,
  ): AbandonedCartActionResponseDto {
    const cart: AbandonedCartItemSummaryDto = {
      abandonedAt: detail.abandonedAt,
      customer: detail.customer,
      id: detail.id,
      ...(detail.lastEmailSentAt === undefined ? {} : { lastEmailSentAt: detail.lastEmailSentAt }),
      products: detail.products,
      recoveryStatus: detail.recoveryStatus,
      total: detail.total,
    };

    return {
      cart,
      ...(orderId ? { orderId } : {}),
      recoveryLink: detail.recoveryLink ?? null,
    };
  }
}
