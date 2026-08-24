import { HttpStatus } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { PrismaService } from "../../common/prisma/prisma.service";
import { HEALTH_STATUS, HealthService } from "./health.service";

describe("health.service", () => {
  it("reports liveness without querying PostgreSQL", () => {
    const harness = createHarness();

    expect(harness.service.live()).toEqual({ ok: true, status: HEALTH_STATUS.LIVE });
    expect(harness.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("reports readiness after a safe PostgreSQL connectivity query", async () => {
    const harness = createHarness();
    harness.prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

    await expect(harness.service.ready()).resolves.toEqual({ ok: true, status: HEALTH_STATUS.READY });
    expect(harness.prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns a controlled service-unavailable error without database details", async () => {
    const harness = createHarness();
    harness.prisma.$queryRaw.mockRejectedValue(new Error("postgresql://user:secret@unavailable:5432/entrenar"));

    await expect(harness.service.ready()).rejects.toMatchObject({
      response: {
        code: ERROR_CODE.SERVICE_UNAVAILABLE,
        message: "Database is unavailable.",
        ok: false,
      },
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });
});

function createHarness(): HealthHarness {
  const prisma = {
    $queryRaw: jest.fn(),
  };

  return {
    prisma,
    service: new HealthService(prisma as unknown as PrismaService),
  };
}

interface HealthHarness {
  prisma: {
    $queryRaw: jest.Mock;
  };
  service: HealthService;
}
