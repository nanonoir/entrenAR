import { Prisma } from "../../../generated/prisma/client";
import { PaymentMethodStatus, PickupCostType, PickupCoverageType, PickupPointStatus, ShippingProviderStatus } from "../../../generated/prisma/enums";
import type { ShowcaseResetReport } from "../showcase-reset.report";
import type { FixtureRestorer } from "../fixtures/fixture-restorer";
import { COMMERCE_DEFAULT_PREPARATION_HOURS, DEFAULT_WEIGHT_BANDS, PAYMENT_METHODS, SHIPPING_PROVIDERS } from "../fixtures/catalog-commerce-baseline";

const PICKUP_POINT_ID = "retiro-principal";

export class CommerceFixtureRestorer implements FixtureRestorer {
  readonly family = "commerce" as const;

  async restore(transaction: Prisma.TransactionClient, report: ShowcaseResetReport): Promise<void> {
    const preserved = await this.countPreserved(transaction);
    let created = 0;
    let updated = 0;

    for (const method of PAYMENT_METHODS) {
      const exists = await transaction.paymentMethodConfig.findUnique({ where: { id: method.id }, select: { id: true } });
      const data = { acceptedMethods: [...method.acceptedMethods], bankConfig: method.bankConfig ?? Prisma.DbNull, description: method.description, logoSrc: method.logoSrc, name: method.name, options: method.options.map((option) => ({ ...option })), selectedOptionId: null, status: PaymentMethodStatus.INACTIVE };
      await transaction.paymentMethodConfig.upsert({ where: { id: method.id }, create: { id: method.id, ...data }, update: data });
      exists ? updated++ : created++;
    }

    for (const provider of SHIPPING_PROVIDERS) {
      const providerExists = await transaction.shippingProvider.findUnique({ where: { id: provider.id }, select: { id: true } });
      const providerData = { enabledModalities: [], name: provider.name, status: ShippingProviderStatus.NOT_CONFIGURED };
      await transaction.shippingProvider.upsert({ where: { id: provider.id }, create: { id: provider.id, ...providerData }, update: providerData });
      providerExists ? updated++ : created++;
      for (const [index, band] of DEFAULT_WEIGHT_BANDS.entries()) {
        const id = `${provider.id}-${band.id}`;
        const exists = await transaction.weightBand.findUnique({ where: { id }, select: { id: true } });
        const data = { cost: band.cost, maxWeightGrams: band.maxWeightGrams, minWeightGrams: band.minWeightGrams, shippingProviderId: provider.id, sortOrder: index + 1 };
        await transaction.weightBand.upsert({ where: { id }, create: { id, ...data }, update: data });
        exists ? updated++ : created++;
      }
    }

    const pickupExists = await transaction.pickupPoint.findUnique({ where: { id: PICKUP_POINT_ID }, select: { id: true } });
    const pickupData = { city: null, contactEmail: null, contactName: null, contactPhone: null, costType: PickupCostType.FREE, coverageType: PickupCoverageType.ALL, fixedCost: null, isMain: true, name: "Punto de retiro principal", number: null, postalCode: null, preparationHours: COMMERCE_DEFAULT_PREPARATION_HOURS, provinces: [], province: null, status: PickupPointStatus.NOT_CONFIGURED, street: null };
    await transaction.pickupPoint.upsert({ where: { id: PICKUP_POINT_ID }, create: { id: PICKUP_POINT_ID, ...pickupData }, update: pickupData });
    pickupExists ? updated++ : created++;
    report.recordFamily(this.family, { created, preserved, updated });
  }

  private async countPreserved(transaction: Prisma.TransactionClient): Promise<number> {
    const paymentIds = PAYMENT_METHODS.map(({ id }) => id);
    const providerIds = SHIPPING_PROVIDERS.map(({ id }) => id);
    const bandIds = SHIPPING_PROVIDERS.flatMap((provider) => DEFAULT_WEIGHT_BANDS.map((band) => `${provider.id}-${band.id}`));
    const [payments, providers, bands, pickupPoints] = await Promise.all([
      transaction.paymentMethodConfig.count({ where: { id: { notIn: paymentIds } } }),
      transaction.shippingProvider.count({ where: { id: { notIn: providerIds } } }),
      transaction.weightBand.count({ where: { id: { notIn: bandIds } } }),
      transaction.pickupPoint.count({ where: { id: { not: PICKUP_POINT_ID } } }),
    ]);
    return payments + providers + bands + pickupPoints;
  }
}
