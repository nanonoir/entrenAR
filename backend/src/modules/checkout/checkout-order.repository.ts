import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client";
import { CartStatus, OrderDeliveryType, OrderStatus, PaymentStatus } from "../../generated/prisma/enums";
import type { TransactionClient } from "./checkout-cart.repository";

export const checkoutOrderInclude = {
  items: { orderBy: [{ productId: "asc" }, { id: "asc" }] },
  payment: true,
} satisfies Prisma.OrderInclude;

export type CheckoutOrderRecord = Prisma.OrderGetPayload<{ include: typeof checkoutOrderInclude }>;

export interface CheckoutOrderItemCreateInput {
  attributes: Prisma.InputJsonValue;
  compareAtPrice?: number | null;
  lineSubtotal: number;
  productId: string;
  productName: string;
  quantity: number;
  sku: string;
  snapshot: Prisma.InputJsonValue;
  unitPrice: number;
  variantId?: string | null;
  variantName?: string | null;
  weightGrams?: number | null;
}

export interface CheckoutOrderPaymentCreateInput {
  amount: number;
  bankTransferSnapshot?: Prisma.InputJsonValue | null;
  currency: string;
  paymentMethodId: string;
  paymentMethodSnapshot: Prisma.InputJsonValue;
  paymentOptionId?: string | null;
  status: PaymentStatus;
}

export interface CheckoutOrderCreateInput {
  cartId?: string | null;
  checkoutSessionId?: string | null;
  couponCode?: string | null;
  currency: string;
  customerDni?: string | null;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string | null;
  customerSnapshot: Prisma.InputJsonValue;
  deliverySnapshot: Prisma.InputJsonValue;
  deliveryType: OrderDeliveryType;
  discountAmount: number;
  discountSnapshot: Prisma.InputJsonValue;
  items: readonly CheckoutOrderItemCreateInput[];
  number: string;
  payment: CheckoutOrderPaymentCreateInput;
  shippingAddressSnapshot?: Prisma.InputJsonValue | null;
  shippingCost: number;
  status: OrderStatus;
  subtotal: number;
  total: number;
  userId?: string | null;
}

export interface CheckoutCouponRedemptionIdentity {
  customerKeyHash?: string;
  userId?: string;
}

@Injectable()
export class CheckoutOrderRepository {
  async lockCoupon(transaction: TransactionClient, couponId: string): Promise<void> {
    await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "Coupon" WHERE "id" = ${couponId} FOR UPDATE`,
    );
  }

  async hasPaidCustomerOrder(transaction: TransactionClient, userId: string): Promise<boolean> {
    return (await transaction.order.count({
      where: {
        payment: { is: { status: PaymentStatus.PAID } },
        status: { not: OrderStatus.CANCELLED },
        userId,
      },
    })) > 0;
  }

  async createPendingOrder(
    transaction: TransactionClient,
    input: CheckoutOrderCreateInput,
  ): Promise<CheckoutOrderRecord> {
    const orderData: Prisma.OrderUncheckedCreateInput = {
      ...(input.cartId === undefined ? {} : { cartId: input.cartId }),
      ...(input.checkoutSessionId === undefined ? {} : { checkoutSessionId: input.checkoutSessionId }),
      couponCode: input.couponCode ?? null,
      currency: input.currency,
      customerDni: input.customerDni ?? null,
      customerEmail: input.customerEmail,
      customerFirstName: input.customerFirstName,
      customerLastName: input.customerLastName,
      customerPhone: input.customerPhone ?? null,
      customerSnapshot: input.customerSnapshot,
      deliverySnapshot: input.deliverySnapshot,
      deliveryType: input.deliveryType,
      discountAmount: input.discountAmount,
      discountSnapshot: input.discountSnapshot,
      number: input.number,
      ...(input.shippingAddressSnapshot === undefined
        ? {}
        : { shippingAddressSnapshot: input.shippingAddressSnapshot === null ? Prisma.JsonNull : input.shippingAddressSnapshot }),
      shippingCost: input.shippingCost,
      status: input.status,
      subtotal: input.subtotal,
      total: input.total,
      ...(input.userId === undefined ? {} : { userId: input.userId }),
    };
    const order = await transaction.order.create({ data: orderData });

    await transaction.orderItem.createMany({
      data: input.items.map((item) => ({
        attributes: item.attributes,
        compareAtPrice: item.compareAtPrice ?? null,
        lineSubtotal: item.lineSubtotal,
        orderId: order.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        sku: item.sku,
        snapshot: item.snapshot,
        unitPrice: item.unitPrice,
        variantId: item.variantId ?? null,
        variantName: item.variantName ?? null,
        weightGrams: item.weightGrams ?? null,
      })),
    });

    await transaction.orderPayment.create({
      data: {
        amount: input.payment.amount,
        ...(input.payment.bankTransferSnapshot === undefined
          ? {}
          : { bankTransferSnapshot: input.payment.bankTransferSnapshot === null ? Prisma.JsonNull : input.payment.bankTransferSnapshot }),
        currency: input.payment.currency,
        orderId: order.id,
        paymentMethodId: input.payment.paymentMethodId,
        paymentMethodSnapshot: input.payment.paymentMethodSnapshot,
        paymentOptionId: input.payment.paymentOptionId ?? null,
        status: input.payment.status,
      },
    });

    return this.orderById(transaction, order.id);
  }

  async orderById(transaction: TransactionClient, orderId: string): Promise<CheckoutOrderRecord> {
    return transaction.order.findUniqueOrThrow({ include: checkoutOrderInclude, where: { id: orderId } });
  }

  async clearCart(transaction: TransactionClient, cartId: string): Promise<void> {
    await transaction.cartItem.deleteMany({ where: { cartId } });
    await transaction.cart.update({ data: { status: CartStatus.COMPLETED }, where: { id: cartId } });
  }

  async incrementCouponUsage(transaction: TransactionClient, couponId: string): Promise<boolean> {
    const updated = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "Coupon"
      SET "usageCount" = "usageCount" + 1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${couponId}
        AND "status" = 'ACTIVE'
        AND "deletedAt" IS NULL
        AND (
          "totalUsageLimitType" = 'UNLIMITED'
          OR (
            "totalUsageLimitType" = 'LIMITED'
            AND "totalUsageLimit" IS NOT NULL
            AND "usageCount" < "totalUsageLimit"
          )
        )
      RETURNING "id"
    `);

    return updated.length === 1;
  }

  async couponRedemptionCount(
    transaction: TransactionClient,
    couponId: string,
    identity: CheckoutCouponRedemptionIdentity,
  ): Promise<number> {
    return transaction.couponRedemption.count({
      where: {
        couponId,
        ...(identity.userId ? { userId: identity.userId } : {}),
        ...(identity.customerKeyHash ? { customerKeyHash: identity.customerKeyHash } : {}),
      },
    });
  }

  async createCouponRedemption(
    transaction: TransactionClient,
    input: Prisma.CouponRedemptionUncheckedCreateInput,
  ): Promise<void> {
    await transaction.couponRedemption.create({ data: input });
  }
}
