import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

import { PaymentAttemptStatus } from "../../generated/prisma/enums";
import {
  MERCADOPAGO_ERROR_CATEGORY,
  MERCADOPAGO_ORDERS_PORT,
  MercadoPagoOrdersError,
  type MercadoPagoOrder,
  type MercadoPagoOrdersPort,
} from "./mercadopago/mercadopago-orders.port";
import { sanitizeChallengeUrl, type PaymentCardInput } from "./payment-card";
import { PaymentCircuitService } from "./payment-circuit.service";
import { PaymentReducerService, type PaymentApplyResult } from "./payment-reducer.service";
import { buildCreateOrderRequest, moneyString } from "./payment-request.builder";
import { normalizeProviderStatus } from "./payment-status.normalizer";
import { PaymentsRepository } from "./payments.repository";

export const PAYMENT_DISPATCH_SLEEP = Symbol("PAYMENT_DISPATCH_SLEEP");
/** Kept at 1 until provider idempotency retention is verified in the sandbox (Stage 7); raise it afterwards. */
export const PAYMENT_CREATE_MAX_CALLS = 1;
export const PAYMENT_CREATE_BUDGET_MS = 25_000;
const RETRY_JITTER_MIN_MS = 500;
const RETRY_JITTER_SPREAD_MS = 500;

export type PaymentSleeper = (milliseconds: number) => Promise<void>;

export interface PaymentDispatchInput {
  attemptId: string;
  card: PaymentCardInput;
  deviceId?: string;
}

/** Applied outcome plus the sanitized 3DS challenge URL from the create response, so callers can skip a redundant GET. */
export type PaymentDispatchOutcome = PaymentApplyResult & { challengeUrl?: string };

/** Statuses that must be confirmed with an authoritative GET before they are applied. */
const SELF_APPLIED_STATUSES: ReadonlySet<PaymentAttemptStatus> = new Set([
  PaymentAttemptStatus.PROCESSING,
  PaymentAttemptStatus.ACTION_REQUIRED,
  PaymentAttemptStatus.SUBMITTING,
  PaymentAttemptStatus.UNKNOWN,
]);

/**
 * Sends a placed attempt to Mercado Pago after the placement transaction committed. No database transaction or lock is
 * held across HTTP, retries reuse the same provider idempotency key and body, and an uncertain outcome never rejects.
 */
@Injectable()
export class PaymentDispatchService {
  private readonly logger = new Logger(PaymentDispatchService.name);
  private readonly sleep: PaymentSleeper;

  constructor(
    @Inject(MERCADOPAGO_ORDERS_PORT) private readonly port: MercadoPagoOrdersPort,
    private readonly reducer: PaymentReducerService,
    private readonly repository: PaymentsRepository,
    private readonly circuit: PaymentCircuitService,
    @Optional() @Inject(PAYMENT_DISPATCH_SLEEP) sleeper?: PaymentSleeper,
  ) {
    this.sleep = sleeper ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  /** Returns the applied outcome; `null` when the attempt was no longer waiting to be submitted. */
  async dispatch(input: PaymentDispatchInput): Promise<PaymentDispatchOutcome | null> {
    const context = await this.repository.dispatchContext(input.attemptId);
    if (!context || context.status !== PaymentAttemptStatus.SUBMITTING) return null;

    const order = context.payment.order;
    const expectedAmount = moneyString(context.expectedAmount);
    const request = buildCreateOrderRequest(
      {
        customerEmail: order.customerEmail,
        customerFirstName: order.customerFirstName,
        customerLastName: order.customerLastName,
        expectedAmount,
        items: order.items,
        orderId: order.id,
      },
      input.card,
      input.deviceId,
    );

    let created: MercadoPagoOrder;
    try {
      created = await this.createWithRetry(request, context.providerIdempotencyKey);
    } catch (error) {
      return this.resolveCreateFailure(input.attemptId, error);
    }

    const applied = await this.applyCreated(input.attemptId, created, expectedAmount);
    const challengeUrl = applied.attemptStatus === PaymentAttemptStatus.ACTION_REQUIRED
      ? sanitizeChallengeUrl(created.transactions[0]?.transactionSecurityUrl)
      : undefined;
    return challengeUrl ? { ...applied, challengeUrl } : applied;
  }

  private async createWithRetry(
    request: ReturnType<typeof buildCreateOrderRequest>,
    idempotencyKey: string,
  ): Promise<MercadoPagoOrder> {
    const startedAt = Date.now();

    for (let call = 1; ; call += 1) {
      try {
        return await this.port.createOrder(request, idempotencyKey);
      } catch (error) {
        const delay = this.retryDelay(error, call, startedAt);
        if (delay === undefined) throw error;
        await this.sleep(delay);
      }
    }
  }

  private retryDelay(error: unknown, call: number, startedAt: number): number | undefined {
    if (call >= PAYMENT_CREATE_MAX_CALLS || !(error instanceof MercadoPagoOrdersError)) return undefined;
    if (error.category !== MERCADOPAGO_ERROR_CATEGORY.TRANSIENT && error.category !== MERCADOPAGO_ERROR_CATEGORY.RATE_LIMIT) {
      return undefined;
    }

    const jitter = RETRY_JITTER_MIN_MS + Math.floor(Math.random() * RETRY_JITTER_SPREAD_MS);
    const delay = error.retryAfterSeconds === undefined ? jitter : Math.max(jitter, error.retryAfterSeconds * 1_000);
    return Date.now() - startedAt + delay <= PAYMENT_CREATE_BUDGET_MS ? delay : undefined;
  }

  private async resolveCreateFailure(attemptId: string, error: unknown): Promise<PaymentApplyResult> {
    if (error instanceof MercadoPagoOrdersError && !error.outcomeUncertain) {
      switch (error.category) {
        case MERCADOPAGO_ERROR_CATEGORY.VALIDATION:
          return this.reducer.rejectWithoutCharge(attemptId, `provider_${error.category}`);
        case MERCADOPAGO_ERROR_CATEGORY.AUTH:
          // Our credentials/configuration failed: not a card rejection. No order exists at the provider.
          this.circuit.open();
          this.logger.error(JSON.stringify({
            attemptId,
            category: error.category,
            event: "mercadopago_auth_failure",
            httpStatus: error.httpStatus ?? null,
            providerCode: error.providerCode ?? null,
          }));
          return this.reducer.cancelUncreated(attemptId, `provider_${error.category}`);
        case MERCADOPAGO_ERROR_CATEGORY.RATE_LIMIT:
          return this.reducer.rejectWithoutCharge(attemptId, "rate_limited");
        case MERCADOPAGO_ERROR_CATEGORY.CONFLICT:
          return this.reducer.markUnknown(attemptId, { attentionReason: "idempotency_conflict", lastError: "provider_conflict" });
        default:
          break;
      }
    }

    return this.reducer.markUnknown(attemptId, { lastError: errorLabel(error) });
  }

  private async applyCreated(attemptId: string, created: MercadoPagoOrder, expectedAmount: string): Promise<PaymentApplyResult> {
    const outcome = normalizeProviderStatus({ order: created, paidAmount: expectedAmount });
    if (SELF_APPLIED_STATUSES.has(outcome.attemptStatus) && outcome.attemptStatus !== PaymentAttemptStatus.UNKNOWN) {
      return this.reducer.applyObservation(attemptId, created);
    }

    const transaction = created.transactions[0];
    const ids = { providerOrderId: created.id, ...(transaction ? { providerTransactionId: transaction.id } : {}) };
    let verified: MercadoPagoOrder;
    try {
      verified = await this.port.getOrder(created.id);
    } catch {
      return this.reducer.markUnknown(attemptId, { ...ids, lastError: "verification_failed" });
    }

    return this.reducer.applyObservation(attemptId, verified);
  }
}

function errorLabel(error: unknown): string {
  if (error instanceof MercadoPagoOrdersError) return `provider_${error.category}`;
  return "dispatch_failed";
}
