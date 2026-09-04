import { PrismaClient } from "../../src/generated/prisma/client";
import { OrderHistoryEventType, Role, SupplierStatus } from "../../src/generated/prisma/enums";

interface SupplierSeed {
  id: string;
  name: string;
  code: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
  status: SupplierStatus;
}

const SUPPLIERS: readonly SupplierSeed[] = [
  {
    id: "sales-crm-seed-supplier-nutrition",
    name: "EntrenAR Nutrition Wholesale",
    code: "SUP-ENTRENAR-NUTRITION",
    contactName: "Demo Nutrition Contact",
    email: "nutrition-supplier@entrenar.test",
    phone: "+54 11 5555-0101",
    notes: "Repeatable supplier fixture for the sales CRM foundation.",
    status: SupplierStatus.ACTIVE,
  },
  {
    id: "sales-crm-seed-supplier-equipment",
    name: "EntrenAR Equipment Wholesale",
    code: "SUP-ENTRENAR-EQUIPMENT",
    contactName: "Demo Equipment Contact",
    email: "equipment-supplier@entrenar.test",
    phone: "+54 11 5555-0102",
    notes: "Inactive supplier fixture for status filtering.",
    status: SupplierStatus.INACTIVE,
  },
] as const;

export async function seedSalesCrm(prisma: PrismaClient): Promise<void> {
  for (const supplier of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { id: supplier.id },
      create: supplier,
      update: {
        code: supplier.code,
        contactName: supplier.contactName,
        email: supplier.email,
        name: supplier.name,
        notes: supplier.notes,
        phone: supplier.phone,
        status: supplier.status,
      },
    });
  }

  await prisma.orderHistory.upsert({
    where: { id: "sales-crm-seed-order-created" },
    create: {
      actorRole: Role.CUSTOMER,
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
      description: "The checkout fixture order was created and persisted.",
      id: "sales-crm-seed-order-created",
      metadata: {
        orderNumber: "EN-CHK-000001",
        source: "checkout-seed",
      },
      orderId: "checkout-seed-order",
      title: "Order created",
      type: OrderHistoryEventType.ORDER_CREATED,
    },
    update: {
      actorRole: Role.CUSTOMER,
      description: "The checkout fixture order was created and persisted.",
      metadata: {
        orderNumber: "EN-CHK-000001",
        source: "checkout-seed",
      },
      orderId: "checkout-seed-order",
      title: "Order created",
      type: OrderHistoryEventType.ORDER_CREATED,
    },
  });
}
