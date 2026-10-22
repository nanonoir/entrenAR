import { ConflictException, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PaymentAttemptStatus, PaymentProvider, type Role } from "../../generated/prisma/enums";
import { MERCADOPAGO_ORDERS_PORT, type MercadoPagoOrder, type MercadoPagoOrdersPort } from "./mercadopago/mercadopago-orders.port";
import { PaymentReconciliationService } from "./payment-reconciliation.service";
import { PAYMENT_THRESHOLDS } from "./payment-reconcile.cadence";
import { PaymentReducerService } from "./payment-reducer.service";
import { PaymentsRepository } from "./payments.repository";

export type UnknownResolutionOutcome = "order_cancelled" | "payment_updated";

export interface UnknownResolutionActor {
  id?: string | undefined;
  role: Role;
}

/**
 * Admin resolution of an UNKNOWN Mercado Pago attempt. The provider is always re-checked first (outside any
 * transaction); stock is only released when that check succeeds and proves no order exists, and the cancellation is
 * decided under the order/payment lock by the reducer. A failed check changes nothing.
 */
@Injectable()
export class PaymentUnknownResolutionService {
  private readonly logger = new Logger(PaymentUnknownResolutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PaymentsRepository,
    private readonly reconciliation: PaymentReconciliationService,
    private readonly reducer: PaymentReducerService,
    @Inject(MERCADOPAGO_ORDERS_PORT) private readonly port: MercadoPagoOrdersPort,
  ) {}

  async resolve(orderId: string, actor: UnknownResolutionActor): Promise<UnknownResolutionOutcome> {
    const attempt = await this.prisma.paymentAttempt.findFirst({
      select: { id: true, payment: { select: { attentionRequiredAt: true } }, providerOrderId: true, reconcileFence: true, submittedAt: true },
      where: { payment: { orderId, provider: PaymentProvider.MERCADOPAGO }, status: PaymentAttemptStatus.UNKNOWN },
    });
    if (!attempt) throw conflict("The order has no Mercado Pago attempt with an unknown outcome to resolve.");

    const now = await this.repository.databaseNow();
    const old = attempt.submittedAt.getTime() <= now.getTime() - PAYMENT_THRESHOLDS.unknownAttentionMs;
    if (!attempt.payment.attentionRequiredAt && !old) {
      throw conflict("The payment outcome is still being verified automatically; it can be resolved manually after 30 minutes.");
    }

    let observation: MercadoPagoOrder | null = null;
    let absent = false;
    try {
      if (attempt.providerOrderId) {
        observation = await this.port.getOrder(attempt.providerOrderId);
      } else {
        const located = await this.reconciliation.locateProviderOrder(attempt.id);
        if (located.kind === "found") observation = await this.port.getOrder(located.providerOrderId);
        else if (located.kind === "absent") absent = true;
        else throw conflict("Mercado Pago returned orders that cannot be safely matched to this attempt; review them in the Mercado Pago panel.");
      }
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.warn(JSON.stringify({ attemptId: attempt.id, event: "payment_unknown_resolution_check_failed", error: error instanceof Error ? error.name : "unknown" }));
      throw new ServiceUnavailableException({
        code: ERROR_CODE.SERVICE_UNAVAILABLE,
        message: "Mercado Pago could not be checked right now. Nothing was changed; try again shortly.",
        ok: false,
      });
    }

    if (observation) {
      const applied = await this.reducer.applyObservation(attempt.id, observation, attempt.reconcileFence);
      if (applied.stale) throw conflict("The payment was being reconciled at the same time. Reload the sale and try again.");
      return "payment_updated";
    }

    if (!absent) throw conflict("The payment outcome could not be determined.");
    const cancelled = await this.reducer.cancelUncreated(attempt.id, "unknown_outcome_resolved_by_admin", {
      actor,
      orderReason: "Payment outcome could not be confirmed",
      requireUnknown: true,
    });
    if (cancelled.decision === "ignore") throw conflict("The payment attempt changed while it was being resolved. Reload the sale and try again.");
    return "order_cancelled";
  }
}

function conflict(message: string): ConflictException {
  return new ConflictException({ code: ERROR_CODE.CONFLICT, message, ok: false });
}
