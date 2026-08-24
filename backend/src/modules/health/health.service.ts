import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { PrismaService } from "../../common/prisma/prisma.service";

export const HEALTH_STATUS = {
  LIVE: "live",
  READY: "ready",
} as const;

export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

export interface HealthResponse {
  ok: true;
  status: HealthStatus;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  live(): HealthResponse {
    return { ok: true, status: HEALTH_STATUS.LIVE };
  }

  async ready(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, status: HEALTH_STATUS.READY };
    } catch {
      throw new ServiceUnavailableException({
        code: ERROR_CODE.SERVICE_UNAVAILABLE,
        message: "Database is unavailable.",
        ok: false,
      });
    }
  }
}
