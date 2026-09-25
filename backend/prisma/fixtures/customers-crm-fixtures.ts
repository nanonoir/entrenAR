import { PrismaClient } from "../../src/generated/prisma/client";
import { CUSTOMER_SEEDS } from "../../src/modules/showcase-reset/fixtures/checkout-customer-baseline";
import { SHOWCASE_FIXTURE_FAMILY, assertShowcaseFixtureIds } from "../../src/modules/showcase-reset/fixtures/showcase-fixture-manifest";

const CHECKOUT_CUSTOMER_ID = "cus_checkout_fixture";
const CHECKOUT_ORDER_ID = "checkout-seed-order";

export { CUSTOMER_SEEDS };

export async function seedCustomersCrm(prisma: PrismaClient): Promise<void> {
  assertShowcaseFixtureIds(SHOWCASE_FIXTURE_FAMILY.CUSTOMERS, {
    customer: CUSTOMER_SEEDS.map((customer) => customer.id),
    customerAddress: CUSTOMER_SEEDS.filter((customer) => customer.address !== undefined).map((customer) => customer.id),
  });
  for (const customer of CUSTOMER_SEEDS) {
    const customerData = {
      dniOrCuil: customer.dniOrCuil ?? null,
      email: customer.email,
      firstInteractionDate: customer.firstInteractionDate,
      fullName: customer.fullName,
      isAnonymized: false,
      notes: customer.notes ?? null,
      phone: customer.phone ?? null,
      tags: [...customer.tags],
      userId: customer.userId ?? null,
    };

    await prisma.customer.upsert({
      where: { id: customer.id },
      create: { ...customerData, id: customer.id },
      update: customerData,
    });

    await prisma.customerAddress.deleteMany({ where: { customerId: customer.id } });
    if (customer.address) {
      await prisma.customerAddress.create({ data: { ...customer.address, customerId: customer.id } });
    }
  }

  await prisma.order.updateMany({
    data: { customerId: CHECKOUT_CUSTOMER_ID },
    where: { id: CHECKOUT_ORDER_ID },
  });
}
