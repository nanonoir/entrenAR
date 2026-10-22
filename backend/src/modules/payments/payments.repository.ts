import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { OrderStatus, PaymentAttemptStatus, PaymentProvider } from "../../generated/prisma/enums";

export const paymentOrderInclude = {
  items: { orderBy: [{ productId: "asc" }, { id: "asc" }] },
  payment: {
    include: {
      attempts: { orderBy: { attemptNumber: "desc" }, take: 1 },
    },
  },
} satisfies Prisma.OrderInclude;

export type PaymentOrderRecord = Prisma.OrderGetPayload<{ include: typeof paymentOrderInclude }>;

export interface PaymentSessionRecord {
  expiresAt: Date | null;
  id: string;
  status: string;
  userId: string | null;
}

/** Same digest as the checkout module's token hash, kept local so payments never imports checkout. */
export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Plain (non-transactional) reads used by status, ownership and dispatch. Writes go through the reducer. */
@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async orderById(orderId: string): Promise<PaymentOrderRecord | null> {
    return this.prisma.order.findUnique({ include: paymentOrderInclude, where: { id: orderId } });
  }

  async dispatchContext(attemptId: string) {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      include: { payment: { include: { order: { include: { items: { orderBy: [{ productId: "asc" }, { id: "asc" }] } } } } } },
      where: { id: attemptId },
    });
    return attempt;
  }

  async attemptByProviderOrderId(providerOrderId: string) {
    return this.prisma.paymentAttempt.findUnique({
      select: { id: true, payment: { select: { orderId: true, provider: true } } },
      where: { providerOrderId },
    });
  }

  /** Unresolved attempts of a Mercado Pago order that never persisted a provider order id. */
  async unresolvedAttemptsWithoutProviderOrder(orderId: string) {
    return this.prisma.paymentAttempt.findMany({
      select: { id: true },
      where: {
        payment: { is: { orderId, provider: PaymentProvider.MERCADOPAGO } },
        providerOrderId: null,
        status: { in: [PaymentAttemptStatus.SUBMITTING, PaymentAttemptStatus.UNKNOWN] },
      },
      take: 2,
    });
  }

  async sessionByToken(rawToken: string): Promise<PaymentSessionRecord | null> {
    return this.prisma.checkoutSession.findUnique({
      select: { expiresAt: true, id: true, status: true, userId: true },
      where: { tokenHash: hashSessionToken(rawToken) },
    });
  }

  async sessionStatus(sessionId: string): Promise<string | null> {
    const session = await this.prisma.checkoutSession.findUnique({ select: { status: true }, where: { id: sessionId } });
    return session?.status ?? null;
  }

  async orderIdBySession(sessionId: string): Promise<string | null> {
    const order = await this.prisma.order.findUnique({
      select: { id: true, payment: { select: { provider: true } } },
      where: { checkoutSessionId: sessionId },
    });
    return order?.payment?.provider === PaymentProvider.MERCADOPAGO ? order.id : null;
  }

  /** Latest pending Mercado Pago order of a customer, used when no checkout session credential is supplied. */
  async latestPendingOrderIdByUser(userId: string): Promise<string | null> {
    const order = await this.prisma.order.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
      where: { payment: { is: { provider: PaymentProvider.MERCADOPAGO } }, status: OrderStatus.PENDING, userId },
    });
    return order?.id ?? null;
  }

  async databaseNow(): Promise<Date> {
    const rows = await this.prisma.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS now`);
    const now = rows[0]?.now;
    if (!now) throw new Error("Database time could not be read.");
    return now;
  }
}
