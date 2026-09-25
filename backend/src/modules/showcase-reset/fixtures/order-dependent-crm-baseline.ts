import { createHash } from "node:crypto";

import type { Prisma } from "../../../generated/prisma/client";
import type { SupplierStatus } from "../../../generated/prisma/enums";
import { CHECKOUT_FIXTURE, hashShowcaseFixtureToken } from "./checkout-customer-baseline";

interface SupplierFixture {
  code: string;
  contactName: string;
  email: string;
  id: string;
  name: string;
  notes: string;
  phone: string;
  status: SupplierStatus;
}

interface AbandonedCartLineItemFixture {
  id: string;
  lineSubtotal: number;
  productId: string;
  productName: string;
  quantity: number;
  sku: string;
  snapshot: Prisma.InputJsonObject;
  unitPrice: number;
  variantId: string;
  variantName: string;
}

interface AbandonedCartHistoryFixture {
  actorId?: string;
  actorRole?: string;
  createdAt: Date;
  eventType: string;
  id: string;
  metadata: Prisma.InputJsonObject;
  notes?: string;
}

interface AbandonedCartFixture {
  abandonedAt: Date;
  cartId: string;
  customer: { email: string; firstName: string; lastName: string; phone?: string };
  history: readonly AbandonedCartHistoryFixture[];
  lastActivityAt: Date;
  lastEmailSentAt?: Date;
  lineItems: readonly AbandonedCartLineItemFixture[];
  recoveryExpiresAt?: Date;
  recoveryStatus: "PENDING" | "SENT" | "MANUAL" | "DISCARDED";
  recoveryToken?: string;
  sessionId: string;
  subtotal: number;
  token: string;
  total: number;
  userId?: string;
}

const CHECKOUT_ORDER_FIXTURE = {
  idempotency: {
    completedAt: new Date("2026-08-31T00:00:00.000Z"), id: CHECKOUT_FIXTURE.idempotencyId, idempotencyKey: CHECKOUT_FIXTURE.idempotencyKey,
    orderId: CHECKOUT_FIXTURE.orderId, ownerKey: `user:${CHECKOUT_FIXTURE.customerId}`,
    requestHash: hashShowcaseFixtureToken(`${CHECKOUT_FIXTURE.orderId}:${CHECKOUT_FIXTURE.idempotencyKey}`),
    responseSnapshot: { number: CHECKOUT_FIXTURE.orderNumber, ok: true, orderId: CHECKOUT_FIXTURE.orderId }, status: "COMPLETED" as const,
  },
  item: {
    attributes: { option: "sin-sabor-300" }, compareAtPrice: null, id: CHECKOUT_FIXTURE.orderItemId, lineSubtotal: "31200.00", orderId: CHECKOUT_FIXTURE.orderId,
    productId: "p-creatine", productName: "Creatina Monohidrato 300g", quantity: 1, sku: "SUP-CREA-300-SIN-SABOR-300",
    snapshot: { brand: "Star Nutrition", name: "Creatina Monohidrato 300g", weightGrams: null }, unitPrice: "31200.00", variantId: "sin-sabor-300", variantName: "Sin sabor", weightGrams: null,
  },
  order: {
    couponCode: CHECKOUT_FIXTURE.couponCode, currency: "ARS", customerDni: "20123456789", customerEmail: CHECKOUT_FIXTURE.customerEmail,
    customerFirstName: "Checkout", customerLastName: "Fixture", customerPhone: "+54 11 5555-5555",
    customerSnapshot: { dni: "20123456789", email: CHECKOUT_FIXTURE.customerEmail, firstName: "Checkout", lastName: "Fixture", phone: "+54 11 5555-5555" },
    deliverySnapshot: { methodId: "andreani:envío-a-domicilio", providerId: "andreani", providerName: "Andreani" }, deliveryType: "SHIPPING" as const,
    discountAmount: "3120.00", discountSnapshot: { couponCode: CHECKOUT_FIXTURE.couponCode, couponDiscount: 3120, couponType: "percentage" }, id: CHECKOUT_FIXTURE.orderId,
    inventoryEffectId: null, inventoryPolicy: "UNKNOWN" as const, number: CHECKOUT_FIXTURE.orderNumber,
    shippingAddressSnapshot: { city: "Buenos Aires", postalCode: "C1000", province: "Buenos Aires", recipient: "Checkout Fixture", street: "123 Test Street" },
    shippingCost: "0.00", shippingStatus: "TO_PACK" as const, status: "PENDING" as const, subtotal: "31200.00", total: "28080.00", userId: CHECKOUT_FIXTURE.customerId,
  },
  payment: {
    amount: "28080.00", bankTransferSnapshot: { alias: "ENTRENAR.DEMO", bankName: "Banco Demo", cbuCvu: "0000000000000000000000", holderName: "EntrenAR Demo" },
    currency: "ARS", id: CHECKOUT_FIXTURE.paymentId, orderId: CHECKOUT_FIXTURE.orderId, paymentMethodId: "bank-transfer",
    paymentMethodSnapshot: { id: "bank-transfer", name: "Transferencia Bancaria", optionId: "direct-transfer" }, paymentOptionId: "direct-transfer", status: "PENDING" as const,
  },
  redemption: {
    couponCode: CHECKOUT_FIXTURE.couponCode, couponId: CHECKOUT_FIXTURE.couponId, customerKeyHash: hashShowcaseFixtureToken(CHECKOUT_FIXTURE.customerEmail),
    discountAmount: "3120.00", id: "checkout-seed-redemption", orderId: CHECKOUT_FIXTURE.orderId, userId: CHECKOUT_FIXTURE.customerId,
  },
} as const;

const CHECKOUT_ORDER_HISTORY = {
  actorRole: "CUSTOMER" as const, createdAt: new Date("2026-09-01T12:00:00.000Z"), description: "The checkout fixture order was created and persisted.",
  id: "sales-crm-seed-order-created", metadata: { orderNumber: CHECKOUT_FIXTURE.orderNumber, source: "checkout-seed" }, orderId: CHECKOUT_FIXTURE.orderId,
  title: "Order created", type: "ORDER_CREATED" as const,
} as const;

const SUPPLIERS: readonly SupplierFixture[] = [
  { code: "SUP-ENTRENAR-NUTRITION", contactName: "Demo Nutrition Contact", email: "nutrition-supplier@entrenar.test", id: "sales-crm-seed-supplier-nutrition", name: "EntrenAR Nutrition Wholesale", notes: "Repeatable supplier fixture for the sales CRM foundation.", phone: "+54 11 5555-0101", status: "ACTIVE" },
  { code: "SUP-ENTRENAR-EQUIPMENT", contactName: "Demo Equipment Contact", email: "equipment-supplier@entrenar.test", id: "sales-crm-seed-supplier-equipment", name: "EntrenAR Equipment Wholesale", notes: "Inactive supplier fixture for status filtering.", phone: "+54 11 5555-0102", status: "INACTIVE" },
] as const;

const DEFAULT_RECOVERY_SETTINGS = {
  emailHtmlBody: `<p>Hola {{nombre}},</p><p>Vimos que dejaste productos en tu carrito.</p><p><a href="{{checkoutUrl}}">Volver a mi carrito</a></p>`,
  emailPlainBody: "Hola {{nombre}},\n\nVimos que dejaste productos en tu carrito.\n\nVolver a mi carrito: {{checkoutUrl}}",
  emailSubject: "Te guardamos tu carrito en EntrenAR", id: "singleton", isActive: true, timing: "24hs",
} as const;

const ABANDONED_CART_FIXTURES: readonly AbandonedCartFixture[] = [
  {
    abandonedAt: new Date("2026-09-02T10:00:00.000Z"), cartId: "abandoned-cart-seed-cart-pending", customer: { email: "camila.perez@example.com", firstName: "Camila", lastName: "Pérez", phone: "+54 11 4567-8901" }, lastActivityAt: new Date("2026-09-02T10:00:00.000Z"),
    history: [{ actorRole: "SYSTEM", createdAt: new Date("2026-09-02T09:20:00.000Z"), eventType: "SESSION_CREATED", id: "abandoned-cart-seed-pending-created", metadata: { source: "seed", status: "ACTIVE" } }, { actorRole: "SYSTEM", createdAt: new Date("2026-09-02T10:00:00.000Z"), eventType: "SESSION_ABANDONED", id: "abandoned-cart-seed-pending-abandoned", metadata: { threshold: "24hs" }, notes: "Session exceeded the configured inactivity threshold." }],
    lineItems: [{ id: "abandoned-cart-seed-pending-item-whey", lineSubtotal: 157800, productId: "p-whey-pro", productName: "Whey Protein Isolate 900g", quantity: 2, sku: "SUP-WHEY-001-CHO", snapshot: { brand: "Body Advance", imageTone: "green", name: "Whey Protein Isolate 900g" }, unitPrice: 78900, variantId: "chocolate-900", variantName: "Chocolate" }], recoveryStatus: "PENDING", sessionId: "abandoned-cart-seed-pending", subtotal: 157800, token: "abandoned-cart-seed-pending-session-token", total: 157800, userId: CHECKOUT_FIXTURE.customerId,
  },
  {
    abandonedAt: new Date("2026-09-01T14:30:00.000Z"), cartId: "abandoned-cart-seed-cart-sent", customer: { email: "martin.suarez@example.com", firstName: "Martín", lastName: "Suárez" }, lastActivityAt: new Date("2026-09-01T14:30:00.000Z"), lastEmailSentAt: new Date("2026-09-02T09:00:00.000Z"), recoveryExpiresAt: new Date("2026-09-09T09:00:00.000Z"), recoveryStatus: "SENT", recoveryToken: "abandoned-cart-seed-sent-recovery-token", sessionId: "abandoned-cart-seed-sent", subtotal: 31200, token: "abandoned-cart-seed-sent-session-token", total: 31200,
    history: [{ actorRole: "SYSTEM", createdAt: new Date("2026-09-01T13:15:00.000Z"), eventType: "SESSION_CREATED", id: "abandoned-cart-seed-sent-created", metadata: { source: "seed", status: "ACTIVE" } }, { actorRole: "SYSTEM", createdAt: new Date("2026-09-01T14:30:00.000Z"), eventType: "SESSION_ABANDONED", id: "abandoned-cart-seed-sent-abandoned", metadata: { threshold: "24hs" }, notes: "Session exceeded the configured inactivity threshold." }, { actorId: "seed-admin", actorRole: "ADMIN", createdAt: new Date("2026-09-02T09:00:00.000Z"), eventType: "RECOVERY_EMAIL_SENT", id: "abandoned-cart-seed-sent-email", metadata: { channel: "email", template: "default" }, notes: "Recovery email simulated by the seed fixture." }],
    lineItems: [{ id: "abandoned-cart-seed-sent-item-creatine", lineSubtotal: 31200, productId: "p-creatine", productName: "Creatina Monohidrato 300g", quantity: 1, sku: "SUP-CREA-300-SIN-SABOR-300", snapshot: { brand: "Star Nutrition", imageTone: "black", name: "Creatina Monohidrato 300g" }, unitPrice: 31200, variantId: "sin-sabor-300", variantName: "Sin sabor" }],
  },
  {
    abandonedAt: new Date("2026-08-30T16:45:00.000Z"), cartId: "abandoned-cart-seed-cart-manual", customer: { email: "sofia.ledesma@example.com", firstName: "Sofía", lastName: "Ledesma" }, lastActivityAt: new Date("2026-08-30T16:45:00.000Z"), recoveryStatus: "MANUAL", sessionId: "abandoned-cart-seed-manual", subtotal: 99998, token: "abandoned-cart-seed-manual-session-token", total: 99998,
    history: [{ actorRole: "SYSTEM", createdAt: new Date("2026-08-30T15:25:00.000Z"), eventType: "SESSION_CREATED", id: "abandoned-cart-seed-manual-created", metadata: { source: "seed", status: "ACTIVE" } }, { actorRole: "SYSTEM", createdAt: new Date("2026-08-30T16:45:00.000Z"), eventType: "SESSION_ABANDONED", id: "abandoned-cart-seed-manual-abandoned", metadata: { threshold: "24hs" }, notes: "Session exceeded the configured inactivity threshold." }, { actorId: "seed-admin", actorRole: "ADMIN", createdAt: new Date("2026-08-31T11:10:00.000Z"), eventType: "MANUAL_CONTACT_LOGGED", id: "abandoned-cart-seed-manual-contact", metadata: { channel: "phone" }, notes: "Customer requested a callback before completing the purchase." }],
    lineItems: [{ id: "abandoned-cart-seed-manual-item-boxy", lineSubtotal: 99998, productId: "p-boxy", productName: "Remera Boxy Fit DROP #0", quantity: 2, sku: "CAT-P-BOXY-NEGRO-M", snapshot: { brand: "EntrenAR", imageTone: "blue", name: "Remera Boxy Fit DROP #0" }, unitPrice: 49999, variantId: "negro-m", variantName: "Negro / M" }],
  },
  {
    abandonedAt: new Date("2026-08-28T12:00:00.000Z"), cartId: "abandoned-cart-seed-cart-discarded", customer: { email: "valentina.acosta@example.com", firstName: "Valentina", lastName: "Acosta" }, lastActivityAt: new Date("2026-08-28T12:00:00.000Z"), recoveryStatus: "DISCARDED", sessionId: "abandoned-cart-seed-discarded", subtotal: 8900, token: "abandoned-cart-seed-discarded-session-token", total: 8900,
    history: [{ actorRole: "SYSTEM", createdAt: new Date("2026-08-28T10:40:00.000Z"), eventType: "SESSION_CREATED", id: "abandoned-cart-seed-discarded-created", metadata: { source: "seed", status: "ACTIVE" } }, { actorRole: "SYSTEM", createdAt: new Date("2026-08-28T12:00:00.000Z"), eventType: "SESSION_ABANDONED", id: "abandoned-cart-seed-discarded-abandoned", metadata: { threshold: "24hs" }, notes: "Session exceeded the configured inactivity threshold." }, { actorId: "seed-admin", actorRole: "ADMIN", createdAt: new Date("2026-08-29T08:30:00.000Z"), eventType: "SESSION_DISCARDED", id: "abandoned-cart-seed-discarded-discarded", metadata: { reason: "Customer confirmed the purchase was no longer needed." }, notes: "Customer confirmed the purchase was no longer needed." }],
    lineItems: [{ id: "abandoned-cart-seed-discarded-item-shaker", lineSubtotal: 8900, productId: "p-shaker", productName: "Shaker EntrenAR 700ml", quantity: 1, sku: "CAT-P-SHAKER-VERDE-700", snapshot: { brand: "EntrenAR", imageTone: "green", name: "Shaker EntrenAR 700ml" }, unitPrice: 8900, variantId: "verde-700", variantName: "Verde 700ml" }],
  },
] as const;

function hashAbandonedFixtureToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function abandonedSnapshotData(fixture: AbandonedCartFixture): Prisma.InputJsonObject {
  return { currency: "ARS", customer: { ...fixture.customer }, items: fixture.lineItems.map((item) => ({ lineSubtotal: item.lineSubtotal, productId: item.productId, productName: item.productName, quantity: item.quantity, sku: item.sku, snapshot: item.snapshot, unitPrice: item.unitPrice, variantId: item.variantId, variantName: item.variantName })), subtotal: fixture.subtotal, total: fixture.total };
}

export { ABANDONED_CART_FIXTURES, CHECKOUT_ORDER_FIXTURE, CHECKOUT_ORDER_HISTORY, DEFAULT_RECOVERY_SETTINGS, SUPPLIERS, abandonedSnapshotData, hashAbandonedFixtureToken };
export type { AbandonedCartFixture, SupplierFixture };
