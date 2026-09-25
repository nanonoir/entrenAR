import { PrismaClient } from "../../src/generated/prisma/client";
import { SHOWCASE_FIXTURE_FAMILY, assertShowcaseFixtureIds } from "../../src/modules/showcase-reset/fixtures/showcase-fixture-manifest";
import { CHECKOUT_ORDER_HISTORY, SUPPLIERS } from "../../src/modules/showcase-reset/fixtures/order-dependent-crm-baseline";

export { SUPPLIERS };

export async function seedSalesCrm(prisma: PrismaClient): Promise<void> {
  assertShowcaseFixtureIds(SHOWCASE_FIXTURE_FAMILY.SALES, { orderHistory: [CHECKOUT_ORDER_HISTORY.id], supplier: SUPPLIERS.map((supplier) => supplier.id) });
  for (const supplier of SUPPLIERS) {
    await prisma.supplier.upsert({ where: { id: supplier.id }, create: supplier, update: withoutId(supplier) });
  }
  await prisma.orderHistory.upsert({ where: { id: CHECKOUT_ORDER_HISTORY.id }, create: CHECKOUT_ORDER_HISTORY, update: withoutId(CHECKOUT_ORDER_HISTORY) });
}

function withoutId<T extends { id: string }>(data: T): Omit<T, "id"> {
  const { id: _id, ...without } = data;
  return without;
}
