import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { HttpExceptionFilter } from "../../common/filters/http-exception.filter";
import type { AppConfig } from "../../config/app.config";
import { NODE_ENV } from "../../config/app.config";
import { configureHttpApplication } from "../../app.setup";
import type { PrismaService } from "../../common/prisma/prisma.service";
import {
  HealthAggregateController,
  HealthController,
} from "./health.controller";
import {
  HealthService,
  type AggregateHealthResponse,
  type HealthResponse,
} from "./health.service";

describe("health.controller", () => {
  it("serves aggregate health at root and versioned aliases while retaining probes", async () => {
    const timestamp = "2026-09-07T12:00:00.000Z";
    const service: HealthControllerService = {
      aggregate: jest.fn().mockResolvedValue({
        database: "up",
        ok: true,
        status: "ok",
        timestamp,
        uptime: 42.75,
      }),
      live: jest.fn().mockReturnValue({ ok: true, status: "live" }),
      ready: jest.fn().mockResolvedValue({ ok: true, status: "ready" }),
    };
    const app = await createApp(service);
    const baseUrl = await app.getUrl();

    try {
      for (const path of ["/health", "/api/v1/health"]) {
        const response = await fetch(`${baseUrl}${path}`);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
          database: "up",
          ok: true,
          status: "ok",
          timestamp,
          uptime: 42.75,
        });
      }

      expect((await fetch(`${baseUrl}/api/v1/health/live`)).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/v1/health/ready`)).status).toBe(200);
      expect(service.aggregate).toHaveBeenCalledTimes(2);
    } finally {
      await app.close();
    }
  });

  it("returns a sanitized service-unavailable response for aggregate database failures", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error("postgresql://user:secret@unavailable:5432/entrenar")),
    };
    const app = await createApp(new HealthService(prisma as unknown as PrismaService), true);
    const baseUrl = await app.getUrl();

    try {
      for (const path of ["/health", "/api/v1/health"]) {
        const response = await fetch(`${baseUrl}${path}`);

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
          code: "SERVICE_UNAVAILABLE",
          message: "Database is unavailable.",
          ok: false,
        });
      }
    } finally {
      await app.close();
    }
  });
});

async function createApp(service: HealthControllerService, withExceptionFilter = false): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    controllers: [HealthController, HealthAggregateController],
    providers: [{ provide: HealthService, useValue: service }],
  }).compile();
  const app = moduleFixture.createNestApplication({ bodyParser: false });

  configureHttpApplication(app, APP_CONFIG);

  if (withExceptionFilter) {
    app.useGlobalFilters(new HttpExceptionFilter());
  }

  await app.listen(0, "127.0.0.1");
  return app;
}

const APP_CONFIG: AppConfig = {
  bodyLimitBytes: 104_857,
  corsOrigin: "http://localhost:3000",
  corsOrigins: ["http://localhost:3000"],
  databaseUrl: "postgresql://entrenar:password@127.0.0.1:5432/entrenar?schema=public",
  frontendUrl: "http://localhost:3000",
  jwtAccessSecret: "access-secret-with-at-least-thirty-two-characters",
  jwtAccessTtlSeconds: 900,
  jwtRefreshSecret: "refresh-secret-with-at-least-thirty-two-characters",
  jwtRefreshTtlSeconds: 2_592_000,
  nodeEnv: NODE_ENV.TEST,
  port: 3001,
  throttleLimit: 100,
  throttleTtlSeconds: 60,
};

interface HealthControllerService {
  aggregate(): Promise<AggregateHealthResponse>;
  live(): HealthResponse;
  ready(): Promise<HealthResponse>;
}
