import { ConflictException, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentStatus,
} from "../../generated/prisma/enums";
import { cardTokenDigest, type PaymentCardInput } from "./payment-card";
import { PaymentDispatchService } from "./payment-dispatch.service";
import { isUnsettledAttempt } from "./payment-reducer";
import { PaymentStatusService, type PaymentOwner, type PaymentStatusView } from "./payment-status.service";
import { PaymentsTransaction, databaseNow, lockOrderAndPayment } from "./payments-transaction";
import { moneyString } from "./payment-request.builder";

export interface PaymentRetryInput {
  card: PaymentCardInput;
  clientKey: string;
  deviceId?: string;
  orderId: string;
  owner: PaymentOwner;
}

/** Creates a new attempt inside the 10-minute rejected-retry window, serialized with expiry by the order/payment locks. */
@Injectable()
export class PaymentRetryService {
  constructor(
    private readonly transactions: PaymentsTransaction,
    private readonly status: PaymentStatusService,
    private readonly dispatcher: PaymentDispatchService,
  ) {}

  async retry(input: PaymentRetryInput): Promise<PaymentStatusView> {
    await this.status.assertOwnedOrder(input.orderId, input.owner);

    const requestHash = retryRequestHash(input);
    const placed = await this.transactions.run(async (transaction) => {
      await lockOrderAndPayment(transaction, input.orderId);
      const now = await databaseNow(transaction);
      const order = await transaction.order.findUniqueOrThrow({ where: { id: input.orderId } });
      const payment = await transaction.orderPayment.findUniqueOrThrow({ where: { orderId: input.orderId } });

      const replay = await transaction.paymentAttempt.findUnique({
        where: { paymentId_clientKey: { clientKey: input.clientKey, paymentId: payment.id } },
      });
      if (replay) {
        if (replay.requestHash !== requestHash) throw this.keyReused();
        return { attemptId: replay.id, created: false };
      }

      const latest = await transaction.paymentAttempt.findFirst({
        orderBy: { attemptNumber: "desc" },
        where: { paymentId: payment.id },
      });
      const unsettled = await transaction.paymentAttempt.count({
        where: { paymentId: payment.id, status: { in: [PaymentAttemptStatus.SUBMITTING, PaymentAttemptStatus.UNKNOWN, PaymentAttemptStatus.PROCESSING, PaymentAttemptStatus.ACTION_REQUIRED] } },
      });
      const eligible = order.status === OrderStatus.PENDING
        && payment.provider === PaymentProvider.MERCADOPAGO
        && payment.status === PaymentStatus.PENDING
        && latest?.status === PaymentAttemptStatus.REJECTED
        && !isUnsettledAttempt(latest.status)
        && unsettled === 0
        && payment.retryUntil !== null
        && now < payment.retryUntil;
      if (!eligible || !latest) throw this.unavailable();

      const attempt = await transaction.paymentAttempt.create({
        data: {
          attemptNumber: latest.attemptNumber + 1,
          clientKey: input.clientKey,
          currency: payment.currency,
          expectedAmount: moneyString(payment.amount),
          paymentId: payment.id,
          providerIdempotencyKey: randomUUID(),
          requestHash,
          status: PaymentAttemptStatus.SUBMITTING,
        },
      });
      await transaction.orderPayment.update({
        data: { activeAttemptId: attempt.id, retryUntil: null, rowVersion: { increment: 1 } },
        where: { id: payment.id },
      });

      return { attemptId: attempt.id, created: true };
    });

    if (placed.created) {
      await this.dispatcher.dispatch({
        attemptId: placed.attemptId,
        card: input.card,
        ...(input.deviceId ? { deviceId: input.deviceId } : {}),
      });
    }

    return this.status.viewOwnedOrder(input.orderId, input.owner);
  }

  private unavailable(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.PAYMENT_RETRY_UNAVAILABLE,
      message: "A new payment attempt is not available for this order.",
      ok: false,
    });
  }

  private keyReused(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.IDEMPOTENCY_KEY_REUSED,
      message: "The idempotency key was already used for another request.",
      ok: false,
    });
  }
}

function retryRequestHash(input: PaymentRetryInput): string {
  const payload = JSON.stringify([
    "mp-card-retry",
    input.orderId,
    cardTokenDigest(input.card.token),
    input.card.paymentMethodId,
    input.card.installments,
    input.card.payerIdentification.type,
    input.card.payerIdentification.number,
    input.card.payerEmail,
  ]);
  return createHash("sha256").update(payload).digest("hex");
}
