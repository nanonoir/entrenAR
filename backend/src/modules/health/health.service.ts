import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { PrismaService } from "../../common/prisma/prisma.service";

export const HEALTH_STATUS = {
  LIVE: "live",
  OK: "ok",
  READY: "ready",
} as const;

export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

export const DATABASE_STATUS = {
  DOWN: "down",
  UP: "up",
} as const;

export type DatabaseStatus = (typeof DATABASE_STATUS)[keyof typeof DATABASE_STATUS];

export interface HealthResponse {
  ok: true;
  status: HealthStatus;
}

export interface AggregateHealthResponse {
  database: typeof DATABASE_STATUS.UP;
  ok: true;
  status: typeof HEALTH_STATUS.OK;
  timestamp: string;
  uptime: number;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  live(): HealthResponse {
    return { ok: true, status: HEALTH_STATUS.LIVE };
  }

  async ready(): Promise<HealthResponse> {
    await this.assertDatabaseReady();
    return { ok: true, status: HEALTH_STATUS.READY };
  }

  async aggregate(): Promise<AggregateHealthResponse> {
    await this.assertDatabaseReady();

    return {
      database: DATABASE_STATUS.UP,
      ok: true,
      status: HEALTH_STATUS.OK,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  private async assertDatabaseReady(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        code: ERROR_CODE.SERVICE_UNAVAILABLE,
        message: "Database is unavailable.",
        ok: false,
      });
    }
  }
}
