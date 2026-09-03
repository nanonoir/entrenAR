import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client";

export const checkoutCartSelect = {
  createdAt: true,
  id: true,
  items: {
    orderBy: [{ productId: "asc" }, { id: "asc" }],
    select: {
      cartId: true,
      createdAt: true,
      id: true,
      productId: true,
      quantity: true,
      updatedAt: true,
      variantId: true,
    },
  },
  status: true,
  updatedAt: true,
  userId: true,
} satisfies Prisma.CartSelect;

export type CheckoutCartRecord = Prisma.CartGetPayload<{ select: typeof checkoutCartSelect }>;
export type TransactionClient = Prisma.TransactionClient;

export interface CheckoutCartItemInput {
  productId: string;
  quantity: number;
  variantId?: string;
}

interface CheckoutCartKey {
  productId: string;
  variantId?: string | null;
}

export function cartItemKey(item: CheckoutCartKey): string {
  return `${item.productId}:${item.variantId ?? ""}`;
}

@Injectable()
export class CheckoutCartRepository {
  async cartById(transaction: TransactionClient, cartId: string): Promise<CheckoutCartRecord | null> {
    return transaction.cart.findUnique({ select: checkoutCartSelect, where: { id: cartId } });
  }

  async replaceCartItems(
    transaction: TransactionClient,
    cartId: string,
    items: readonly CheckoutCartItemInput[],
  ): Promise<CheckoutCartRecord> {
    const requestedKeys = new Set(items.map(cartItemKey));
    const current = await this.cartById(transaction, cartId);
    if (!current) throw new Error("Checkout cart was not found while synchronizing items.");

    for (const item of items) {
      const existing = current.items.find((candidate) => cartItemKey(candidate) === cartItemKey(item));
      if (existing) {
        await transaction.cartItem.update({ data: { quantity: item.quantity }, where: { id: existing.id } });
        continue;
      }

      await transaction.cartItem.create({
        data: {
          cartId,
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variantId ?? null,
        },
      });
    }

    const staleIds = current.items.filter((item) => !requestedKeys.has(cartItemKey(item))).map((item) => item.id);
    if (staleIds.length > 0) {
      await transaction.cartItem.deleteMany({ where: { id: { in: staleIds }, cartId } });
    }

    const updated = await this.cartById(transaction, cartId);
    if (!updated) throw new Error("Checkout cart disappeared after item synchronization.");
    return updated;
  }

  async mergeCartItems(
    transaction: TransactionClient,
    targetCartId: string,
    sourceCartId: string,
  ): Promise<CheckoutCartRecord> {
    const source = await this.cartById(transaction, sourceCartId);
    const target = await this.cartById(transaction, targetCartId);
    if (!source || !target) throw new Error("Checkout cart disappeared during cart merge.");

    for (const item of source.items) {
      const existing = target.items.find((candidate) => cartItemKey(candidate) === cartItemKey(item));
      if (existing) {
        await transaction.cartItem.update({
          data: { quantity: existing.quantity + item.quantity },
          where: { id: existing.id },
        });
        continue;
      }

      await transaction.cartItem.create({
        data: {
          cartId: targetCartId,
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variantId,
        },
      });
    }

    const merged = await this.cartById(transaction, targetCartId);
    if (!merged) throw new Error("Checkout cart disappeared after cart merge.");
    return merged;
  }
}
