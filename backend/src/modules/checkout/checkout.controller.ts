import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";

import type { AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { OptionalAuth } from "../../common/auth/optional-auth.decorator";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CheckoutCompleteRequestDto,
  CheckoutCompleteResponseDto,
  CheckoutQuoteRequestDto,
  CheckoutQuoteResponseDto,
} from "./dto/checkout-openapi.dto";
import { CheckoutService, type CheckoutActorContext, type CheckoutQuoteResult } from "./checkout.service";
import {
  checkoutCompleteRequestSchema,
  checkoutQuoteRequestSchema,
  type CheckoutCompleteRequest,
  type CheckoutQuoteRequest,
} from "./checkout.schemas";

interface RequestWithOptionalUser extends Request {
  user?: AccessTokenPayload;
}

@ApiTags("Checkout")
@ApiBearerAuth("access-token")
@Controller("checkout")
@OptionalAuth()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post("quote")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Calculate a server-authoritative checkout quote" })
  @ApiBody({ type: CheckoutQuoteRequestDto })
  @ApiOkResponse({ description: "Server-calculated checkout totals and eligible commerce options.", type: CheckoutQuoteResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: "UNAUTHORIZED or invalid checkout session.", type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: "ADMIN actors cannot use customer checkout ownership.", type: ApiErrorResponseDto })
  async quote(
    @Req() request: RequestWithOptionalUser,
    @Body(new ZodValidationPipe(checkoutQuoteRequestSchema)) input: CheckoutQuoteRequest,
  ): Promise<CheckoutQuoteResult> {
    return this.checkoutService.quote(input, this.actor(request));
  }

  @Post("complete")
  @ApiOperation({ summary: "Atomically place a pending checkout order" })
  @ApiBody({ type: CheckoutCompleteRequestDto })
  @ApiCreatedResponse({ description: "Pending order created and checkout state finalized.", type: CheckoutCompleteResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: "UNAUTHORIZED or invalid checkout session.", type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: "ADMIN actors cannot use customer checkout ownership.", type: ApiErrorResponseDto })
  @ApiResponse({ description: "Controlled stock, payment, shipping, coupon, or stale-quote conflict.", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  async complete(
    @Req() request: RequestWithOptionalUser,
    @Body(new ZodValidationPipe(checkoutCompleteRequestSchema)) input: CheckoutCompleteRequest,
  ) {
    return this.checkoutService.complete(input, this.actor(request));
  }

  private actor(request: RequestWithOptionalUser): CheckoutActorContext | undefined {
    return request.user ? { role: request.user.role, userId: request.user.userId } : undefined;
  }
}
