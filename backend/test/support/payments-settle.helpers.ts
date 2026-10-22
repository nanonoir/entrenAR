import type { PrismaClient } from "../../src/generated/prisma/client";
import type { Prisma } from "../../src/generated/prisma/client";
import { PaymentAttemptStatus } from "../../src/generated/prisma/enums";
import type { CheckoutFixtures } from "./checkout-http.types";

const NON_TERMINAL_ATTEMPT_STATUSES = [
  PaymentAttemptStatus.SUBMITTING,
  PaymentAttemptStatus.UNKNOWN,
  PaymentAttemptStatus.PROCESSING,
  PaymentAttemptStatus.ACTION_REQUIRED,
];

/**
 * Leaves the payment attempts of the matching orders terminal and not due for reconciliation, so a backend running
 * against the same database never polls the real provider for rows a spec created. Safe to run before deleting rows.
 */
export async function settlePaymentFixtures(prisma: PrismaClient, orderWhere: Prisma.OrderWhereInput): Promise<void> {
  const payment = { order: orderWhere };
  await prisma.paymentAttempt.updateMany({
    data: { status: PaymentAttemptStatus.CANCELLED },
    where: { payment, status: { in: NON_TERMINAL_ATTEMPT_STATUSES } },
  });
  await prisma.paymentAttempt.updateMany({ data: { nextReconcileAt: null, reconcileLeaseUntil: null }, where: { payment } });
  await prisma.orderPayment.updateMany({ data: { attentionReason: null, attentionRequiredAt: null }, where: payment });
}

/** Same as `settlePaymentFixtures` for every order the checkout fixtures own (registered users and the guest). */
export async function settleCheckoutPaymentFixtures(prisma: PrismaClient, fixtures: CheckoutFixtures): Promise<void> {
  const userIds = [
    fixtures.owner.id,
    fixtures.foreign.id,
    fixtures.admin.id,
    fixtures.guestOwner.id,
    fixtures.raceFirst.id,
    fixtures.raceSecond.id,
    fixtures.replayOwner.id,
    fixtures.staleOwner.id,
    fixtures.validationOwner.id,
  ];
  await settlePaymentFixtures(prisma, { OR: [{ userId: { in: userIds } }, { customerEmail: fixtures.guestOwner.email }] });
}
