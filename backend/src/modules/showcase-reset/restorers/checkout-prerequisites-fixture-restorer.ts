import * as bcrypt from "bcrypt";

import type { Prisma } from "../../../generated/prisma/client";
import type { ShowcaseResetReport } from "../showcase-reset.report";
import type { FixtureRestorer } from "../fixtures/fixture-restorer";
import {
  CHECKOUT_FIXTURE_PASSWORD,
  CHECKOUT_PASSWORD_SALT_ROUNDS,
  CHECKOUT_PREREQUISITES,
  CUSTOMER_SEEDS,
  INDEPENDENT_COUPON,
} from "../fixtures/checkout-customer-baseline";

export class CheckoutPrerequisitesFixtureRestorer implements FixtureRestorer {
  readonly family = "checkout" as const;

  async restore(transaction: Prisma.TransactionClient, report: ShowcaseResetReport): Promise<void> {
    const preserved = await this.countPreserved(transaction);
    let created = 0;
    let updated = 0;
    const existingUser = await transaction.user.findUnique({ where: { id: CHECKOUT_PREREQUISITES.user.id }, select: { passwordHash: true } });
    const passwordHash = existingUser && await bcrypt.compare(CHECKOUT_FIXTURE_PASSWORD, existingUser.passwordHash)
      ? existingUser.passwordHash
      : await bcrypt.hash(CHECKOUT_FIXTURE_PASSWORD, CHECKOUT_PASSWORD_SALT_ROUNDS);
    await transaction.user.upsert({
      where: { id: CHECKOUT_PREREQUISITES.user.id },
      create: { ...CHECKOUT_PREREQUISITES.user, passwordHash },
      update: { email: CHECKOUT_PREREQUISITES.user.email, firstName: CHECKOUT_PREREQUISITES.user.firstName, lastName: CHECKOUT_PREREQUISITES.user.lastName, passwordHash, role: CHECKOUT_PREREQUISITES.user.role },
    });
    existingUser ? updated++ : created++;

    for (const customer of CUSTOMER_SEEDS) {
      const exists = await transaction.customer.findUnique({ where: { id: customer.id }, select: { id: true } });
      const data = { dniOrCuil: customer.dniOrCuil ?? null, email: customer.email, firstInteractionDate: customer.firstInteractionDate, fullName: customer.fullName, isAnonymized: false, notes: customer.notes ?? null, phone: customer.phone ?? null, tags: [...customer.tags], userId: customer.userId ?? null };
      await transaction.customer.upsert({ where: { id: customer.id }, create: { id: customer.id, ...data }, update: data });
      exists ? updated++ : created++;
      if (customer.address) {
        const addressExists = await transaction.customerAddress.findUnique({ where: { customerId: customer.id }, select: { customerId: true } });
        await transaction.customerAddress.upsert({ where: { customerId: customer.id }, create: { customerId: customer.id, ...customer.address }, update: customer.address });
        addressExists ? updated++ : created++;
      } else {
        const deleted = await transaction.customerAddress.deleteMany({ where: { customerId: customer.id } });
        updated += deleted.count;
      }
    }

    const cartExists = await transaction.cart.findUnique({ where: { id: CHECKOUT_PREREQUISITES.cart.id }, select: { id: true } });
    await transaction.cart.upsert({ where: { id: CHECKOUT_PREREQUISITES.cart.id }, create: CHECKOUT_PREREQUISITES.cart, update: CHECKOUT_PREREQUISITES.cart });
    cartExists ? updated++ : created++;
    const itemExists = await transaction.cartItem.findUnique({ where: { id: CHECKOUT_PREREQUISITES.cartItem.id }, select: { id: true } });
    await transaction.cartItem.upsert({ where: { id: CHECKOUT_PREREQUISITES.cartItem.id }, create: CHECKOUT_PREREQUISITES.cartItem, update: CHECKOUT_PREREQUISITES.cartItem });
    itemExists ? updated++ : created++;
    const sessionExists = await transaction.checkoutSession.findUnique({ where: { id: CHECKOUT_PREREQUISITES.session.id }, select: { id: true } });
    await transaction.checkoutSession.upsert({ where: { id: CHECKOUT_PREREQUISITES.session.id }, create: CHECKOUT_PREREQUISITES.session, update: CHECKOUT_PREREQUISITES.session });
    sessionExists ? updated++ : created++;
    const couponExists = await transaction.coupon.findUnique({ where: { id: INDEPENDENT_COUPON.id }, select: { id: true } });
    await transaction.coupon.upsert({ where: { id: INDEPENDENT_COUPON.id }, create: INDEPENDENT_COUPON, update: INDEPENDENT_COUPON });
    couponExists ? updated++ : created++;
    report.recordFamily(this.family, { created, preserved, updated });
  }

  private async countPreserved(transaction: Prisma.TransactionClient): Promise<number> {
    const customerIds = CUSTOMER_SEEDS.map(({ id }) => id);
    const addressCustomerIds = CUSTOMER_SEEDS.filter(({ address }) => address).map(({ id }) => id);
    const [users, customers, addresses, carts, items, sessions, coupons] = await Promise.all([
      transaction.user.count({ where: { id: { not: CHECKOUT_PREREQUISITES.user.id } } }),
      transaction.customer.count({ where: { id: { notIn: customerIds } } }),
      transaction.customerAddress.count({ where: { customerId: { notIn: addressCustomerIds } } }),
      transaction.cart.count({ where: { id: { not: CHECKOUT_PREREQUISITES.cart.id } } }),
      transaction.cartItem.count({ where: { id: { not: CHECKOUT_PREREQUISITES.cartItem.id } } }),
      transaction.checkoutSession.count({ where: { id: { not: CHECKOUT_PREREQUISITES.session.id } } }),
      transaction.coupon.count({ where: { id: { not: INDEPENDENT_COUPON.id } } }),
    ]);
    return users + customers + addresses + carts + items + sessions + coupons;
  }
}
