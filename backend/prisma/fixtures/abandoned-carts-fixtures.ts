import { createHash } from "node:crypto";

import { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import {
  CartStatus,
  CheckoutRecoveryStatus,
  CheckoutSessionStatus,
} from "../../src/generated/prisma/enums";

const CART_RECOVERY_SETTINGS_ID = "singleton";

interface CustomerSnapshotSeed {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface AbandonedCartLineItemSeed {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  snapshot: Prisma.InputJsonObject;
}

interface AbandonedCartHistorySeed {
  id: string;
  eventType: string;
  actorId?: string;
  actorRole?: string;
  notes?: string;
  metadata: Prisma.InputJsonObject;
  createdAt: Date;
}

interface AbandonedCartSessionSeed {
  sessionId: string;
  cartId: string;
  userId?: string;
  recoveryStatus: CheckoutRecoveryStatus;
  token: string;
  recoveryToken?: string;
  customer: CustomerSnapshotSeed;
  lineItems: readonly AbandonedCartLineItemSeed[];
  subtotal: number;
  total: number;
  lastActivityAt: Date;
  abandonedAt: Date;
  lastEmailSentAt?: Date;
  recoveryExpiresAt?: Date;
  history: readonly AbandonedCartHistorySeed[];
}

const DEFAULT_RECOVERY_SETTINGS = {
  id: CART_RECOVERY_SETTINGS_ID,
  isActive: true,
  timing: "24hs",
  emailSubject: "Te guardamos tu carrito en EntrenAR",
  emailHtmlBody: `<p>Hola {{nombre}},</p><p>Vimos que dejaste productos en tu carrito.</p><p><a href="{{checkoutUrl}}">Volver a mi carrito</a></p>`,
  emailPlainBody: "Hola {{nombre}},\n\nVimos que dejaste productos en tu carrito.\n\nVolver a mi carrito: {{checkoutUrl}}",
} as const;

export const ABANDONED_CART_FIXTURES: readonly AbandonedCartSessionSeed[] = [
  {
    abandonedAt: new Date("2026-09-02T10:00:00.000Z"),
    cartId: "abandoned-cart-seed-cart-pending",
    customer: {
      email: "camila.perez@example.com",
      firstName: "Camila",
      lastName: "Pérez",
      phone: "+54 11 4567-8901",
    },
    history: [
      {
        createdAt: new Date("2026-09-02T09:20:00.000Z"),
        eventType: "SESSION_CREATED",
        id: "abandoned-cart-seed-pending-created",
        metadata: { source: "seed", status: "ACTIVE" },
        actorRole: "SYSTEM",
      },
      {
        createdAt: new Date("2026-09-02T10:00:00.000Z"),
        eventType: "SESSION_ABANDONED",
        id: "abandoned-cart-seed-pending-abandoned",
        metadata: { threshold: "24hs" },
        notes: "Session exceeded the configured inactivity threshold.",
        actorRole: "SYSTEM",
      },
    ],
    lastActivityAt: new Date("2026-09-02T10:00:00.000Z"),
    lineItems: [
      {
        id: "abandoned-cart-seed-pending-item-whey",
        lineSubtotal: 157800,
        productId: "p-whey-pro",
        productName: "Whey Protein Isolate 900g",
        quantity: 2,
        sku: "SUP-WHEY-001-CHO",
        snapshot: { brand: "Body Advance", imageTone: "green", name: "Whey Protein Isolate 900g" },
        unitPrice: 78900,
        variantId: "chocolate-900",
        variantName: "Chocolate",
      },
    ],
    recoveryStatus: CheckoutRecoveryStatus.PENDING,
    sessionId: "abandoned-cart-seed-pending",
    subtotal: 157800,
    token: "abandoned-cart-seed-pending-session-token",
    total: 157800,
    userId: "checkout-seed-customer",
  },
  {
    abandonedAt: new Date("2026-09-01T14:30:00.000Z"),
    cartId: "abandoned-cart-seed-cart-sent",
    customer: {
      email: "martin.suarez@example.com",
      firstName: "Martín",
      lastName: "Suárez",
    },
    history: [
      {
        createdAt: new Date("2026-09-01T13:15:00.000Z"),
        eventType: "SESSION_CREATED",
        id: "abandoned-cart-seed-sent-created",
        metadata: { source: "seed", status: "ACTIVE" },
        actorRole: "SYSTEM",
      },
      {
        createdAt: new Date("2026-09-01T14:30:00.000Z"),
        eventType: "SESSION_ABANDONED",
        id: "abandoned-cart-seed-sent-abandoned",
        metadata: { threshold: "24hs" },
        notes: "Session exceeded the configured inactivity threshold.",
        actorRole: "SYSTEM",
      },
      {
        actorId: "seed-admin",
        actorRole: "ADMIN",
        createdAt: new Date("2026-09-02T09:00:00.000Z"),
        eventType: "RECOVERY_EMAIL_SENT",
        id: "abandoned-cart-seed-sent-email",
        metadata: { channel: "email", template: "default" },
        notes: "Recovery email simulated by the seed fixture.",
      },
    ],
    lastActivityAt: new Date("2026-09-01T14:30:00.000Z"),
    lastEmailSentAt: new Date("2026-09-02T09:00:00.000Z"),
    lineItems: [
      {
        id: "abandoned-cart-seed-sent-item-creatine",
        lineSubtotal: 31200,
        productId: "p-creatine",
        productName: "Creatina Monohidrato 300g",
        quantity: 1,
        sku: "SUP-CREA-300-SIN-SABOR-300",
        snapshot: { brand: "Star Nutrition", imageTone: "black", name: "Creatina Monohidrato 300g" },
        unitPrice: 31200,
        variantId: "sin-sabor-300",
        variantName: "Sin sabor",
      },
    ],
    recoveryExpiresAt: new Date("2026-09-09T09:00:00.000Z"),
    recoveryStatus: CheckoutRecoveryStatus.SENT,
    sessionId: "abandoned-cart-seed-sent",
    subtotal: 31200,
    token: "abandoned-cart-seed-sent-session-token",
    recoveryToken: "abandoned-cart-seed-sent-recovery-token",
    total: 31200,
  },
  {
    abandonedAt: new Date("2026-08-30T16:45:00.000Z"),
    cartId: "abandoned-cart-seed-cart-manual",
    customer: {
      email: "sofia.ledesma@example.com",
      firstName: "Sofía",
      lastName: "Ledesma",
    },
    history: [
      {
        createdAt: new Date("2026-08-30T15:25:00.000Z"),
        eventType: "SESSION_CREATED",
        id: "abandoned-cart-seed-manual-created",
        metadata: { source: "seed", status: "ACTIVE" },
        actorRole: "SYSTEM",
      },
      {
        createdAt: new Date("2026-08-30T16:45:00.000Z"),
        eventType: "SESSION_ABANDONED",
        id: "abandoned-cart-seed-manual-abandoned",
        metadata: { threshold: "24hs" },
        notes: "Session exceeded the configured inactivity threshold.",
        actorRole: "SYSTEM",
      },
      {
        actorId: "seed-admin",
        actorRole: "ADMIN",
        createdAt: new Date("2026-08-31T11:10:00.000Z"),
        eventType: "MANUAL_CONTACT_LOGGED",
        id: "abandoned-cart-seed-manual-contact",
        metadata: { channel: "phone" },
        notes: "Customer requested a callback before completing the purchase.",
      },
    ],
    lastActivityAt: new Date("2026-08-30T16:45:00.000Z"),
    lineItems: [
      {
        id: "abandoned-cart-seed-manual-item-boxy",
        lineSubtotal: 99998,
        productId: "p-boxy",
        productName: "Remera Boxy Fit DROP #0",
        quantity: 2,
        sku: "CAT-P-BOXY-NEGRO-M",
        snapshot: { brand: "EntrenAR", imageTone: "blue", name: "Remera Boxy Fit DROP #0" },
        unitPrice: 49999,
        variantId: "negro-m",
        variantName: "Negro / M",
      },
    ],
    recoveryStatus: CheckoutRecoveryStatus.MANUAL,
    sessionId: "abandoned-cart-seed-manual",
    subtotal: 99998,
    token: "abandoned-cart-seed-manual-session-token",
    total: 99998,
  },
  {
    abandonedAt: new Date("2026-08-28T12:00:00.000Z"),
    cartId: "abandoned-cart-seed-cart-discarded",
    customer: {
      email: "valentina.acosta@example.com",
      firstName: "Valentina",
      lastName: "Acosta",
    },
    history: [
      {
        createdAt: new Date("2026-08-28T10:40:00.000Z"),
        eventType: "SESSION_CREATED",
        id: "abandoned-cart-seed-discarded-created",
        metadata: { source: "seed", status: "ACTIVE" },
        actorRole: "SYSTEM",
      },
      {
        createdAt: new Date("2026-08-28T12:00:00.000Z"),
        eventType: "SESSION_ABANDONED",
        id: "abandoned-cart-seed-discarded-abandoned",
        metadata: { threshold: "24hs" },
        notes: "Session exceeded the configured inactivity threshold.",
        actorRole: "SYSTEM",
      },
      {
        actorId: "seed-admin",
        actorRole: "ADMIN",
        createdAt: new Date("2026-08-29T08:30:00.000Z"),
        eventType: "SESSION_DISCARDED",
        id: "abandoned-cart-seed-discarded-discarded",
        metadata: { reason: "Customer confirmed the purchase was no longer needed." },
        notes: "Customer confirmed the purchase was no longer needed.",
      },
    ],
    lastActivityAt: new Date("2026-08-28T12:00:00.000Z"),
    lineItems: [
      {
        id: "abandoned-cart-seed-discarded-item-shaker",
        lineSubtotal: 8900,
        productId: "p-shaker",
        productName: "Shaker EntrenAR 700ml",
        quantity: 1,
        sku: "CAT-P-SHAKER-VERDE-700",
        snapshot: { brand: "EntrenAR", imageTone: "green", name: "Shaker EntrenAR 700ml" },
        unitPrice: 8900,
        variantId: "verde-700",
        variantName: "Verde 700ml",
      },
    ],
    recoveryStatus: CheckoutRecoveryStatus.DISCARDED,
    sessionId: "abandoned-cart-seed-discarded",
    subtotal: 8900,
    token: "abandoned-cart-seed-discarded-session-token",
    total: 8900,
  },
] as const;

export async function seedAbandonedCarts(prisma: PrismaClient): Promise<void> {
  await prisma.cartRecoverySettings.upsert({
    where: { id: CART_RECOVERY_SETTINGS_ID },
    create: DEFAULT_RECOVERY_SETTINGS,
    update: {
      emailHtmlBody: DEFAULT_RECOVERY_SETTINGS.emailHtmlBody,
      emailPlainBody: DEFAULT_RECOVERY_SETTINGS.emailPlainBody,
      emailSubject: DEFAULT_RECOVERY_SETTINGS.emailSubject,
      isActive: DEFAULT_RECOVERY_SETTINGS.isActive,
      timing: DEFAULT_RECOVERY_SETTINGS.timing,
    },
  });

  for (const fixture of ABANDONED_CART_FIXTURES) {
    const snapshotData = buildSnapshotData(fixture);

    await prisma.cart.upsert({
      where: { id: fixture.cartId },
      create: {
        id: fixture.cartId,
        status: CartStatus.ABANDONED,
        userId: fixture.userId ?? null,
      },
      update: {
        status: CartStatus.ABANDONED,
        userId: fixture.userId ?? null,
      },
    });

    for (const item of fixture.lineItems) {
      await prisma.cartItem.upsert({
        where: { id: item.id },
        create: {
          cartId: fixture.cartId,
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variantId,
        },
        update: {
          cartId: fixture.cartId,
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variantId,
        },
      });
    }

    await prisma.checkoutSession.upsert({
      where: { id: fixture.sessionId },
      create: {
        abandonedAt: fixture.abandonedAt,
        cartId: fixture.cartId,
        completedAt: null,
        id: fixture.sessionId,
        lastActivityAt: fixture.lastActivityAt,
        lastEmailSentAt: fixture.lastEmailSentAt ?? null,
        recoveryExpiresAt: fixture.recoveryExpiresAt ?? null,
        recoveryStatus: fixture.recoveryStatus,
        recoveryTokenHash: fixture.recoveryToken ? hashFixtureToken(fixture.recoveryToken) : null,
        snapshotData,
        status: CheckoutSessionStatus.ABANDONED,
        tokenHash: hashFixtureToken(fixture.token),
        userId: fixture.userId ?? null,
      },
      update: {
        abandonedAt: fixture.abandonedAt,
        cartId: fixture.cartId,
        completedAt: null,
        lastActivityAt: fixture.lastActivityAt,
        lastEmailSentAt: fixture.lastEmailSentAt ?? null,
        recoveryExpiresAt: fixture.recoveryExpiresAt ?? null,
        recoveryStatus: fixture.recoveryStatus,
        recoveryTokenHash: fixture.recoveryToken ? hashFixtureToken(fixture.recoveryToken) : null,
        snapshotData,
        status: CheckoutSessionStatus.ABANDONED,
        tokenHash: hashFixtureToken(fixture.token),
        userId: fixture.userId ?? null,
      },
    });

    for (const event of fixture.history) {
      await prisma.checkoutSessionHistory.upsert({
        where: { id: event.id },
        create: {
          actorId: event.actorId ?? null,
          actorRole: event.actorRole ?? null,
          checkoutSessionId: fixture.sessionId,
          createdAt: event.createdAt,
          eventType: event.eventType,
          id: event.id,
          metadata: event.metadata,
          notes: event.notes ?? null,
        },
        update: {
          actorId: event.actorId ?? null,
          actorRole: event.actorRole ?? null,
          checkoutSessionId: fixture.sessionId,
          createdAt: event.createdAt,
          eventType: event.eventType,
          metadata: event.metadata,
          notes: event.notes ?? null,
        },
      });
    }
  }
}

function buildSnapshotData(fixture: AbandonedCartSessionSeed): Prisma.InputJsonObject {
  return {
    currency: "ARS",
    customer: {
      email: fixture.customer.email,
      firstName: fixture.customer.firstName,
      lastName: fixture.customer.lastName,
      ...(fixture.customer.phone === undefined ? {} : { phone: fixture.customer.phone }),
    },
    items: fixture.lineItems.map((item) => ({
      lineSubtotal: item.lineSubtotal,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      sku: item.sku,
      snapshot: item.snapshot,
      unitPrice: item.unitPrice,
      variantId: item.variantId,
      variantName: item.variantName,
    })),
    subtotal: fixture.subtotal,
    total: fixture.total,
  };
}

function hashFixtureToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
