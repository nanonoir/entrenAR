import { PrismaClient } from "../../src/generated/prisma/client";

interface CustomerAddressSeed {
  street: string;
  number: string;
  floorOrApartment?: string;
  postalCode: string;
  neighborhood?: string;
  city: string;
  provinceOrState: string;
  country: string;
}

interface CustomerSeed {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  dniOrCuil?: string;
  firstInteractionDate: Date;
  notes?: string;
  tags: readonly string[];
  userId?: string;
  address?: CustomerAddressSeed;
}

const CHECKOUT_CUSTOMER_ID = "cus_checkout_fixture";
const CHECKOUT_ORDER_ID = "checkout-seed-order";

const CUSTOMER_SEEDS: readonly CustomerSeed[] = [
  {
    address: { city: "Buenos Aires", country: "Argentina", floorOrApartment: "3 B", number: "2845", postalCode: "1425", provinceOrState: "Buenos Aires", street: "Av. Santa Fe" },
    dniOrCuil: "30123456",
    email: "camila.perez@example.com",
    firstInteractionDate: new Date("2026-06-10T00:00:00.000Z"),
    fullName: "Camila Pérez",
    id: "cus_001",
    notes: "Prefiere coordinar entregas por la tarde.",
    phone: "+54 11 4567-8901",
    tags: [],
  },
  {
    address: { city: "Córdoba", country: "Argentina", number: "450", postalCode: "5000", provinceOrState: "Córdoba", street: "Colón" },
    email: "martin.suarez@example.com",
    firstInteractionDate: new Date("2026-06-11T00:00:00.000Z"),
    fullName: "Martín Suárez",
    id: "cus_002",
    notes: "Consulta promociones antes de cada compra.",
    tags: [],
    phone: "+54 351 678-9012",
  },
  {
    email: "sofia.ledesma@example.com",
    firstInteractionDate: new Date("2026-06-12T00:00:00.000Z"),
    fullName: "Sofía Ledesma",
    id: "cus_003",
    notes: "Cliente online, sin teléfono informado.",
    tags: [],
  },
  {
    address: { city: "Rosario", country: "Argentina", number: "1200", postalCode: "2000", provinceOrState: "Santa Fe", street: "San Martín" },
    email: "valentina.acosta@example.com",
    firstInteractionDate: new Date("2026-05-30T00:00:00.000Z"),
    fullName: "Valentina Acosta",
    id: "cus_004",
    tags: [],
  },
  {
    email: "agustin.moreno@example.com",
    firstInteractionDate: new Date("2026-06-01T00:00:00.000Z"),
    fullName: "Agustín Moreno",
    id: "cus_005",
    phone: "+54 261 555-0120",
    tags: [],
  },
  {
    email: "rocio.fernandez@example.com",
    firstInteractionDate: new Date("2026-06-03T00:00:00.000Z"),
    fullName: "Rocío Fernández",
    id: "cus_006",
    tags: [],
  },
  {
    dniOrCuil: "30123456",
    email: "bounce@mock.com",
    firstInteractionDate: new Date("2026-06-13T00:00:00.000Z"),
    fullName: "Bounced Email",
    id: "cus_007",
    phone: "+54 379 522-3411",
    tags: [],
  },
  {
    address: { city: "Buenos Aires", country: "Argentina", number: "123", postalCode: "C1000", provinceOrState: "Buenos Aires", street: "Fixture Street" },
    email: "checkout-customer@entrenar.test",
    firstInteractionDate: new Date("2026-08-31T00:00:00.000Z"),
    fullName: "Checkout Fixture",
    id: CHECKOUT_CUSTOMER_ID,
    notes: "Repeatable customer fixture linked to the checkout seed order.",
    phone: "+54 11 5555-5555",
    tags: [],
    userId: "checkout-seed-customer",
  },
] as const;

export async function seedCustomersCrm(prisma: PrismaClient): Promise<void> {
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
