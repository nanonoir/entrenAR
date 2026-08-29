import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";

import type { AppConfig } from "../../config/app.config";
import { NODE_ENV } from "../../config/app.config";
import { ERROR_CODE } from "../../common/errors/api-error.response";
import { ROLE, RolesGuard } from "../../common/guards/roles.guard";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UsersService, type AuthUser } from "../users/users.service";
import { AuthService, PASSWORD_RESET_TOKEN_TTL_SECONDS } from "./auth.service";

const ADMIN_USER: AuthUser = {
  birthDate: new Date("1985-04-12T00:00:00.000Z"),
  dni: "12345678",
  email: "admin@entrenar.test",
  firstName: "Admin",
  gender: "other",
  id: "admin-user-id",
  lastName: "EntrenAR",
  passwordHash: "stored-hash",
  phone: "+54 11 5555-5555",
  role: ROLE.ADMIN,
};

const REPLACEMENT_PASSWORD = "ReplacementPassword123!";

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
      user: expect.objectContaining({
        email: ADMIN_USER.email,
        id: ADMIN_USER.id,
        role: ROLE.ADMIN,
      }),
    }));
    expect(session.refreshToken).toHaveLength(64);
  });

  it("returns an account-aware current-user projection without secrets", async () => {
    const harness = createHarness();
    harness.users.findPublicById.mockResolvedValue({
      birthDate: "1985-04-12",
      dni: ADMIN_USER.dni,
      email: ADMIN_USER.email,
      firstName: ADMIN_USER.firstName,
      gender: ADMIN_USER.gender,
      id: ADMIN_USER.id,
      lastName: ADMIN_USER.lastName,
      phone: ADMIN_USER.phone,
      role: ADMIN_USER.role,
    });

    const user = await harness.service.getCurrentUser(ADMIN_USER.id);

    expect(user).toEqual(expect.objectContaining({
      birthDate: "1985-04-12",
      email: ADMIN_USER.email,
      firstName: ADMIN_USER.firstName,
      id: ADMIN_USER.id,
      role: ADMIN_USER.role,
    }));
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("refreshToken");
    expect(user).not.toHaveProperty("resetToken");
  });

  it("changes the password only after verifying the current password and revokes refresh sessions", async () => {
    const harness = createHarness();
    harness.users.findById.mockResolvedValue(ADMIN_USER);
    harness.users.verifyPassword.mockResolvedValue(true);
    harness.users.hashPassword.mockResolvedValue("replacement-password-hash");

    await expect(harness.service.changePassword(
      ADMIN_USER.id,
      "CurrentPassword123!",
      REPLACEMENT_PASSWORD,
    )).resolves.toEqual({ ok: true });

    expect(harness.users.verifyPassword).toHaveBeenCalledWith("CurrentPassword123!", ADMIN_USER.passwordHash);
    expect(harness.users.hashPassword).toHaveBeenCalledWith(REPLACEMENT_PASSWORD);
    expect(harness.transaction.user.update).toHaveBeenCalledWith({
      data: { passwordHash: "replacement-password-hash" },
      where: { id: ADMIN_USER.id },
    });
    expect(harness.transaction.refreshToken.updateMany).toHaveBeenCalledWith({
      data: { revokedAt: expect.any(Date) },
      where: { revokedAt: null, userId: ADMIN_USER.id },
    });
  });

  it("does not change the password when the current password is invalid", async () => {
    const harness = createHarness();
    harness.users.findById.mockResolvedValue(ADMIN_USER);
    harness.users.verifyPassword.mockResolvedValue(false);

    await expect(harness.service.changePassword(
      ADMIN_USER.id,
      "WrongPassword123!",
      REPLACEMENT_PASSWORD,
    )).rejects.toMatchObject({
      response: {
        code: ERROR_CODE.INVALID_CREDENTIALS,
        ok: false,
      },
      status: 401,
    });

    expect(harness.users.hashPassword).not.toHaveBeenCalled();
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns the same forgot-password response for known and unknown emails", async () => {
    const harness = createHarness();
    harness.users.findByEmail.mockResolvedValue(ADMIN_USER);

    const knownResponse = await harness.service.forgotPassword(ADMIN_USER.email);
    const delivery = harness.resetDelivery.deliverPasswordReset.mock.calls[0]![0];
    const storedToken = harness.prisma.passwordResetToken.create.mock.calls[0]![0];

    harness.users.findByEmail.mockResolvedValue(null);
    const unknownResponse = await harness.service.forgotPassword("unknown@entrenar.test");

    expect(knownResponse).toEqual({ ok: true });
    expect(unknownResponse).toEqual(knownResponse);
    expect(storedToken).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        expiresAt: expect.any(Date),
        tokenHash: expect.any(String),
        userId: ADMIN_USER.id,
      }),
    }));
    expect(delivery).toEqual(expect.objectContaining({
      email: ADMIN_USER.email,
      expiresAt: expect.any(Date),
      token: expect.any(String),
    }));
    expect(storedToken.data.tokenHash).not.toBe(delivery.token);
    expect(knownResponse).not.toHaveProperty("token");
    expect(harness.resetDelivery.deliverPasswordReset).toHaveBeenCalledTimes(1);
  });

  it("consumes a valid reset token, changes the password, and revokes refresh sessions", async () => {
    const harness = createHarness();
    const rawToken = "valid-reset-credential";
    const storedToken = {
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_SECONDS * 1_000),
      id: "password-reset-token-id",
      tokenHash: "stored-reset-hash",
      usedAt: null as Date | null,
      userId: ADMIN_USER.id,
    };
    harness.prisma.passwordResetToken.findUnique.mockResolvedValue(storedToken);
    harness.users.hashPassword.mockResolvedValue("reset-password-hash");

    await expect(harness.service.resetPassword(rawToken, REPLACEMENT_PASSWORD)).resolves.toEqual({ ok: true });

    const lookup = harness.prisma.passwordResetToken.findUnique.mock.calls[0]![0];
    expect(lookup).toEqual({ where: { tokenHash: expect.any(String) } });
    expect(lookup.where.tokenHash).not.toBe(rawToken);
    expect(harness.transaction.passwordResetToken.updateMany).toHaveBeenCalledWith({
      data: { usedAt: expect.any(Date) },
      where: {
        expiresAt: { gt: expect.any(Date) },
        id: storedToken.id,
        usedAt: null,
      },
    });
    expect(harness.transaction.user.update).toHaveBeenCalledWith({
      data: { passwordHash: "reset-password-hash" },
      where: { id: ADMIN_USER.id },
    });
    expect(harness.transaction.refreshToken.updateMany).toHaveBeenCalledWith({
      data: { revokedAt: expect.any(Date) },
      where: { revokedAt: null, userId: ADMIN_USER.id },
    });
  });

  it("rejects expired or consumed reset tokens without changing the password", async () => {
    const harness = createHarness();
    harness.prisma.passwordResetToken.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1_000),
      id: "expired-reset-token-id",
      tokenHash: "expired-reset-hash",
      usedAt: null,
      userId: ADMIN_USER.id,
    });

    await expect(harness.service.resetPassword("expired-reset-credential", REPLACEMENT_PASSWORD)).rejects.toMatchObject({
      response: {
        code: ERROR_CODE.INVALID_RESET_TOKEN,
        ok: false,
      },
      status: 400,
    });

    expect(harness.users.hashPassword).not.toHaveBeenCalled();
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a reset token that has already been consumed", async () => {
    const harness = createHarness();
    harness.prisma.passwordResetToken.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "consumed-reset-token-id",
      tokenHash: "consumed-reset-hash",
      usedAt: new Date(Date.now() - 1_000),
      userId: ADMIN_USER.id,
    });

    await expect(harness.service.resetPassword("consumed-reset-credential", REPLACEMENT_PASSWORD)).rejects.toMatchObject({
      response: {
        code: ERROR_CODE.INVALID_RESET_TOKEN,
        ok: false,
      },
      status: 400,
    });

    expect(harness.users.hashPassword).not.toHaveBeenCalled();
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("makes refresh-cookie security environment-aware and aligns its lifetime with the refresh TTL", () => {
    const developmentHarness = createHarness(NODE_ENV.DEVELOPMENT);
    const productionHarness = createHarness(NODE_ENV.PRODUCTION);

    expect(developmentHarness.service.getRefreshCookieOptions()).toEqual({
      httpOnly: true,
      maxAge: 2_592_000_000,
      path: "/api/v1/auth",
      sameSite: "lax",
      secure: false,
    });
    expect(productionHarness.service.getRefreshCookieOptions()).toEqual(expect.objectContaining({ secure: true }));
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

function createHarness(nodeEnv: AppConfig["nodeEnv"] = NODE_ENV.TEST): AuthHarness {
  const users = {
    createCustomer: jest.fn(),
    findByEmail: jest.fn(),
    findPublicById: jest.fn(),
    findById: jest.fn(),
    hashPassword: jest.fn(),
    toPublicUser: jest.fn((user: AuthUser) => ({
      birthDate: user.birthDate instanceof Date ? user.birthDate.toISOString().slice(0, 10) : user.birthDate ?? null,
      dni: user.dni ?? null,
      email: user.email,
      firstName: user.firstName ?? null,
      gender: user.gender ?? null,
      id: user.id,
      lastName: user.lastName ?? null,
      phone: user.phone ?? null,
      role: user.role,
    })),
    verifyPassword: jest.fn(),
  };
  const transaction = {
    passwordResetToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: "rotated-token-id" }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      update: jest.fn().mockResolvedValue(ADMIN_USER),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (operation: (value: typeof transaction) => Promise<unknown>) => operation(transaction)),
    passwordResetToken: {
      create: jest.fn().mockResolvedValue({ id: "password-reset-token-id" }),
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: "refresh-token-id" }),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const resetDelivery = {
    deliverPasswordReset: jest.fn().mockResolvedValue(undefined),
  };
  const jwt = {
    signAsync: jest.fn().mockResolvedValue("signed-access-token"),
  };
  const config = {
    getOrThrow: jest.fn((key: keyof AppConfig) => {
      const values: Pick<AppConfig, "jwtAccessTtlSeconds" | "jwtRefreshSecret" | "jwtRefreshTtlSeconds"> & { nodeEnv: AppConfig["nodeEnv"] } = {
        jwtAccessTtlSeconds: 900,
        jwtRefreshSecret: "refresh-secret-with-at-least-thirty-two-characters",
        jwtRefreshTtlSeconds: 2_592_000,
        nodeEnv,
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
      resetDelivery,
    ),
    transaction,
    resetDelivery,
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
    passwordResetToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  service: AuthService;
  transaction: {
    passwordResetToken: {
      updateMany: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    user: {
      update: jest.Mock;
    };
  };
  resetDelivery: {
    deliverPasswordReset: jest.Mock;
  };
  users: {
    createCustomer: jest.Mock;
    findByEmail: jest.Mock;
    findById: jest.Mock;
    findPublicById: jest.Mock;
    hashPassword: jest.Mock;
    toPublicUser: jest.Mock;
    verifyPassword: jest.Mock;
  };
}
