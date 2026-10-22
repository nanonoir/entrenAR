import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  Headers,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";

import { Public } from "../../../common/auth/public.decorator";
import type { AppConfig } from "../../../config/app.config";
import { ERROR_CODE } from "../../../common/errors/api-error.response";
import { PaymentNotificationProcessorService } from "../payment-notification-processor.service";
import { PaymentNotificationService, isWebhookTopic } from "../payment-notification.service";
import { verifyMercadoPagoWebhookSignature } from "./mercadopago-webhook.signature";

export const WEBHOOK_MAX_BODY_BYTES = 16 * 1_024;
const WEBHOOK_MAX_QUERY_KEYS = 10;

@ApiTags("Payments")
@Controller("payments/mercadopago/webhooks")
@Public()
@SkipThrottle()
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly notifications: PaymentNotificationService,
    private readonly processor: PaymentNotificationProcessorService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mercado Pago signed webhook receiver (public, signature-authenticated)" })
  @ApiResponse({ description: "Notification accepted or already received.", status: HttpStatus.OK })
  @ApiResponse({ description: "Invalid, stale or malformed signature.", status: HttpStatus.UNAUTHORIZED })
  @ApiResponse({ description: "Integration not configured or inbox unavailable.", status: HttpStatus.SERVICE_UNAVAILABLE })
  async receive(
    @Req() request: Request,
    @Headers("x-signature") signature: unknown,
    @Headers("x-request-id") requestId: unknown,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    const config = this.configService.get("mercadoPago", { infer: true });
    if (!config) throw this.unavailable("Payments integration is not configured.");

    const contentLength = Number(request.headers["content-length"] ?? 0);
    if (!Number.isFinite(contentLength) || contentLength > WEBHOOK_MAX_BODY_BYTES) {
      throw new PayloadTooLargeException({ code: ERROR_CODE.VALIDATION_ERROR, message: "Payload too large.", ok: false });
    }

    const query = request.query as Record<string, unknown>;
    const verification = Object.keys(query).length > WEBHOOK_MAX_QUERY_KEYS
      ? ({ ok: false, reason: "malformed" } as const)
      : verifyMercadoPagoWebhookSignature({
          dataId: query["data.id"],
          nowMs: Date.now(),
          requestId,
          secret: config.webhookSecret,
          signatureHeader: signature,
        });
    if (!verification.ok) {
      this.logger.warn(JSON.stringify({ event: "mercadopago_webhook_rejected", reason: verification.reason }));
      throw new UnauthorizedException({ code: ERROR_CODE.UNAUTHORIZED, message: "Invalid webhook signature.", ok: false });
    }

    const topic = asTopic(query["type"] ?? query["topic"]);
    if (!topic) {
      // Authenticated but not a topic this integration handles: acknowledge so the provider does not retry it.
      return { ok: true };
    }

    let accepted: { duplicate: boolean; id: string };
    try {
      accepted = await this.notifications.accept({
        body,
        environment: config.environment,
        requestId: requestId as string,
        resourceId: query["data.id"] as string,
        timestampMs: verification.timestampMs,
        topic,
      });
    } catch {
      this.logger.error(JSON.stringify({ event: "mercadopago_webhook_inbox_failed" }));
      throw this.unavailable("Notification could not be stored.");
    }

    if (!accepted.duplicate) this.processor.scheduleProcessing(accepted.id);
    return { ok: true };
  }

  private unavailable(message: string): ServiceUnavailableException {
    return new ServiceUnavailableException({ code: ERROR_CODE.SERVICE_UNAVAILABLE, message, ok: false });
  }
}

/** Mercado Pago sends the topic in the query (`type=order`); the unsigned body is never consulted. */
function asTopic(value: unknown) {
  return isWebhookTopic(value) ? value : undefined;
}
