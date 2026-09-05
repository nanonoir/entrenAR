import { createHash, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client";
import { CheckoutRecoveryStatus, CheckoutSessionStatus } from "../../generated/prisma/enums";
import type { TransactionClient } from "./checkout-cart.repository";

export const checkoutSessionSelect = {
  abandonedAt: true,
  cartId: true,
  completedAt: true,
  createdAt: true,
  expiresAt: true,
  id: true,
  lastActivityAt: true,
  lastEmailSentAt: true,
  recoveryStatus: true,
  snapshotData: true,
  status: true,
  tokenHash: true,
  updatedAt: true,
  userId: true,
} satisfies Prisma.CheckoutSessionSelect;

export type CheckoutSessionRecord = Prisma.CheckoutSessionGetPayload<{ select: typeof checkoutSessionSelect }>;

export interface CheckoutSessionCreation {
  rawToken: string;
  session: CheckoutSessionRecord;
}

@Injectable()
export class CheckoutSessionRepository {
  async sessionByToken(transaction: TransactionClient, rawToken: string): Promise<CheckoutSessionRecord | null> {
    const sessions = await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "CheckoutSession" WHERE "tokenHash" = ${hashCheckoutToken(rawToken)} FOR UPDATE`,
    );
    const session = sessions[0];
    if (!session) return null;

    return transaction.checkoutSession.findUnique({
      select: checkoutSessionSelect,
      where: { id: session.id },
    });
  }

  async sessionByRecoveryToken(transaction: TransactionClient, rawToken: string, now = new Date()): Promise<CheckoutSessionRecord | null> {
    const sessions = await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "CheckoutSession" WHERE "recoveryTokenHash" = ${hashCheckoutToken(rawToken)} AND "recoveryExpiresAt" > ${now} AND "recoveryStatus" IN ('SENT', 'MANUAL') AND "status" = 'ABANDONED' FOR UPDATE`,
    );
    const session = sessions[0];
    return session ? transaction.checkoutSession.findUnique({ select: checkoutSessionSelect, where: { id: session.id } }) : null;
  }

  async activeSessionByCartAndUser(
    transaction: TransactionClient,
    cartId: string,
    userId: string,
  ): Promise<CheckoutSessionRecord | null> {
    return transaction.checkoutSession.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: checkoutSessionSelect,
      where: { cartId, status: CheckoutSessionStatus.ACTIVE, userId },
    });
  }

  async handoffGuestSession(
    transaction: TransactionClient,
    sessionId: string,
    cartId: string,
    userId: string,
    lastActivityAt: Date,
  ): Promise<CheckoutSessionRecord> {
    await transaction.checkoutSession.updateMany({
      data: { status: CheckoutSessionStatus.ABANDONED },
      where: { id: { not: sessionId }, status: CheckoutSessionStatus.ACTIVE, userId },
    });

    return transaction.checkoutSession.update({
      data: { cartId, lastActivityAt, status: CheckoutSessionStatus.ACTIVE, userId },
      select: checkoutSessionSelect,
      where: { id: sessionId },
    });
  }

  async createSession(
    transaction: TransactionClient,
    cartId: string,
    userId: string | undefined,
    rawToken = createOpaqueToken(),
  ): Promise<CheckoutSessionCreation> {
    const session = await transaction.checkoutSession.create({
      data: {
        cartId,
        ...(userId === undefined ? {} : { userId }),
        recoveryStatus: CheckoutRecoveryStatus.PENDING,
        status: CheckoutSessionStatus.ACTIVE,
        tokenHash: hashCheckoutToken(rawToken),
      },
      select: checkoutSessionSelect,
    });
    return { rawToken, session };
  }

  async updateSessionSnapshot(
    transaction: TransactionClient,
    sessionId: string,
    snapshotData: Prisma.InputJsonValue,
    lastActivityAt: Date,
  ): Promise<void> {
    await transaction.checkoutSession.update({
      data: { lastActivityAt, snapshotData },
      where: { id: sessionId },
    });
  }

  async completeSession(transaction: TransactionClient, sessionId: string, completedAt: Date): Promise<void> {
    await transaction.checkoutSession.update({
      data: {
        completedAt,
        lastActivityAt: completedAt,
        recoveryStatus: CheckoutRecoveryStatus.RECOVERED,
        status: CheckoutSessionStatus.COMPLETED,
      },
      where: { id: sessionId },
    });
  }

  isUsableActiveSession(session: CheckoutSessionRecord): boolean {
    return session.status === CheckoutSessionStatus.ACTIVE
      && (session.expiresAt === null || session.expiresAt > new Date());
  }
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashCheckoutToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
