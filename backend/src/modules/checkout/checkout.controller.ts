import { Body, Controller, Get, Header, Headers, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request, Response } from "express";

import type { AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { OptionalAuth } from "../../common/auth/optional-auth.decorator";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CHECKOUT_SESSION_HEADER, paymentResponseStatus } from "../payments/payments.controller";
import { ActivePaymentResponseDto, PaymentStatusResponseDto } from "../payments/payments.dto";
import { paymentSessionHeaderSchema } from "../payments/payments.schemas";
import type { PaymentStatusView } from "../payments/payment-status.service";
import { CheckoutCardPaymentService } from "./checkout-card-payment.service";
import {
  CheckoutCardPaymentRequestDto,
  CheckoutCompleteRequestDto,
  CheckoutCompleteResponseDto,
  CheckoutQuoteRequestDto,
  CheckoutQuoteResponseDto,
} from "./dto/checkout-openapi.dto";
import { CheckoutService, type CheckoutActorContext, type CheckoutQuoteResult } from "./checkout.service";
import {
  checkoutCardPaymentRequestSchema,
  checkoutCompleteRequestSchema,
  checkoutQuoteRequestSchema,
  type CheckoutCardPaymentRequest,
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
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly cardPaymentService: CheckoutCardPaymentService,
  ) {}

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

  @Post("payments/mercadopago")
  @ApiOperation({ summary: "Place an order and pay it with a tokenized card through Mercado Pago" })
  @ApiBody({ type: CheckoutCardPaymentRequestDto })
  @ApiCreatedResponse({ description: "Payment outcome is known.", type: PaymentStatusResponseDto })
  @ApiResponse({ description: "Payment outcome is still unresolved; poll the status endpoint.", status: HttpStatus.ACCEPTED, type: PaymentStatusResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: "UNAUTHORIZED or invalid checkout session.", type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: "ADMIN actors cannot use customer checkout ownership.", type: ApiErrorResponseDto })
  @ApiResponse({ description: "Stock, quote, idempotency-key reuse, or already-bound checkout session conflict.", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  async payWithCard(
    @Req() request: RequestWithOptionalUser,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodValidationPipe(checkoutCardPaymentRequestSchema)) input: CheckoutCardPaymentRequest,
  ): Promise<PaymentStatusView> {
    const view = await this.cardPaymentService.pay(input, this.actor(request));
    response.status(paymentResponseStatus(view));
    response.setHeader("Cache-Control", "no-store");
    return view;
  }

  @Get("payments/active")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Read the payment bound to the current checkout owner" })
  @ApiHeader({ name: CHECKOUT_SESSION_HEADER, required: false, description: "Guest checkout session credential." })
  @ApiOkResponse({ type: ActivePaymentResponseDto })
  @ApiUnauthorizedResponse({ description: "UNAUTHORIZED or invalid checkout session.", type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: "ADMIN actors cannot use customer checkout ownership.", type: ApiErrorResponseDto })
  async activePayment(
    @Req() request: RequestWithOptionalUser,
    @Headers(CHECKOUT_SESSION_HEADER) sessionHeader: string | undefined,
  ): Promise<{ active: PaymentStatusView | null; ok: true }> {
    const sessionToken = new ZodValidationPipe(paymentSessionHeaderSchema).transform(sessionHeader);
    return { active: await this.cardPaymentService.active(sessionToken, this.actor(request)), ok: true };
  }

  private actor(request: RequestWithOptionalUser): CheckoutActorContext | undefined {
    return request.user ? { role: request.user.role, userId: request.user.userId } : undefined;
  }
}
