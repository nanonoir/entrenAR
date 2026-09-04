import { BadRequestException, ConflictException, type INestApplication, NotFoundException } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";

import { configureHttpApplication } from "../src/app.setup";
import { JwtAuthGuard } from "../src/common/auth/jwt-authentication.guard";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { Role } from "../src/generated/prisma/enums";
import { AdminCustomersController } from "../src/modules/customers/admin-customers.controller";
import { CustomersService } from "../src/modules/customers/customers.service";

describe("AdminCustomersController", () => {
  let app: INestApplication;
  let adminToken: string;
  let baseUrl: string;
  let customerToken: string;
  let service: CustomerServiceMock;

  beforeAll(async () => {
    service = createServiceMock();
    const moduleFixture = await Test.createTestingModule({
      controllers: [AdminCustomersController],
      imports: [JwtModule.register({ secret: "controller-test-secret" })],
      providers: [
        RolesGuard,
        JwtAuthGuard,
        { provide: CustomersService, useValue: service },
      ],
    }).compile();

    const jwt = moduleFixture.get(JwtService);
    adminToken = await jwt.signAsync({ role: Role.ADMIN, userId: "admin-1" });
    customerToken = await jwt.signAsync({ role: Role.CUSTOMER, userId: "customer-1" });

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(app, testConfig());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it("requires authentication and the ADMIN role before calling the service", async () => {
    const unauthenticated = await request("/api/v1/admin/customers");
    expect(unauthenticated.status).toBe(401);
    await expectJson(unauthenticated, { code: "UNAUTHORIZED", ok: false });

    const customer = await request("/api/v1/admin/customers", { token: customerToken });
    expect(customer.status).toBe(403);
    await expectJson(customer, { code: "FORBIDDEN", ok: false });
    expect(service.listCustomers).not.toHaveBeenCalled();
  });

  it("lists customers and returns a validated availability response", async () => {
    service.listCustomers.mockResolvedValue({ items: [customerResponse()], limit: 20, page: 1, total: 1, totalPages: 1 });
    service.isEmailAvailable.mockResolvedValue(true);

    const list = await request("/api/v1/admin/customers?search=Camila", { token: adminToken });
    expect(list.status).toBe(200);
    await expectJson(list, { items: [expect.objectContaining({ id: "cus_1" })], total: 1 });
    expect(service.listCustomers).toHaveBeenCalledWith(expect.objectContaining({ page: 1, search: "Camila" }));

    const availability = await request("/api/v1/admin/customers/availability?email=CAMILA%40EXAMPLE.COM&excludeCustomerId=cus_1", { token: adminToken });
    expect(availability.status).toBe(200);
    await expectJson(availability, { available: true });
    expect(service.isEmailAvailable).toHaveBeenCalledWith("camila@example.com", "cus_1");
  });

  it("returns 400 and skips business logic for invalid transport input", async () => {
    const response = await request("/api/v1/admin/customers?page=0", { token: adminToken });

    expect(response.status).toBe(400);
    await expectJson(response, { code: "VALIDATION_ERROR", ok: false });
    expect(service.listCustomers).not.toHaveBeenCalled();
  });

  it("creates and updates customers with the expected statuses", async () => {
    service.createCustomer.mockResolvedValue(customerResponse());
    service.updateCustomer.mockResolvedValue(customerResponse());

    const created = await request("/api/v1/admin/customers", { body: validCustomerInput(), method: "POST", token: adminToken });
    expect(created.status).toBe(201);
    await expectJson(created, { id: "cus_1" });

    const updated = await request("/api/v1/admin/customers/cus_1", { body: { fullName: "Updated Customer" }, method: "PUT", token: adminToken });
    expect(updated.status).toBe(200);
    expect(service.updateCustomer).toHaveBeenCalledWith("cus_1", { fullName: "Updated Customer" });
  });

  it("maps unknown customers, email collisions, and anonymized edit rejection to controlled errors", async () => {
    service.getCustomer.mockRejectedValue(new NotFoundException({ code: "CUSTOMER_NOT_FOUND", message: "Customer not found.", ok: false }));
    service.createCustomer.mockRejectedValue(new ConflictException({ code: "EMAIL_EXISTS", message: "Email already exists.", ok: false }));
    service.updateCustomer.mockRejectedValue(new BadRequestException({ code: "CUSTOMER_ANONYMIZED", message: "Customer is anonymized.", ok: false }));

    const missing = await request("/api/v1/admin/customers/cus_missing", { token: adminToken });
    expect(missing.status).toBe(404);
    await expectJson(missing, { code: "CUSTOMER_NOT_FOUND", ok: false });

    const collision = await request("/api/v1/admin/customers", { body: validCustomerInput(), method: "POST", token: adminToken });
    expect(collision.status).toBe(409);
    await expectJson(collision, { code: "EMAIL_EXISTS", ok: false });

    const anonymized = await request("/api/v1/admin/customers/cus_1", { body: { fullName: "Blocked" }, method: "PUT", token: adminToken });
    expect(anonymized.status).toBe(400);
    await expectJson(anonymized, { code: "CUSTOMER_ANONYMIZED", ok: false });
  });

  it("keeps export routes ahead of the identifier route and sends CSV headers and payloads", async () => {
    const listCsv = "\uFEFFID;Nombre y apellido\ncus_1;Camila Pérez";
    const detailCsv = "\uFEFFCampo;Valor\nID;cus_1";
    service.exportCustomersListCsv.mockResolvedValue(listCsv);
    service.exportCustomerDetailCsv.mockResolvedValue(detailCsv);

    const list = await request("/api/v1/admin/customers/export", { token: adminToken });
    expect(list.status).toBe(200);
    expect(list.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(list.headers.get("content-disposition")).toBe('attachment; filename="clientes.csv"');
    expect(Buffer.from(await list.arrayBuffer()).toString("utf8")).toBe(listCsv);
    expect(service.exportCustomersListCsv).toHaveBeenCalled();
    expect(service.getCustomer).not.toHaveBeenCalled();

    const detail = await request("/api/v1/admin/customers/cus_1/export", { token: adminToken });
    expect(detail.status).toBe(200);
    expect(detail.headers.get("content-disposition")).toBe('attachment; filename="cliente-cus_1.csv"');
    expect(Buffer.from(await detail.arrayBuffer()).toString("utf8")).toBe(detailCsv);
    expect(service.exportCustomerDetailCsv).toHaveBeenCalledWith("cus_1");
  });

  it("validates notes and anonymization bodies before invoking mutations", async () => {
    service.updateCustomerNotes.mockResolvedValue(customerResponse());
    service.anonymizeCustomer.mockResolvedValue(customerResponse());

    const notes = await request("/api/v1/admin/customers/cus_1/notes", { body: { notes: "Follow up" }, method: "PATCH", token: adminToken });
    expect(notes.status).toBe(200);
    expect(service.updateCustomerNotes).toHaveBeenCalledWith("cus_1", { notes: "Follow up" });

    const invalidAnonymize = await request("/api/v1/admin/customers/cus_1/anonymize", { body: { unexpected: true }, method: "POST", token: adminToken });
    expect(invalidAnonymize.status).toBe(400);
    expect(service.anonymizeCustomer).not.toHaveBeenCalled();

    const anonymized = await request("/api/v1/admin/customers/cus_1/anonymize", { body: {}, method: "POST", token: adminToken });
    expect(anonymized.status).toBe(200);
    expect(service.anonymizeCustomer).toHaveBeenCalledWith("cus_1", { id: "admin-1", role: Role.ADMIN });
  });

  function request(path: string, options: RequestOptions = {}): Promise<Response> {
    const headers: Record<string, string> = {};
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    if (options.body) headers["content-type"] = "application/json";
    return fetch(`${baseUrl}${path}`, {
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      headers,
      method: options.method ?? "GET",
    });
  }
});

interface RequestOptions {
  body?: object;
  method?: "GET" | "PATCH" | "POST" | "PUT";
  token?: string;
}

type CustomerServiceMock = Record<keyof Pick<CustomersService, "anonymizeCustomer" | "createCustomer" | "exportCustomerDetailCsv" | "exportCustomersListCsv" | "getCustomer" | "isEmailAvailable" | "listCustomers" | "updateCustomer" | "updateCustomerNotes">, jest.Mock>;

function createServiceMock(): CustomerServiceMock {
  return {
    anonymizeCustomer: jest.fn(),
    createCustomer: jest.fn(),
    exportCustomerDetailCsv: jest.fn(),
    exportCustomersListCsv: jest.fn(),
    getCustomer: jest.fn(),
    isEmailAvailable: jest.fn(),
    listCustomers: jest.fn(),
    updateCustomer: jest.fn(),
    updateCustomerNotes: jest.fn(),
  };
}

function customerResponse() {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "camila@example.com",
    firstInteractionDate: "2026-01-01T00:00:00.000Z",
    fullName: "Camila Pérez",
    id: "cus_1",
    isAnonymized: false,
    tags: ["vip"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

function validCustomerInput() {
  return { email: "new@example.com", fullName: "New Customer", tags: [] };
}

function testConfig() {
  return {
    bodyLimitBytes: 104_857,
    corsOrigin: "http://localhost:3000",
    databaseUrl: "postgresql://test:test@localhost:5432/test",
    jwtAccessSecret: "test-access-secret-with-at-least-thirty-two-characters",
    jwtAccessTtlSeconds: 900,
    jwtRefreshSecret: "test-refresh-secret-with-at-least-thirty-two-characters",
    jwtRefreshTtlSeconds: 2_592_000,
    nodeEnv: "test" as const,
    port: 3001,
    throttleLimit: 100,
    throttleTtlSeconds: 60,
  };
}

async function expectJson(response: Response, expected: object): Promise<void> {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(expected));
}
