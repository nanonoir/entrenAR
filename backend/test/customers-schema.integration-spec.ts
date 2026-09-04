import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { OrderDeliveryType } from "../src/generated/prisma/enums";

const databaseUrl = process.env["DATABASE_URL"];

describe("customers CRM schema integration", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });
  const suffix = randomUUID().replaceAll("-", "");
  const fixture = {
    customerId: `customers-schema-${suffix}`,
    email: `customers-schema-${suffix}@example.test`,
    orderId: `customers-schema-order-${suffix}`,
    orderNumber: `EN-CUSTOMERS-SCHEMA-${suffix}`,
    userId: `customers-schema-user-${suffix}`,
  } as const;
  const anonymizedCustomerId = `customers-schema-anonymized-${suffix}`;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for customers schema integration tests.");

    await prisma.user.create({
      data: {
        email: `customers-schema-user-${suffix}@example.test`,
        id: fixture.userId,
        passwordHash: "schema-test-hash",
      },
    });
    await prisma.customer.create({
      data: {
        address: {
          create: {
            city: "Buenos Aires",
            number: "123",
            postalCode: "C1000",
            provinceOrState: "Buenos Aires",
            street: "Schema Street",
          },
        },
        email: fixture.email,
        firstInteractionDate: new Date("2026-09-01T00:00:00.000Z"),
        fullName: "Schema Fixture",
        id: fixture.customerId,
        notes: "Customer schema integration fixture.",
        tags: ["integration", "crm"],
        userId: fixture.userId,
      },
    });
    await prisma.order.create({
      data: {
        customerEmail: fixture.email,
        customerFirstName: "Schema",
        customerId: fixture.customerId,
        customerLastName: "Fixture",
        deliveryType: OrderDeliveryType.SHIPPING,
        id: fixture.orderId,
        number: fixture.orderNumber,
        subtotal: "100.00",
        total: "100.00",
        userId: fixture.userId,
      },
    });
  });

  afterAll(async () => {
    if (!databaseUrl) return;
    try {
      await prisma.order.deleteMany({ where: { id: fixture.orderId } });
      await prisma.customerAddress.deleteMany({ where: { customerId: { in: [fixture.customerId, anonymizedCustomerId] } } });
      await prisma.customer.deleteMany({ where: { id: { in: [fixture.customerId, anonymizedCustomerId] } } });
      await prisma.user.deleteMany({ where: { id: fixture.userId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("persists customer, address, user, and order relations", async () => {
    const customer = await prisma.customer.findUniqueOrThrow({
      include: { address: true, orders: true, user: true },
      where: { id: fixture.customerId },
    });
    const order = await prisma.order.findUniqueOrThrow({ include: { customer: true }, where: { id: fixture.orderId } });

    expect(customer).toEqual(expect.objectContaining({
      email: fixture.email,
      fullName: "Schema Fixture",
      id: fixture.customerId,
      tags: ["integration", "crm"],
      userId: fixture.userId,
    }));
    expect(customer.address).toEqual(expect.objectContaining({
      city: "Buenos Aires",
      country: "Argentina",
      customerId: fixture.customerId,
      postalCode: "C1000",
    }));
    expect(customer.user).toEqual(expect.objectContaining({ id: fixture.userId }));
    expect(customer.orders).toEqual([expect.objectContaining({ customerId: fixture.customerId, id: fixture.orderId })]);
    expect(order.customer).toEqual(expect.objectContaining({ id: fixture.customerId }));
  });

  it("enforces case-insensitive uniqueness only for active customer emails", async () => {
    await prisma.customer.create({
      data: {
        email: fixture.email,
        fullName: `Cliente eliminado (${anonymizedCustomerId})`,
        id: anonymizedCustomerId,
        isAnonymized: true,
        tags: [],
      },
    });

    await expect(prisma.customer.create({
      data: {
        email: fixture.email.toUpperCase(),
        fullName: "Duplicate Active Customer",
        id: `customers-schema-duplicate-${suffix}`,
        tags: [],
      },
    })).rejects.toMatchObject({ code: "P2002" });
  });
});
