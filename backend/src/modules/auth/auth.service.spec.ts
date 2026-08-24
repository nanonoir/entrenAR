import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";

import type { AppConfig } from "../../config/app.config";
import { ERROR_CODE } from "../../common/errors/api-error.response";
import { ROLE, RolesGuard } from "../../common/guards/roles.guard";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UsersService, type AuthUser } from "../users/users.service";
import { AuthService } from "./auth.service";

const ADMIN_USER: AuthUser = {
  email: "admin@entrenar.test",
  id: "admin-user-id",
  passwordHash: "stored-hash",
  role: ROLE.ADMIN,
};

describe("auth.service", () => {
  it("issues a short-lived access token and persists a refresh token on successful login", async () => {
    const harness = createHarness();
    harness.users.findByEmail.mockResolvedValue(ADMIN_USER);
    harness.users.verifyPassword.mockResolvedValue(true);

    const session = await harness.service.login(ADMIN_USER.email, "correct-password");

    expect(harness.users.verifyPassword).toHaveBeenCalledWith("correct-password", ADMIN_USER.passwordHash);
    expect(harness.jwt.signAsync).toHaveBeenCalledWith(
      { role: ROLE.ADMIN, userId: ADMIN_USER.id },
      { expiresIn: 900 },
    );
    expect(harness.prisma.refreshToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: ADMIN_USER.id,
      }),
    }));
    expect(session).toEqual(expect.objectContaining({
      accessToken: "signed-access-token",
      user: {
        email: ADMIN_USER.email,
        id: ADMIN_USER.id,
        role: ROLE.ADMIN,
      },
    }));
    expect(session.refreshToken).toHaveLength(64);
  });

  it("returns a safe invalid-credentials response for unknown users", async () => {
    const harness = createHarness();
    harness.users.findByEmail.mockResolvedValue(null);

    await expect(harness.service.login("unknown@entrenar.test", "incorrect-password")).rejects.toMatchObject({
      response: {
        code: ERROR_CODE.INVALID_CREDENTIALS,
        message: "Invalid email or password.",
        ok: false,
      },
      status: 401,
    });
    expect(harness.users.verifyPassword).not.toHaveBeenCalled();
  });

  it("rotates a valid refresh token and rejects its later reuse", async () => {
    const harness = createHarness();
    const storedToken = {
      expiresAt: new Date(Date.now() + 60_000),
      id: "refresh-token-id",
      revokedAt: null as Date | null,
      user: ADMIN_USER,
      userId: ADMIN_USER.id,
    };
    harness.prisma.refreshToken.findUnique.mockResolvedValue(storedToken);

    const session = await harness.service.refresh("original-refresh-token");

    expect(harness.transaction.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: storedToken.id,
        revokedAt: null,
      }),
    }));
    expect(harness.transaction.refreshToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: ADMIN_USER.id }),
    }));
    expect(session.refreshToken).not.toBe("original-refresh-token");

    storedToken.revokedAt = new Date();

    await expect(harness.service.refresh("original-refresh-token")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(harness.prisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: ADMIN_USER.id }),
    }));
  });

  it("denies a customer from an ADMIN-decorated route", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([ROLE.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createRoleContext(ROLE.CUSTOMER);

    expect(() => guard.canActivate(context)).toThrow("Forbidden");
  });
});

function createHarness(): AuthHarness {
  const users = {
    createCustomer: jest.fn(),
    findByEmail: jest.fn(),
    findPublicById: jest.fn(),
    verifyPassword: jest.fn(),
  };
  const transaction = {
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: "rotated-token-id" }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (operation: (value: typeof transaction) => Promise<unknown>) => operation(transaction)),
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: "refresh-token-id" }),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const jwt = {
    signAsync: jest.fn().mockResolvedValue("signed-access-token"),
  };
  const config = {
    getOrThrow: jest.fn((key: keyof AppConfig) => {
      const values: Pick<AppConfig, "jwtAccessTtlSeconds" | "jwtRefreshSecret" | "jwtRefreshTtlSeconds"> = {
        jwtAccessTtlSeconds: 900,
        jwtRefreshSecret: "refresh-secret-with-at-least-thirty-two-characters",
        jwtRefreshTtlSeconds: 2_592_000,
      };

      return values[key as keyof typeof values];
    }),
  };

  return {
    jwt,
    prisma,
    service: new AuthService(
      config as unknown as ConfigService<AppConfig, true>,
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
      users as unknown as UsersService,
    ),
    transaction,
    users,
  };
}

function createRoleContext(role: typeof ROLE.CUSTOMER): ExecutionContext {
  return {
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getClass: () => class TestController {},
    getHandler: () => () => undefined,
    getType: () => "http",
    switchToHttp: () => ({
      getNext: () => undefined,
      getRequest: () => ({ originalUrl: "/api/v1/admin/auth-probe", user: { role } }),
      getResponse: () => undefined,
    }),
    switchToRpc: () => ({ getContext: () => undefined, getData: () => undefined }),
    switchToWs: () => ({ getClient: () => undefined, getData: () => undefined, getPattern: () => undefined }),
  } as unknown as ExecutionContext;
}

interface AuthHarness {
  jwt: {
    signAsync: jest.Mock;
  };
  prisma: {
    $transaction: jest.Mock;
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  service: AuthService;
  transaction: {
    refreshToken: {
      create: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  users: {
    createCustomer: jest.Mock;
    findByEmail: jest.Mock;
    findPublicById: jest.Mock;
    verifyPassword: jest.Mock;
  };
}
