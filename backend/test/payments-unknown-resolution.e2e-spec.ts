import { randomUUID } from "node:crypto";

import * as bcrypt from "bcrypt";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { loadAppConfig } from "../src/config/app.config";
import {
  CatalogVisibility,
  InventoryOperation,
  OrderDeliveryType,
  OrderInventoryPolicy,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentStatus,
  Role,
  StockMode,
} from "../src/generated/prisma/enums";
import { processedAccreditedOrder } from "../src/modules/payments/mercadopago/__fixtures__/orders.fixtures";
import {
  MERCADOPAGO_ERROR_CATEGORY,
  MERCADOPAGO_ORDERS_PORT,
  MercadoPagoOrdersError,
  type MercadoPagoOrdersPort,
} from "../src/modules/payments/mercadopago/mercadopago-orders.port";
import { AuthService } from "../src/modules/auth/auth.service";
import { providerOrder } from "./support/payments-card.helpers";
import { settlePaymentFixtures } from "./support/payments-settle.helpers";

process.env["MERCADOPAGO_ACCESS_TOKEN"] = "TEST-e2e-access-token";
process.env["MERCADOPAGO_WEBHOOK_SECRET"] = "e2e-webhook-secret";
process.env["MERCADOPAGO_ENVIRONMENT"] = "test";

const MINUTE = 60_000;
const STOCK_BEFORE_SALE = 10;
const SOLD = 2;

describe("admin resolution of UNKNOWN Mercado Pago attempts (e2e, mocked provider port)", () => {
  const suffix = randomUUID().slice(0, 8);
  const port = { createOrder: jest.fn(), getOrder: jest.fn(), searchOrders: jest.fn() };
  const orderIds: string[] = [];
  const userIds: string[] = [];
  let app: INestApplication;
  let baseUrl = "";
  let prisma: PrismaService;
  let adminToken = "";
  let customerToken = "";
  let adminId = "";
  let productId = "";
  let sequence = 0;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MERCADOPAGO_ORDERS_PORT)
      .useValue(port as unknown as MercadoPagoOrdersPort)
      .compile();
    prisma = moduleFixture.get(PrismaService);
    const password = `Unknown-${randomUUID()}-A1!`;
    adminId = `unknown-admin-${suffix}`;
    const customerId = `unknown-customer-${suffix}`;
    userIds.push(adminId, customerId);
    await prisma.user.createMany({ data: [
      { email: `${adminId}@example.test`, id: adminId, passwordHash: await bcrypt.hash(password, 4), role: Role.ADMIN },
      { email: `${customerId}@example.test`, id: customerId, passwordHash: await bcrypt.hash(password, 4), role: Role.CUSTOMER },
    ] });
    const auth = moduleFixture.get(AuthService);
    adminToken = (await auth.loginAdmin(`${adminId}@example.test`, password)).accessToken;
    customerToken = (await auth.login(`${customerId}@example.test`, password)).accessToken;
    productId = (await prisma.product.create({
      data: {
        name: `Unknown ${suffix}`,
        price: 100,
        publicSlug: `unknown-${suffix}`,
        slug: `unknown-${suffix}`,
        visibility: CatalogVisibility.HIDDEN,
        variants: { create: { name: "Base", quantity: 0, sku: `UNK-BASE-${suffix}`, stockMode: StockMode.TRACKED } },
      },
    })).id;
    const nestApp = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(nestApp, loadAppConfig());
    await nestApp.listen(0, "127.0.0.1");
    app = nestApp;
    baseUrl = await nestApp.getUrl();
  });

  beforeEach(() => {
    port.getOrder.mockReset();
    port.searchOrders.mockReset();
  });

  afterAll(async () => {
    try {
      // The append-only stock ledger keeps its product/variants (unique per run, `Unknown <suffix>`).
      if (prisma) {
        await settlePaymentFixtures(prisma, { id: { in: orderIds } });
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await app?.close();
    }
  });

  async function createScenario(options: { attentionRequiredAt?: Date; providerOrderId?: string; status?: PaymentAttemptStatus; submittedMinutesAgo?: number } = {}) {
    sequence += 1;
    const label = `${suffix}-${sequence}`;
    const variant = await prisma.productVariant.create({
      data: { name: `Variant ${label}`, productId, quantity: STOCK_BEFORE_SALE - SOLD, sku: `UNK-${label}`, stockMode: StockMode.TRACKED },
    });
    const inventoryEffectId = `unknown-effect-${label}`;
    const order = await prisma.order.create({
      data: {
        customerEmail: `buyer-${label}@example.test`,
        customerFirstName: "Pay",
        customerLastName: "Test",
        deliveryType: OrderDeliveryType.PICKUP,
        inventoryEffectId,
        inventoryPolicy: OrderInventoryPolicy.LEDGER_MANAGED,
        items: { create: [{ lineSubtotal: 200, productId, productName: "Unknown", quantity: SOLD, sku: `UNK-${label}`, unitPrice: 100, variantId: variant.id }] },
        number: `UNK-${label}`,
        status: OrderStatus.PENDING,
        subtotal: 200,
        total: 200,
      },
    });
    orderIds.push(order.id);
    await prisma.inventoryHistory.create({
      data: {
        delta: -SOLD, inventoryEffectId, operation: InventoryOperation.SUBTRACT, origin: "checkout", productId,
        resultingQuantity: STOCK_BEFORE_SALE - SOLD, stockMode: StockMode.TRACKED, variantId: variant.id,
      },
    });
    const payment = await prisma.orderPayment.create({
      data: {
        amount: 200,
        ...(options.attentionRequiredAt ? { attentionReason: "unresolved_unknown_outcome", attentionRequiredAt: options.attentionRequiredAt } : {}),
        attempts: {
          create: [{
            attemptNumber: 1,
            clientKey: `client-${label}`,
            expectedAmount: 200,
            providerIdempotencyKey: `idem-${label}`,
            providerOrderId: options.providerOrderId ?? null,
            requestHash: "hash",
            status: options.status ?? PaymentAttemptStatus.UNKNOWN,
            submittedAt: new Date(Date.now() - (options.submittedMinutesAgo ?? 1) * MINUTE),
          }],
        },
        orderId: order.id,
        paymentMethodId: "mercado-pago",
        provider: PaymentProvider.MERCADOPAGO,
        status: PaymentStatus.PENDING,
      },
      include: { attempts: true },
    });
    return { attemptId: payment.attempts[0]!.id, orderId: order.id, variantId: variant.id };
  }

  const resolve = (orderId: string, token?: string) => fetch(`${baseUrl}/api/v1/admin/sales/${orderId}/payment/resolve-unknown`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    method: "POST",
  });
  const stockOf = async (variantId: string) => (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).quantity;
  const restorationsOf = (variantId: string) => prisma.inventoryHistory.count({
    where: { compensatesMovementId: { not: null }, operation: InventoryOperation.ADD, variantId },
  });

  it("rejects unauthenticated requests with 401 and customers with 403", async () => {
    const scenario = await createScenario({ attentionRequiredAt: new Date() });
    expect((await resolve(scenario.orderId)).status).toBe(401);
    expect((await resolve(scenario.orderId, customerToken)).status).toBe(403);
    expect(port.searchOrders).not.toHaveBeenCalled();
  });

  it("answers 409 and never calls the provider when the attempt is not eligible", async () => {
    const recent = await createScenario({ submittedMinutesAgo: 5 });
    const processing = await createScenario({ attentionRequiredAt: new Date(), status: PaymentAttemptStatus.PROCESSING });

    for (const scenario of [recent, processing]) {
      const response = await resolve(scenario.orderId, adminToken);
      expect(response.status).toBe(409);
      expect(await stockOf(scenario.variantId)).toBe(STOCK_BEFORE_SALE - SOLD);
    }
    expect(port.searchOrders).not.toHaveBeenCalled();
    expect(port.getOrder).not.toHaveBeenCalled();
  });

  it("changes nothing and answers 503 when the provider check fails", async () => {
    const scenario = await createScenario({ submittedMinutesAgo: 45 });
    port.searchOrders.mockRejectedValue(new MercadoPagoOrdersError("down", { category: MERCADOPAGO_ERROR_CATEGORY.TRANSIENT }));

    expect((await resolve(scenario.orderId, adminToken)).status).toBe(503);

    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: scenario.attemptId } })).status).toBe(PaymentAttemptStatus.UNKNOWN);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: scenario.orderId } })).status).toBe(OrderStatus.PENDING);
    expect(await restorationsOf(scenario.variantId)).toBe(0);
  });

  it("applies a provider order found by external reference through the reducer and cancels nothing", async () => {
    const scenario = await createScenario({ attentionRequiredAt: new Date() });
    const accredited = providerOrder(processedAccreditedOrder, scenario.orderId);
    port.searchOrders.mockResolvedValue([accredited]);
    port.getOrder.mockResolvedValue(accredited);

    const response = await resolve(scenario.orderId, adminToken);

    expect(response.status).toBe(200);
    expect(port.getOrder).toHaveBeenCalledWith(accredited.id);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: scenario.attemptId } })).status).toBe(PaymentAttemptStatus.APPROVED);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: scenario.orderId } })).status).toBe(OrderStatus.CONFIRMED);
    expect(await restorationsOf(scenario.variantId)).toBe(0);
  });

  it("cancels the order and returns stock exactly once when the provider confirms nothing exists", async () => {
    const scenario = await createScenario({ submittedMinutesAgo: 45 });
    port.searchOrders.mockResolvedValue([]);

    const responses = await Promise.all([resolve(scenario.orderId, adminToken), resolve(scenario.orderId, adminToken)]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: scenario.attemptId } });
    expect(attempt.status).toBe(PaymentAttemptStatus.CANCELLED);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: scenario.orderId } })).status).toBe(OrderStatus.CANCELLED);
    expect(await stockOf(scenario.variantId)).toBe(STOCK_BEFORE_SALE);
    expect(await restorationsOf(scenario.variantId)).toBe(1);
    const history = await prisma.orderHistory.findMany({ where: { actorId: adminId, orderId: scenario.orderId } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ actorRole: Role.ADMIN, title: "Order cancelled" });
  });
});
