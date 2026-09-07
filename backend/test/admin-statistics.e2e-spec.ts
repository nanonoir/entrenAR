import type { INestApplication } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";

import type { AppConfig } from "../src/config/app.config";
import { configureHttpApplication } from "../src/app.setup";
import { JwtAuthGuard } from "../src/common/auth/jwt-authentication.guard";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { Role } from "../src/generated/prisma/enums";
import { AdminStatisticsController } from "../src/modules/statistics/admin-statistics.controller";
import { StatisticsService } from "../src/modules/statistics/statistics.service";
import {
  STATISTICS_INTERVAL,
  STATISTICS_PERIOD,
  STATISTICS_TREND,
  type StatisticsCouponsResponse,
  type StatisticsCustomersResponse,
  type StatisticsMetric,
  type StatisticsMetadata,
  type StatisticsOverviewResponse,
  type StatisticsPeriod,
  type StatisticsProductsResponse,
  type StatisticsQuery,
  type StatisticsSalesResponse,
} from "../src/modules/statistics/statistics.schemas";

describe("admin statistics API (e2e)", () => {
  let app: INestApplication;
  let baseUrl = "";
  let service: StatisticsServiceMock;
  let adminToken = "";
  let customerToken = "";

  beforeAll(async () => {
    service = createServiceMock();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminStatisticsController],
      imports: [JwtModule.register({ secret: TEST_JWT_SECRET })],
      providers: [
        RolesGuard,
        JwtAuthGuard,
        { provide: StatisticsService, useValue: service },
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

  it("returns 401 for unauthenticated requests on every statistics endpoint", async () => {
    for (const endpoint of STATISTICS_ENDPOINTS) {
      await expectError(await request(endpoint), 401, "UNAUTHORIZED");
    }
  });

  it("returns 403 for a CUSTOMER token on every statistics endpoint", async () => {
    for (const endpoint of STATISTICS_ENDPOINTS) {
      await expectError(await request(endpoint, { token: customerToken }), 403, "FORBIDDEN");
    }
  });

  it("returns a valid success envelope for every ADMIN report", async () => {
    for (const report of ADMIN_REPORTS) {
      const response = await request(report.path, { token: adminToken });

      expect(response.status).toBe(200);
      const body = await json<StatisticsResponseEnvelope>(response);
      expect(body).toEqual(expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.any(Object),
          metrics: expect.any(Object),
        }),
        ok: true,
      }));
      for (const key of report.dataKeys) expect(body.data).toHaveProperty(key);
    }
  });

  it("rejects invalid report queries before calling the service", async () => {
    await expectError(await request("/admin/statistics/overview?period=unsupported", { token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/statistics/overview?period=custom&to=2026-01-31", { token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/statistics/overview?period=custom&from=2026-01-01", { token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/statistics/overview?period=custom&from=2026-01-31&to=2026-01-01", { token: adminToken }), 400, "VALIDATION_ERROR");
    await expectError(await request("/admin/statistics/overview?limit=-1", { token: adminToken }), 400, "VALIDATION_ERROR");
    expect(service.getOverview).not.toHaveBeenCalled();
  });

  it("forwards supported preset and custom periods after validation", async () => {
    const cases: Array<{ query: string; expected: StatisticsQuery }> = [
      {
        expected: { interval: STATISTICS_INTERVAL.DAY, period: STATISTICS_PERIOD.TODAY },
        query: "period=today",
      },
      {
        expected: { interval: STATISTICS_INTERVAL.DAY, period: STATISTICS_PERIOD.CURRENT_WEEK },
        query: "period=current-week",
      },
      {
        expected: { interval: STATISTICS_INTERVAL.DAY, period: STATISTICS_PERIOD.LAST_90_DAYS },
        query: "period=last-90-days",
      },
      {
        expected: {
          from: "2026-01-01",
          interval: STATISTICS_INTERVAL.DAY,
          period: STATISTICS_PERIOD.CUSTOM,
          to: "2026-01-31",
        },
        query: "period=custom&from=2026-01-01&to=2026-01-31",
      },
    ];

    for (const testCase of cases) {
      const response = await request(`/admin/statistics/overview?${testCase.query}`, { token: adminToken });

      expect(response.status).toBe(200);
      expect(service.getOverview).toHaveBeenLastCalledWith(testCase.expected);
      const body = await json<StatisticsResponseEnvelope>(response);
      expect(body.data.metadata).toEqual(expect.objectContaining({ period: testCase.expected.period }));
    }
  });

  function request(path: string, options: RequestOptions = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("accept", "application/json");
    if (options.token) headers.set("authorization", `Bearer ${options.token}`);
    return fetch(`${baseUrl}/api/v1${path}`, { headers, method: options.method ?? "GET" });
  }
});

const STATISTICS_ENDPOINTS = [
  "/admin/statistics/overview",
  "/admin/statistics/sales",
  "/admin/statistics/products",
  "/admin/statistics/customers",
  "/admin/statistics/coupons",
] as const;

const ADMIN_REPORTS = [
  { dataKeys: ["metadata", "metrics"] as const, path: "/admin/statistics/overview" },
  { dataKeys: ["metadata", "metrics", "paymentStatuses", "paymentMethods", "shipping", "provinces"] as const, path: "/admin/statistics/sales" },
  { dataKeys: ["metadata", "metrics", "topProducts", "series", "inventoryAlerts"] as const, path: "/admin/statistics/products" },
  { dataKeys: ["metadata", "metrics", "topCustomers"] as const, path: "/admin/statistics/customers" },
  { dataKeys: ["metadata", "metrics", "topCoupons", "comparison"] as const, path: "/admin/statistics/coupons" },
] as const;

const TEST_JWT_SECRET = "statistics-test-secret-with-at-least-thirty-two-characters";

type StatisticsServiceMock = Record<
  keyof Pick<StatisticsService, "getCoupons" | "getCustomers" | "getOverview" | "getProducts" | "getSales">,
  jest.Mock
>;

interface StatisticsResponseEnvelope {
  ok: boolean;
  data: Record<string, unknown>;
}

interface RequestOptions {
  headers?: HeadersInit;
  method?: "GET";
  token?: string;
}

function createServiceMock(): StatisticsServiceMock {
  const service: StatisticsServiceMock = {
    getCoupons: jest.fn(),
    getCustomers: jest.fn(),
    getOverview: jest.fn(),
    getProducts: jest.fn(),
    getSales: jest.fn(),
  };

  service.getOverview.mockImplementation(async (query: StatisticsQuery) => createOverviewResponse(query.period));
  service.getSales.mockImplementation(async (query: StatisticsQuery) => createSalesResponse(query.period));
  service.getProducts.mockImplementation(async (query: StatisticsQuery) => createProductsResponse(query.period));
  service.getCustomers.mockImplementation(async (query: StatisticsQuery) => createCustomersResponse(query.period));
  service.getCoupons.mockImplementation(async (query: StatisticsQuery) => createCouponsResponse(query.period));

  return service;
}

function createOverviewResponse(period: StatisticsPeriod): StatisticsOverviewResponse {
  return { ok: true, data: { metadata: metadata(period), metrics: metrics() } };
}

function createSalesResponse(period: StatisticsPeriod): StatisticsSalesResponse {
  return {
    ok: true,
    data: {
      metadata: metadata(period),
      metrics: metrics(),
      paymentMethods: [],
      paymentStatuses: [],
      provinces: [],
      shipping: [],
    },
  };
}

function createProductsResponse(period: StatisticsPeriod): StatisticsProductsResponse {
  return { ok: true, data: { inventoryAlerts: [], metadata: metadata(period), metrics: metrics(), series: [], topProducts: [] } };
}

function createCustomersResponse(period: StatisticsPeriod): StatisticsCustomersResponse {
  return { ok: true, data: { metadata: metadata(period), metrics: metrics(), topCustomers: [] } };
}

function createCouponsResponse(period: StatisticsPeriod): StatisticsCouponsResponse {
  return {
    ok: true,
    data: {
      comparison: { withCoupon: { orders: 0, revenue: 0 }, withoutCoupon: { orders: 0, revenue: 0 } },
      metadata: metadata(period),
      metrics: metrics(),
      topCoupons: [],
    },
  };
}

function metadata(period: StatisticsPeriod): StatisticsMetadata {
  return {
    comparisonWindow: { from: "2025-12-01T00:00:00.000Z", to: "2025-12-31T23:59:59.999Z" },
    period,
    window: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-31T23:59:59.999Z" },
  };
}

function metrics(): Record<string, StatisticsMetric> {
  return { revenue: { current: 100, previous: 80, trend: STATISTICS_TREND.UP, variationPct: 25 } };
}

function testConfig(): AppConfig {
  return {
    bodyLimitBytes: 104_857,
    corsOrigin: "http://localhost:3000",
    databaseUrl: "postgresql://test:test@localhost:5432/test",
    jwtAccessSecret: TEST_JWT_SECRET,
    jwtAccessTtlSeconds: 900,
    jwtRefreshSecret: "statistics-refresh-secret-with-at-least-thirty-two-characters",
    jwtRefreshTtlSeconds: 2_592_000,
    nodeEnv: "test",
    port: 3001,
    throttleLimit: 100,
    throttleTtlSeconds: 60,
  };
}

async function expectError(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  await expect(json<Record<string, unknown>>(response)).resolves.toEqual(expect.objectContaining({ code, ok: false }));
}

function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
