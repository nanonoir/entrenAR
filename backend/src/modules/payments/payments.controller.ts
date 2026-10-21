import { Body, Controller, Get, Header, Headers, HttpStatus, Param, Post, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
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
import { PaymentRetryService } from "./payment-retry.service";
import { PaymentStatusService, type PaymentOwner, type PaymentStatusView } from "./payment-status.service";
import { PaymentRetryRequestDto, PaymentStatusResponseDto } from "./payments.dto";
import {
  paymentOrderIdSchema,
  paymentRetryRequestSchema,
  paymentSessionHeaderSchema,
  type PaymentRetryRequest,
} from "./payments.schemas";
import { PaymentAttemptStatus } from "../../generated/prisma/enums";

export const CHECKOUT_SESSION_HEADER = "x-checkout-session";

interface RequestWithOptionalUser extends Request {
  user?: AccessTokenPayload;
}

export function paymentOwner(request: RequestWithOptionalUser, sessionToken: string | undefined): PaymentOwner {
  return {
    ...(request.user ? { role: request.user.role, userId: request.user.userId } : {}),
    ...(sessionToken ? { sessionToken } : {}),
  };
}

/** HTTP status for a payment placement: 201 when the outcome is known, 202 while it is unresolved. */
export function paymentResponseStatus(view: PaymentStatusView): HttpStatus {
  const status = view.attempt?.status;
  const unresolved = status === PaymentAttemptStatus.SUBMITTING.toLowerCase()
    || status === PaymentAttemptStatus.UNKNOWN.toLowerCase();
  return unresolved ? HttpStatus.ACCEPTED : HttpStatus.CREATED;
}

@ApiTags("Payments")
@ApiBearerAuth("access-token")
@Controller("payments")
@OptionalAuth()
export class PaymentsController {
  constructor(
    private readonly statusService: PaymentStatusService,
    private readonly retryService: PaymentRetryService,
  ) {}

  @Get("orders/:orderId")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Read the normalized payment status of an owned order" })
  @ApiHeader({ name: CHECKOUT_SESSION_HEADER, required: false, description: "Guest checkout session credential." })
  @ApiOkResponse({ type: PaymentStatusResponseDto })
  @ApiUnauthorizedResponse({ description: "UNAUTHORIZED or invalid checkout session.", type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: "ADMIN actors cannot read customer payments.", type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: "Unknown order or not owned by the caller.", type: ApiErrorResponseDto })
  async status(
    @Req() request: RequestWithOptionalUser,
    @Param("orderId", new ZodValidationPipe(paymentOrderIdSchema)) orderId: string,
    @Headers(CHECKOUT_SESSION_HEADER) sessionHeader: string | undefined,
  ): Promise<PaymentStatusView> {
    const sessionToken = new ZodValidationPipe(paymentSessionHeaderSchema).transform(sessionHeader);
    return this.statusService.statusForOrder(orderId, paymentOwner(request, sessionToken));
  }

  @Post("orders/:orderId/attempts")
  @ApiOperation({ summary: "Retry a rejected card payment inside the retry window" })
  @ApiBody({ type: PaymentRetryRequestDto })
  @ApiCreatedResponse({ description: "Attempt outcome is known.", type: PaymentStatusResponseDto })
  @ApiResponse({ description: "Attempt outcome is still unresolved.", status: HttpStatus.ACCEPTED, type: PaymentStatusResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: "UNAUTHORIZED or invalid checkout session.", type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: "ADMIN actors cannot retry customer payments.", type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: "Unknown order or not owned by the caller.", type: ApiErrorResponseDto })
  @ApiResponse({ description: "Retry is not available or the idempotency key was reused.", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  async retry(
    @Req() request: RequestWithOptionalUser,
    @Res({ passthrough: true }) response: Response,
    @Param("orderId", new ZodValidationPipe(paymentOrderIdSchema)) orderId: string,
    @Body(new ZodValidationPipe(paymentRetryRequestSchema)) input: PaymentRetryRequest,
  ): Promise<PaymentStatusView> {
    const owner = paymentOwner(request, input.sessionToken);
    const view = await this.retryService.retry({
      card: input.card,
      clientKey: input.idempotencyKey,
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
      orderId,
      owner,
    });
    response.status(paymentResponseStatus(view));
    response.setHeader("Cache-Control", "no-store");
    return view;
  }
}
