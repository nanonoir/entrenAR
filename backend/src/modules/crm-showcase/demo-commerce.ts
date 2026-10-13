import type { Prisma } from "../../generated/prisma/client";

/** Explicit operator preparation only; never invoked implicitly by the generator. */
export async function configureManualDemoCommerce(tx: Prisma.TransactionClient, preparedAt: Date): Promise<void> {
  await tx.paymentMethodConfig.update({ where: { id: "bank-transfer" }, data: {
    name: "Transferencia manual DEMO — no transferir",
    description: "Demostración ficticia, sin cobros ni conexión bancaria. No enviar dinero.",
    selectedOptionId: "direct-transfer", status: "ACTIVE", updatedAt: preparedAt,
    bankConfig: { alias: "DEMO.NO.TRANSFERIR", bankName: "Banco ficticio DEMO", cbuCvu: "0000000000000000000000", cuitCuil: "20-00000000-0", holderName: "Persona ficticia DEMO" },
  } });
  await tx.shippingProvider.update({ where: { id: "andreani" }, data: {
    name: "Envío manual DEMO (sin despacho real)", status: "ACTIVE", enabledModalities: ["home_delivery"], freeShippingThreshold: null, updatedAt: preparedAt,
    originSenderName: "Origen ficticio DEMO", originEmail: "origen-demo@example.invalid", originPhone: "+54 11 0000-0000",
    originStreet: "Calle Ficticia DEMO", originNumber: "100", originCity: "Ciudad Demo", originProvince: "Buenos Aires", originPostalCode: "1000",
  } });
  await tx.weightBand.updateMany({ where: { shippingProviderId: "andreani" }, data: { cost: "100.00", updatedAt: preparedAt } });
  const point = await tx.pickupPoint.findFirstOrThrow({ orderBy: { id: "asc" } });
  await tx.pickupPoint.update({ where: { id: point.id }, data: {
    name: "Retiro ficticio DEMO — no concurrir", status: "ACTIVE", street: "Calle Ficticia DEMO", number: "100", city: "Ciudad Demo", province: "Buenos Aires", postalCode: "1000", updatedAt: preparedAt,
    contactName: "Persona ficticia DEMO", contactEmail: "retiro-demo@example.invalid", contactPhone: "+54 11 0000-0000", costType: "FREE", fixedCost: null, coverageType: "ALL", provinces: [],
  } });
}
