import { randomUUID } from "node:crypto";

import * as bcrypt from "bcrypt";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { loadAppConfig } from "../src/config/app.config";
import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { AuthService } from "../src/modules/auth/auth.service";
import {
  CatalogVisibility,
  OrderDeliveryType,
  OrderShippingStatus,
  OrderStatus,
  PaymentStatus,
  Role,
  StockMode,
  SupplierStatus,
} from "../src/generated/prisma/enums";

describe("sales CRM administration API (e2e)", () => {
  let app: INestApplication | undefined;
  let baseUrl = "";
  let prisma: PrismaService | undefined;
  let adminToken = "";
  let customerToken = "";
  let adminId = "";
  let customerId = "";
  let supplierId = "";
  const supplierIds: string[] = [];
  const saleIds: string[] = [];
  const sourceOrderIds: string[] = [];
  const purchaseOrderIds: string[] = [];
  let poProductId = "";
  let poVariantId = "";

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const database = moduleFixture.get(PrismaService);
    prisma = database;
    const suffix = randomUUID();
    const password = `Sales-admin-${suffix}-A1!`;
    adminId = `sales-admin-${suffix}`;
    customerId = `sales-customer-${suffix}`;
    poProductId = `sales-e2e-product-${suffix}`;
    poVariantId = `sales-e2e-variant-${suffix}`;
    const adminEmail = `${adminId}@example.test`;
    const customerEmail = `${customerId}@example.test`;
    await database.user.createMany({ data: [
      { email: adminEmail, id: adminId, passwordHash: await bcrypt.hash(password, 4), role: Role.ADMIN },
      { email: customerEmail, id: customerId, passwordHash: await bcrypt.hash(password, 4), role: Role.CUSTOMER },
    ] });
    await database.product.create({ data: {
      id: poProductId,
      name: "Sales CRM E2E product",
      publicSlug: `${poProductId}-public`,
      quantity: 2,
      salePrice: 100,
      sku: `${poProductId}-sku`,
      slug: `${poProductId}-slug`,
      stockMode: StockMode.TRACKED,
      variants: { create: {
        id: poVariantId,
        name: "Sales CRM E2E variant",
        quantity: 3,
        sku: `${poVariantId}-sku`,
        stockMode: StockMode.TRACKED,
      } },
      visibility: CatalogVisibility.HIDDEN,
    } });
    const authService = moduleFixture.get(AuthService);
    adminToken = (await authService.login(adminEmail, password)).accessToken;
    customerToken = (await authService.login(customerEmail, password)).accessToken;
    const nestApp = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(nestApp, loadAppConfig());
    await nestApp.listen(0, "127.0.0.1");
    app = nestApp;
    baseUrl = await nestApp.getUrl();
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.purchaseOrder.deleteMany({ where: { id: { in: purchaseOrderIds } } });
        await prisma.order.deleteMany({ where: { id: { in: [...saleIds, ...sourceOrderIds] } } });
        await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
        await prisma.user.deleteMany({ where: { id: { in: [adminId, customerId] } } });
      }
    } finally {
      if (app) await app.close();
    }
  });

  it("returns 401 for unauthenticated requests and 403 for CUSTOMER requests", async () => {
    for (const path of ["/admin/sales", "/admin/suppliers", "/admin/purchase-orders"]) {
      await expectError(await request(path), 401, "UNAUTHORIZED");
      await expectError(await request(path, { token: customerToken }), 403, "FORBIDDEN");
    }
  });

  it("rejects invalid query, body, and command transports with 400", async () => {
    await expectError(await request("/admin/sales?page=0", { token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/suppliers?status=unknown", { token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/purchase-orders?limit=0", { token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/sales", { body: {}, method: "POST", token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/suppliers", { body: { code: "", name: "" }, method: "POST", token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/purchase-orders", { body: {}, method: "POST", token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/sales/missing/ship", { body: { carrier: "", trackingCode: "" }, method: "POST", token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/sales/missing/confirm", { body: { unexpected: true }, method: "POST", token: adminToken }), 400, "VALIDATION_ERROR");
  });

  it("allows ADMIN collection reads and supplier CRUD", async () => {
    for (const path of ["/admin/sales", "/admin/suppliers", "/admin/purchase-orders"]) {
      expect((await request(path, { token: adminToken })).status).toBe(200);
    }
    const suffix = randomUUID();
    const createdResponse = await request("/admin/suppliers", {
      body: { code: `e2e-${suffix}`, email: `supplier-${suffix}@example.test`, name: "E2E Supplier" },
      method: "POST",
      token: adminToken,
    });
    expect(createdResponse.status).toBe(201);
    const created = await json<{ id: string }>(createdResponse);
    supplierId = created.id;
    supplierIds.push(created.id);
    expect((await request(`/admin/suppliers/${supplierId}`, { token: adminToken })).status).toBe(200);
    expect((await request(`/admin/suppliers/${supplierId}`, { body: { name: "Updated Supplier" }, method: "PUT", token: adminToken })).status).toBe(200);
    expect((await request(`/admin/suppliers/${supplierId}/status`, { body: { status: SupplierStatus.INACTIVE }, method: "PATCH", token: adminToken })).status).toBe(200);
    expect((await request(`/admin/suppliers/${supplierId}`, { method: "DELETE", token: adminToken })).status).toBe(204);
  });

  it("lists filtered sales with pagination and returns immutable sale detail", async () => {
    const search = `e2e-list-${randomUUID().replaceAll("-", "")}`;
    const first = await createSale(`${search}-first`, { total: 100 });
    const second = await createSale(`${search}-second`, { total: 250 });
    await createSale(`e2e-unmatched-${randomUUID().replaceAll("-", "")}`, { total: 999 });
    const query = new URLSearchParams({
      isArchived: "false",
      limit: "1",
      page: "1",
      paymentStatus: PaymentStatus.PAID,
      search,
      shippingStatus: OrderShippingStatus.TO_PACK,
      sortBy: "total",
      sortOrder: "desc",
      status: OrderStatus.CONFIRMED,
    });

    const firstPageResponse = await request(`/admin/sales?${query.toString()}`, { token: adminToken });
    expect(firstPageResponse.status).toBe(200);
    const firstPage = await json<SaleListResponse>(firstPageResponse);
    expect(firstPage).toMatchObject({ limit: 1, page: 1, total: 2 });
    expect(firstPage.items.map((item) => item.id)).toEqual([second.id]);

    query.set("page", "2");
    const secondPage = await json<SaleListResponse>(await request(`/admin/sales?${query.toString()}`, { token: adminToken }));
    expect(secondPage.items.map((item) => item.id)).toEqual([first.id]);
    expect(secondPage.items[0]?.itemCount).toBe(1);

    const detailResponse = await request(`/admin/sales/${first.id}`, { token: adminToken });
    expect(detailResponse.status).toBe(200);
    const detail = await json<SaleResponse>(detailResponse);
    expect(detail).toEqual(expect.objectContaining({
      customerSnapshot: expect.objectContaining({ email: expect.stringContaining(search) }),
      id: first.id,
      isArchived: false,
      payment: expect.objectContaining({ status: PaymentStatus.PAID }),
      shippingStatus: OrderShippingStatus.TO_PACK,
      status: OrderStatus.CONFIRMED,
    }));
    expect(detail.items[0]).toEqual(expect.objectContaining({ productName: "E2E fixture item", quantity: 1 }));
    expect(detail.history.map((event) => event.type)).toContain("ORDER_CREATED");
  });

  it("executes every sales command through the protected API", async () => {
    const lifecycle = await createSale(`e2e-lifecycle-${randomUUID().replaceAll("-", "")}`, { paymentStatus: PaymentStatus.PAID });

    const noted = await saleCommand(lifecycle.id, "notes", { note: "Internal E2E note" });
    expect(noted.internalNotes).toContain("Internal E2E note");

    const packed = await saleCommand(lifecycle.id, "pack");
    expect(packed.shippingStatus).toBe(OrderShippingStatus.TO_SHIP);
    const unpacked = await saleCommand(lifecycle.id, "unpack");
    expect(unpacked.shippingStatus).toBe(OrderShippingStatus.TO_PACK);
    await saleCommand(lifecycle.id, "pack");
    const shipped = await saleCommand(lifecycle.id, "ship", { carrier: "E2E Carrier", trackingCode: "E2E-TRACK-1", trackingUrl: "https://tracking.example.test/E2E-TRACK-1" });
    expect(shipped.shippingStatus).toBe(OrderShippingStatus.SHIPPED);
    const delivered = await saleCommand(lifecycle.id, "deliver");
    expect(delivered.shippingStatus).toBe(OrderShippingStatus.DELIVERED);
    const archived = await saleCommand(lifecycle.id, "archive");
    expect(archived.isArchived).toBe(true);
    const unarchived = await saleCommand(lifecycle.id, "unarchive");
    expect(unarchived).toEqual(expect.objectContaining({ isArchived: false, shippingStatus: OrderShippingStatus.DELIVERED }));

    const cancellable = await createSale(`e2e-cancel-${randomUUID().replaceAll("-", "")}`, { paymentStatus: PaymentStatus.PENDING });
    const cancelled = await saleCommand(cancellable.id, "cancel", { cancellationReason: "E2E request", restoreStock: false });
    expect(cancelled).toEqual(expect.objectContaining({
      previousStatus: OrderStatus.CONFIRMED,
      shippingStatus: OrderShippingStatus.CANCELLED,
      status: OrderStatus.CANCELLED,
    }));
    const reopened = await saleCommand(cancellable.id, "reopen");
    expect(reopened).toEqual(expect.objectContaining({ shippingStatus: OrderShippingStatus.TO_PACK, status: OrderStatus.CONFIRMED }));

    const pendingId = await createPendingOrder(prismaOrThrow(), "confirm");
    sourceOrderIds.push(pendingId);
    const confirmed = await saleCommand(pendingId, "confirm");
    expect(confirmed).toEqual(expect.objectContaining({ id: pendingId, status: OrderStatus.CONFIRMED }));

    const sourceId = await createPendingOrder(prismaOrThrow(), "convert");
    sourceOrderIds.push(sourceId);
    const conversionResponse = await request("/admin/sales/convert-order", {
      body: { sourceOrderId: sourceId },
      method: "POST",
      token: adminToken,
    });
    expect(conversionResponse.status).toBe(201);
    const converted = await json<SaleResponse>(conversionResponse);
    saleIds.push(converted.id);
    expect(converted.sourceOrderId).toBe(sourceId);
    await expectError(await request("/admin/sales/convert-order", {
      body: { sourceOrderId: sourceId },
      method: "POST",
      token: adminToken,
    }), 409, "CONFLICT");
  });

  it("runs supplier purchase-order lifecycle and records one receipt movement per item", async () => {
    const supplier = await createSupplier(`e2e-po-${randomUUID().replaceAll("-", "")}`);
    const orderNumber = `E2E-PO-${randomUUID().replaceAll("-", "")}`;
    const createdResponse = await request("/admin/purchase-orders", {
      body: purchaseOrderInput(supplier.id, orderNumber),
      method: "POST",
      token: adminToken,
    });
    expect(createdResponse.status).toBe(201);
    const created = await json<PurchaseOrderResponse>(createdResponse);
    purchaseOrderIds.push(created.id);
    expect(created).toEqual(expect.objectContaining({ orderNumber, status: "DRAFT", supplier: expect.objectContaining({ id: supplier.id }) }));

    const listed = await json<PurchaseOrderListResponse>(await request(`/admin/purchase-orders?search=${encodeURIComponent(orderNumber)}`, { token: adminToken }));
    expect(listed.items.map((item) => item.id)).toContain(created.id);
    const detail = await json<PurchaseOrderResponse>(await request(`/admin/purchase-orders/${created.id}`, { token: adminToken }));
    expect(detail.items).toHaveLength(2);

    const updatedResponse = await request(`/admin/purchase-orders/${created.id}`, {
      body: { expectedDate: "2026-09-20", notes: "Updated E2E draft" },
      method: "PUT",
      token: adminToken,
    });
    expect(updatedResponse.status).toBe(200);
    expect((await json<PurchaseOrderResponse>(updatedResponse)).notes).toBe("Updated E2E draft");

    const ordered = await purchaseOrderCommand(created.id, "submit");
    expect(ordered.status).toBe("ORDERED");
    await expectError(await request(`/admin/purchase-orders/${created.id}`, {
      body: { notes: "must remain immutable" },
      method: "PUT",
      token: adminToken,
    }), 409, "CONFLICT");

    const received = await purchaseOrderCommand(created.id, "receive");
    expect(received).toEqual(expect.objectContaining({ receivedAt: expect.any(String), status: "RECEIVED" }));
    await expectError(await request(`/admin/purchase-orders/${created.id}/receive`, { body: {}, method: "POST", token: adminToken }), 409, "CONFLICT");
    await expect(prismaOrThrow().product.findUniqueOrThrow({ select: { quantity: true }, where: { id: poProductId } })).resolves.toEqual({ quantity: 4 });
    await expect(prismaOrThrow().productVariant.findUniqueOrThrow({ select: { quantity: true }, where: { id: poVariantId } })).resolves.toEqual({ quantity: 4 });
    await expect(prismaOrThrow().inventoryHistory.count({ where: { origin: "purchase_order", productId: poProductId } })).resolves.toBe(2);

    const cancelledNumber = `E2E-PO-CANCEL-${randomUUID().replaceAll("-", "")}`;
    const cancelResponse = await request("/admin/purchase-orders", {
      body: purchaseOrderInput(supplier.id, cancelledNumber),
      method: "POST",
      token: adminToken,
    });
    const cancellable = await json<PurchaseOrderResponse>(cancelResponse);
    purchaseOrderIds.push(cancellable.id);
    await purchaseOrderCommand(cancellable.id, "submit");
    expect((await purchaseOrderCommand(cancellable.id, "cancel")).status).toBe("CANCELLED");
    await expectError(await request(`/admin/purchase-orders/${cancellable.id}/cancel`, { body: {}, method: "POST", token: adminToken }), 409, "CONFLICT");
  });

  function prismaOrThrow(): PrismaService {
    if (!prisma) throw new Error("Sales CRM e2e Prisma service was not initialized.");
    return prisma;
  }

  async function createSale(label: string, overrides: Record<string, unknown> = {}): Promise<SaleResponse> {
    const total = typeof overrides.total === "number" ? overrides.total : 100;
    const response = await request("/admin/sales", {
      body: {
        customer: { email: `${label}@example.test`, firstName: "E2E", lastName: "Customer", phone: "+54 11 5555-5555" },
        items: [{ name: "E2E fixture item", productId: poProductId, quantity: 1, unitPrice: total }],
        paymentMethodSnapshot: { source: "e2e" },
        paymentStatus: PaymentStatus.PAID,
        subtotal: total,
        total,
        ...overrides,
      },
      method: "POST",
      token: adminToken,
    });
    expect(response.status).toBe(201);
    const sale = await json<SaleResponse>(response);
    saleIds.push(sale.id);
    return sale;
  }

  async function saleCommand(id: string, command: string, body: unknown = {}): Promise<SaleResponse> {
    const response = await request(`/admin/sales/${id}/${command}`, { body, method: "POST", token: adminToken });
    expect(response.status).toBe(200);
    return json<SaleResponse>(response);
  }

  async function createSupplier(label: string): Promise<SupplierResponse> {
    const response = await request("/admin/suppliers", {
      body: { code: label, name: "E2E PO Supplier", email: `${label}@example.test` },
      method: "POST",
      token: adminToken,
    });
    expect(response.status).toBe(201);
    const supplier = await json<SupplierResponse>(response);
    supplierIds.push(supplier.id);
    return supplier;
  }

  function purchaseOrderInput(supplierId: string, orderNumber: string): Record<string, unknown> {
    return {
      orderNumber,
      supplierId,
      items: [
        { productId: poProductId, quantity: 2, sku: `${poProductId}-sku`, title: "Sales CRM E2E product", unitCost: 10 },
        { productId: poProductId, quantity: 1, sku: `${poVariantId}-sku`, title: "Sales CRM E2E variant", variantId: poVariantId, unitCost: 12 },
      ],
    };
  }

  async function purchaseOrderCommand(id: string, command: "cancel" | "receive" | "submit"): Promise<PurchaseOrderResponse> {
    const response = await request(`/admin/purchase-orders/${id}/${command}`, { body: {}, method: "POST", token: adminToken });
    expect(response.status).toBe(200);
    return json<PurchaseOrderResponse>(response);
  }

  async function expectError(response: Response, status: number, code: string): Promise<void> {
    expect(response.status).toBe(status);
    await expect(json<Record<string, unknown>>(response)).resolves.toEqual(expect.objectContaining({ code, ok: false }));
  }

  function request(path: string, options: RequestOptions = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("accept", "application/json");
    if (options.token) headers.set("authorization", `Bearer ${options.token}`);
    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
    }
    return fetch(`${baseUrl}/api/v1${path}`, {
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      headers,
      method: options.method ?? "GET",
    });
  }
});

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

interface RequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  token?: string;
}

interface SaleResponse {
  customerSnapshot: Record<string, unknown>;
  history: Array<{ type: string }>;
  id: string;
  internalNotes?: string;
  isArchived: boolean;
  items: Array<{ productName: string; quantity: number; snapshot?: unknown }>;
  payment: { status: string } | null;
  paymentStatus: string | null;
  previousShippingStatus?: string;
  previousStatus?: string;
  shippingStatus: string;
  sourceOrderId?: string;
  status: string;
}

interface SaleListResponse {
  items: Array<{ id: string; itemCount: number }>;
  limit: number;
  page: number;
  total: number;
}

interface SupplierResponse {
  id: string;
}

interface PurchaseOrderResponse {
  id: string;
  items: Array<{ productId: string; variantId?: string | null }>;
  notes: string | null;
  orderNumber: string;
  receivedAt: string | null;
  status: string;
  supplier: { id: string };
}

interface PurchaseOrderListResponse {
  items: Array<{ id: string }>;
}

async function createPendingOrder(database: PrismaService, label: string): Promise<string> {
  const suffix = randomUUID().replaceAll("-", "");
  const id = `sales-e2e-pending-${label}-${suffix}`;

  await database.order.create({
    data: {
      customerEmail: `${id}@example.test`,
      customerFirstName: "Pending",
      customerLastName: "E2E",
      customerSnapshot: { email: `${id}@example.test`, firstName: "Pending", lastName: "E2E" },
      deliverySnapshot: { method: "shipping" },
      deliveryType: OrderDeliveryType.SHIPPING,
      discountSnapshot: {},
      id,
      number: `E2E-PENDING-${label}-${suffix}`,
      payment: {
        create: {
          amount: 0,
          currency: "ARS",
          paymentMethodId: "manual",
          paymentMethodSnapshot: { source: "e2e" },
          status: PaymentStatus.PENDING,
        },
      },
      shippingStatus: OrderShippingStatus.TO_PACK,
      status: OrderStatus.PENDING,
      subtotal: 0,
      total: 0,
    },
  });

  return id;
}
