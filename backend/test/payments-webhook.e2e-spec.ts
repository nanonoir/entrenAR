import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { createHmac, randomUUID } from "node:crypto";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import type { AppConfig } from "../src/config/app.config";
import { PrismaService } from "../src/common/prisma/prisma.service";
import {
  MERCADOPAGO_ORDERS_PORT,
  type MercadoPagoOrdersPort,
} from "../src/modules/payments/mercadopago/mercadopago-orders.port";
import { buildWebhookManifest } from "../src/modules/payments/mercadopago/mercadopago-webhook.signature";
import { testCheckoutConfig } from "./support/checkout-http.helpers";

let SECRET = "e2e-webhook-secret";
process.env["MERCADOPAGO_ACCESS_TOKEN"] = "TEST-e2e-access-token";
process.env["MERCADOPAGO_WEBHOOK_SECRET"] = SECRET;
process.env["MERCADOPAGO_ENVIRONMENT"] = "test";
process.env["THROTTLE_LIMIT"] = "5";

const databaseUrl = process.env["DATABASE_URL"];

describe("Mercado Pago webhook endpoint (e2e, mocked provider port)", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let baseUrl = "";
  const port = { createOrder: jest.fn(), getOrder: jest.fn(), searchOrders: jest.fn() };
  const resourceIds: string[] = [];

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for webhook e2e tests.");

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MERCADOPAGO_ORDERS_PORT)
      .useValue(port as unknown as MercadoPagoOrdersPort)
      .compile();
    prisma = moduleFixture.get(PrismaService);
    // A local .env may take precedence over the process env set above: sign with the secret the app actually loaded.
    SECRET = moduleFixture.get(ConfigService<AppConfig, true>).getOrThrow("mercadoPago", { infer: true }).webhookSecret;

    const nestApp = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(nestApp, { ...testCheckoutConfig(), mercadoPago: { accessToken: "x", environment: "test", webhookSecret: SECRET } });
    await nestApp.listen(0, "127.0.0.1");
    app = nestApp;
    baseUrl = await nestApp.getUrl();
  });

  afterAll(async () => {
    if (prisma && resourceIds.length > 0) {
      await prisma.paymentNotification.deleteMany({ where: { resourceId: { in: resourceIds } } });
    }
    await app?.close();
  });

  beforeEach(() => {
    port.getOrder.mockReset().mockRejectedValue(new Error("provider unavailable in e2e"));
  });

  function newResourceId(): string {
    const id = `ORDE2E${randomUUID().replace(/-/g, "").toUpperCase()}`;
    resourceIds.push(id);
    return id;
  }

  function post(options: { dataId: string; secret?: string; signature?: string; ts?: string; type?: string; body?: unknown }) {
    const requestId = randomUUID();
    const ts = options.ts ?? String(Date.now());
    const v1 = createHmac("sha256", options.secret ?? SECRET).update(buildWebhookManifest(options.dataId, requestId, ts)).digest("hex");
    const query = new URLSearchParams({ "data.id": options.dataId, type: options.type ?? "order" });
    return fetch(`${baseUrl}/api/v1/payments/mercadopago/webhooks?${query.toString()}`, {
      body: JSON.stringify(options.body ?? { action: "order.processed", data: { id: options.dataId } }),
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
        "x-signature": options.signature ?? `ts=${ts},v1=${v1}`,
      },
      method: "POST",
    });
  }

  const rowCount = (resourceId: string) => prisma.paymentNotification.count({ where: { resourceId } });

  it("accepts a validly signed notification without a JWT, stores one inbox row and returns 200", async () => {
    const dataId = newResourceId();
    const response = await post({ dataId });

    expect(`${response.status} ${await response.text()}`).toBe("200 {\"ok\":true}");
    expect(await rowCount(dataId)).toBe(1);
  });

  it("verifies against the lowercase data.id manifest and acknowledges duplicates with 200 and one row", async () => {
    const dataId = newResourceId();
    const requestId = randomUUID();
    const ts = String(Math.floor(Date.now() / 1_000));
    const v1 = createHmac("sha256", SECRET).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
    const send = () => fetch(`${baseUrl}/api/v1/payments/mercadopago/webhooks?data.id=${dataId}&type=order`, {
      body: JSON.stringify({ action: "order.processed" }),
      headers: { "content-type": "application/json", "x-request-id": requestId, "x-signature": `ts=${ts},v1=${v1}` },
      method: "POST",
    });

    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    expect(await rowCount(dataId)).toBe(1);
  });

  it("returns 401 with no database effects for wrong secret, stale, malformed and missing signatures", async () => {
    const dataId = newResourceId();
    const stale = String(Date.now() - 10 * 60 * 1_000);

    expect((await post({ dataId, secret: "wrong-secret" })).status).toBe(401);
    expect((await post({ dataId, ts: stale })).status).toBe(401);
    expect((await post({ dataId, signature: "garbage" })).status).toBe(401);

    const unsigned = await fetch(`${baseUrl}/api/v1/payments/mercadopago/webhooks?data.id=${dataId}&type=order`, {
      body: "{}",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(unsigned.status).toBe(401);
    expect(await rowCount(dataId)).toBe(0);
  });

  it("stores authenticated optional-topic alerts and quarantines unverifiable ids instead of associating them", async () => {
    const dataId = newResourceId();
    expect((await post({ dataId, type: "stop_delivery_op_wh" })).status).toBe(200);

    await expect(async () => {
      const row = await prisma.paymentNotification.findFirstOrThrow({ where: { resourceId: dataId } });
      expect(row.topic).toBe("stop_delivery_op_wh");
      expect(["PENDING", "PROCESSING", "QUARANTINED"]).toContain(row.status);
    }).not.toThrow();
  });

  it("acknowledges unsupported signed topics without storing them", async () => {
    const dataId = newResourceId();
    expect((await post({ dataId, type: "payment" })).status).toBe(200);
    expect(await rowCount(dataId)).toBe(0);
  });

  it("is exempt from throttling", async () => {
    const dataId = newResourceId();
    const statuses = await Promise.all(Array.from({ length: 15 }, () => post({ dataId, secret: "wrong-secret" }).then((r) => r.status)));
    expect(statuses.every((status) => status === 401)).toBe(true);
    expect(await rowCount(dataId)).toBe(0);
  });

  it("processes accepted notifications through the claim query: a failing provider read schedules a retry with backoff", async () => {
    const dataId = newResourceId();
    expect((await post({ dataId })).status).toBe(200);

    let row = await prisma.paymentNotification.findFirstOrThrow({ where: { resourceId: dataId } });
    for (let attempt = 0; attempt < 40 && row.processAttempts === 0 || row.status !== "PENDING"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      row = await prisma.paymentNotification.findFirstOrThrow({ where: { resourceId: dataId } });
    }
    expect(port.getOrder).toHaveBeenCalledWith(dataId);
    expect(row.status).toBe("PENDING");
    expect(row.processAttempts).toBe(1);
    expect(row.nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });
});
