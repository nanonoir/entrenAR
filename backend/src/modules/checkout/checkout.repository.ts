import { Injectable, Optional } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { CartStatus } from "../../generated/prisma/enums";
import {
  InventoryRepository,
  type CheckoutStockDeductionResult,
  type InventoryTarget,
} from "../inventory/inventory.repository";
import {
  CheckoutCartRepository,
  checkoutCartSelect,
  type CheckoutCartItemInput,
  type CheckoutCartRecord,
  type TransactionClient,
} from "./checkout-cart.repository";
import {
  CheckoutSessionRepository,
  createOpaqueToken,
  type CheckoutSessionRecord,
} from "./checkout-session.repository";
import {
  CheckoutIdempotencyRepository,
  type CheckoutIdempotencyRecord,
  type IdempotencyClaim,
} from "./checkout-idempotency.repository";
import {
  CheckoutOrderRepository,
  type CheckoutCouponRedemptionIdentity,
  type CheckoutOrderCreateInput,
  type CheckoutOrderRecord,
} from "./checkout-order.repository";
import { CheckoutTransaction } from "./checkout-transaction";

export { cartItemKey, checkoutCartSelect } from "./checkout-cart.repository";
export type { CheckoutCartItemInput, CheckoutCartRecord, TransactionClient } from "./checkout-cart.repository";
export { checkoutSessionSelect, hashCheckoutToken } from "./checkout-session.repository";
export { createOpaqueToken };
export type { CheckoutSessionRecord };
export { hashCheckoutRequest } from "./checkout-idempotency.repository";
export type { CheckoutIdempotencyRecord, IdempotencyClaim } from "./checkout-idempotency.repository";
export { checkoutOrderInclude } from "./checkout-order.repository";
export type {
  CheckoutCouponRedemptionIdentity,
  CheckoutOrderCreateInput,
  CheckoutOrderItemCreateInput,
  CheckoutOrderPaymentCreateInput,
  CheckoutOrderRecord,
} from "./checkout-order.repository";

export const checkoutAddressSelect = {
  city: true,
  id: true,
  label: true,
  phone: true,
  postalCode: true,
  province: true,
  recipient: true,
  street: true,
} satisfies Prisma.UserAddressSelect;

export const checkoutUserSelect = {
  dni: true,
  email: true,
  firstName: true,
  id: true,
  lastName: true,
  phone: true,
  role: true,
} satisfies Prisma.UserSelect;

export type CheckoutAddressRecord = Prisma.UserAddressGetPayload<{ select: typeof checkoutAddressSelect }>;
export type CheckoutUserRecord = Prisma.UserGetPayload<{ select: typeof checkoutUserSelect }>;

export interface CheckoutOwner {
  sessionToken?: string;
  userId?: string;
}

export interface CheckoutCartResolution {
  cart: CheckoutCartRecord;
  merged: boolean;
  ownerKey: string;
  session: CheckoutSessionRecord;
  sessionToken?: string;
}

@Injectable()
export class CheckoutRepository {
  private readonly cartRepository: CheckoutCartRepository;
  private readonly idempotencyRepository: CheckoutIdempotencyRepository;
  private readonly orderRepository: CheckoutOrderRepository;
  private readonly sessionRepository: CheckoutSessionRepository;
  private readonly checkoutTransaction: CheckoutTransaction;

  constructor(
    prisma: PrismaService,
    @Optional() private readonly inventoryRepository?: InventoryRepository,
    @Optional() cartRepository?: CheckoutCartRepository,
    @Optional() sessionRepository?: CheckoutSessionRepository,
    @Optional() idempotencyRepository?: CheckoutIdempotencyRepository,
    @Optional() orderRepository?: CheckoutOrderRepository,
    @Optional() transactionRunner?: CheckoutTransaction,
  ) {
    this.cartRepository = cartRepository ?? new CheckoutCartRepository();
    this.idempotencyRepository = idempotencyRepository ?? new CheckoutIdempotencyRepository();
    this.orderRepository = orderRepository ?? new CheckoutOrderRepository();
    this.sessionRepository = sessionRepository ?? new CheckoutSessionRepository();
    this.checkoutTransaction = transactionRunner ?? new CheckoutTransaction(prisma);
  }

  async transaction<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T> {
    return this.checkoutTransaction.run(callback);
  }

  async resolveCart(transaction: TransactionClient, owner: CheckoutOwner): Promise<CheckoutCartResolution | null> {
    if (owner.userId) {
      return this.resolveCustomerCart(transaction, owner.userId, owner.sessionToken);
    }

    return this.resolveGuestCart(transaction, owner.sessionToken);
  }

  async cartById(transaction: TransactionClient, cartId: string): Promise<CheckoutCartRecord | null> {
    return this.cartRepository.cartById(transaction, cartId);
  }

  async sessionByToken(transaction: TransactionClient, rawToken: string): Promise<CheckoutSessionRecord | null> {
    return this.sessionRepository.sessionByToken(transaction, rawToken);
  }

  async sessionByRecoveryToken(transaction: TransactionClient, rawToken: string, now?: Date): Promise<CheckoutSessionRecord | null> {
    return this.sessionRepository.sessionByRecoveryToken(transaction, rawToken, now);
  }

  async addressByOwner(
    transaction: TransactionClient,
    userId: string,
    addressId: string,
  ): Promise<CheckoutAddressRecord | null> {
    return transaction.userAddress.findFirst({
      select: checkoutAddressSelect,
      where: { id: addressId, userId },
    });
  }

  async userForCheckout(transaction: TransactionClient, userId: string): Promise<CheckoutUserRecord | null> {
    return transaction.user.findUnique({ select: checkoutUserSelect, where: { id: userId } });
  }

  async stockTargetForCheckout(
    transaction: TransactionClient,
    productId: string,
    variantId: string | undefined,
  ): Promise<InventoryTarget | null> {
    if (!this.inventoryRepository) {
      throw new Error("InventoryRepository is required for checkout stock reads.");
    }

    return this.inventoryRepository.findTarget(transaction, productId, variantId);
  }

  async updateSessionSnapshot(
    transaction: TransactionClient,
    sessionId: string,
    snapshotData: Prisma.InputJsonValue,
    lastActivityAt: Date,
  ): Promise<void> {
    return this.sessionRepository.updateSessionSnapshot(transaction, sessionId, snapshotData, lastActivityAt);
  }

  async lockCoupon(transaction: TransactionClient, couponId: string): Promise<void> {
    return this.orderRepository.lockCoupon(transaction, couponId);
  }

  async hasPaidCustomerOrder(transaction: TransactionClient, userId: string): Promise<boolean> {
    return this.orderRepository.hasPaidCustomerOrder(transaction, userId);
  }

  async replaceCartItems(
    transaction: TransactionClient,
    cartId: string,
    items: readonly CheckoutCartItemInput[],
  ): Promise<CheckoutCartRecord> {
    return this.cartRepository.replaceCartItems(transaction, cartId, items);
  }

  async mergeCartItems(
    transaction: TransactionClient,
    targetCartId: string,
    sourceCartId: string,
  ): Promise<CheckoutCartRecord> {
    return this.cartRepository.mergeCartItems(transaction, targetCartId, sourceCartId);
  }

  async idempotencyByOwnerAndKey(
    transaction: TransactionClient,
    ownerKey: string,
    idempotencyKey: string,
  ): Promise<CheckoutIdempotencyRecord | null> {
    return this.idempotencyRepository.idempotencyByOwnerAndKey(transaction, ownerKey, idempotencyKey);
  }

  async claimIdempotency(
    transaction: TransactionClient,
    ownerKey: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<IdempotencyClaim> {
    return this.idempotencyRepository.claimIdempotency(transaction, ownerKey, idempotencyKey, requestHash);
  }

  async completeIdempotency(
    transaction: TransactionClient,
    id: string,
    orderId: string,
    responseSnapshot: Prisma.InputJsonValue,
    completedAt: Date,
  ): Promise<CheckoutIdempotencyRecord> {
    return this.idempotencyRepository.completeIdempotency(transaction, id, orderId, responseSnapshot, completedAt);
  }

  async failIdempotency(transaction: TransactionClient, id: string): Promise<void> {
    return this.idempotencyRepository.failIdempotency(transaction, id);
  }

  async deductStockForCheckout(
    transaction: TransactionClient,
    productId: string,
    variantId: string | undefined,
    quantity: number,
  ): Promise<CheckoutStockDeductionResult> {
    if (!this.inventoryRepository) {
      throw new Error("InventoryRepository is required for checkout stock deductions.");
    }

    return this.inventoryRepository.deductForCheckout(transaction, productId, variantId, quantity);
  }

  async createPendingOrder(
    transaction: TransactionClient,
    input: CheckoutOrderCreateInput,
  ): Promise<CheckoutOrderRecord> {
    return this.orderRepository.createPendingOrder(transaction, input);
  }

  async orderById(transaction: TransactionClient, orderId: string): Promise<CheckoutOrderRecord> {
    return this.orderRepository.orderById(transaction, orderId);
  }

  async clearCart(transaction: TransactionClient, cartId: string): Promise<void> {
    return this.orderRepository.clearCart(transaction, cartId);
  }

  async completeSession(transaction: TransactionClient, sessionId: string, completedAt: Date): Promise<void> {
    return this.sessionRepository.completeSession(transaction, sessionId, completedAt);
  }

  async incrementCouponUsage(transaction: TransactionClient, couponId: string): Promise<boolean> {
    return this.orderRepository.incrementCouponUsage(transaction, couponId);
  }

  async couponRedemptionCount(
    transaction: TransactionClient,
    couponId: string,
    identity: CheckoutCouponRedemptionIdentity,
  ): Promise<number> {
    return this.orderRepository.couponRedemptionCount(transaction, couponId, identity);
  }

  async createCouponRedemption(
    transaction: TransactionClient,
    input: Prisma.CouponRedemptionUncheckedCreateInput,
  ): Promise<void> {
    return this.orderRepository.createCouponRedemption(transaction, input);
  }

  private async resolveCustomerCart(
    transaction: TransactionClient,
    userId: string,
    sessionToken: string | undefined,
  ): Promise<CheckoutCartResolution | null> {
    const users = await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
    );
    if (users.length === 0) return null;

    const guestSession = sessionToken
      ? await this.sessionRepository.sessionByToken(transaction, sessionToken)
      : null;
    if (sessionToken && (!guestSession || !this.sessionRepository.isUsableActiveSession(guestSession))) return null;
    if (guestSession?.userId && guestSession.userId !== userId) return null;

    let cart = await transaction.cart.findFirst({
      select: checkoutCartSelect,
      where: { status: CartStatus.ACTIVE, userId },
    });
    if (!cart) {
      cart = await transaction.cart.create({
        data: { status: CartStatus.ACTIVE, userId },
        select: checkoutCartSelect,
      });
    }

    let session: CheckoutSessionRecord | null = null;
    let resolvedToken: string | undefined;
    let merged = false;
    if (guestSession && !guestSession.userId) {
      const guestCart = await this.cartById(transaction, guestSession.cartId);
      if (!guestCart || guestCart.userId) return null;
      if (guestCart.id !== cart.id) {
        cart = await this.mergeCartItems(transaction, cart.id, guestCart.id);
        await transaction.cart.update({ data: { status: CartStatus.ABANDONED }, where: { id: guestCart.id } });
        merged = true;
      }
      session = await this.sessionRepository.handoffGuestSession(
        transaction,
        guestSession.id,
        cart.id,
        userId,
        new Date(),
      );
      resolvedToken = sessionToken;
    } else {
      const existing = await this.sessionRepository.activeSessionByCartAndUser(transaction, cart.id, userId);
      if (existing) {
        session = existing;
      } else {
        const created = await this.sessionRepository.createSession(transaction, cart.id, userId);
        session = created.session;
        resolvedToken = created.rawToken;
      }
    }

    const resolvedCart = await this.cartById(transaction, cart.id);
    if (!resolvedCart || !session) return null;
    return {
      cart: resolvedCart,
      merged,
      ownerKey: `user:${userId}`,
      session,
      ...(resolvedToken ? { sessionToken: resolvedToken } : {}),
    };
  }

  private async resolveGuestCart(
    transaction: TransactionClient,
    sessionToken: string | undefined,
  ): Promise<CheckoutCartResolution | null> {
    if (sessionToken) {
      const session = await this.sessionRepository.sessionByToken(transaction, sessionToken);
      if (!session || !this.sessionRepository.isUsableActiveSession(session) || session.userId) return null;
      const cart = await this.cartById(transaction, session.cartId);
      if (!cart || cart.userId || cart.status !== CartStatus.ACTIVE) return null;
      return {
        cart,
        merged: false,
        ownerKey: `session:${session.id}`,
        session,
        sessionToken,
      };
    }

    const rawToken = createOpaqueToken();
    const cart = await transaction.cart.create({ data: { status: CartStatus.ACTIVE }, select: checkoutCartSelect });
    const created = await this.sessionRepository.createSession(transaction, cart.id, undefined, rawToken);
    return {
      cart,
      merged: false,
      ownerKey: `session:${created.session.id}`,
      session: created.session,
      sessionToken: created.rawToken,
    };
  }

}
