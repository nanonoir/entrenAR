import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHmac, randomBytes } from "node:crypto";

import type { AppConfig } from "../../config/app.config";
import { NODE_ENV } from "../../config/app.config";
import type { AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { ERROR_CODE } from "../../common/errors/api-error.response";
import { ROLE } from "../../common/guards/roles.guard";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  AUTH_USER_SELECT,
  toPublicUserProjection,
  UsersService,
  type AuthUser,
  type PublicUser,
} from "../users/users.service";
import { passwordSchema } from "./auth.schemas";
import {
  NoopResetDelivery,
  RESET_DELIVERY_PORT,
  type PasswordResetDelivery,
  type ResetDeliveryPort,
} from "./reset-delivery.port";

const REFRESH_TOKEN_BYTES = 48;
const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_HASH_CONTEXT = "password-reset-token";

export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 900;

export const REFRESH_COOKIE_NAME = "entrenar_refresh";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface AuthSuccess {
  ok: true;
}

export interface RefreshCookieOptions {
  httpOnly: true;
  maxAge: number;
  path: string;
  sameSite: "lax";
  secure: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    @Inject(RESET_DELIVERY_PORT)
    private readonly resetDelivery: ResetDeliveryPort = new NoopResetDelivery(),
  ) {}

  getRefreshCookieOptions(): RefreshCookieOptions {
    return {
      httpOnly: true,
      maxAge: this.configService.getOrThrow("jwtRefreshTtlSeconds", { infer: true }) * 1_000,
      path: "/api/v1/auth",
      sameSite: "lax",
      secure: this.configService.getOrThrow("nodeEnv", { infer: true }) === NODE_ENV.PRODUCTION,
    };
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findPublicById(userId);

    if (!user) {
      throw this.unauthorized();
    }

    return user;
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !(await this.usersService.verifyPassword(password, user.passwordHash))) {
      throw this.invalidCredentials();
    }

    return this.createSession(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthSuccess> {
    this.assertValidReplacementPassword(newPassword, "newPassword");

    const user = await this.usersService.findById(userId);

    if (!user || !(await this.usersService.verifyPassword(currentPassword, user.passwordHash))) {
      throw this.invalidCredentials();
    }

    const passwordHash = await this.usersService.hashPassword(newPassword);
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        data: { passwordHash },
        where: { id: userId },
      });
      await transaction.refreshToken.updateMany({
        data: { revokedAt: now },
        where: { revokedAt: null, userId },
      });
    });

    return { ok: true };
  }

  async forgotPassword(email: string): Promise<AuthSuccess> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return { ok: true };
    }

    const token = this.createRawPasswordResetToken();
    const expiresAt = this.passwordResetExpiresAt(new Date());
    const delivery: PasswordResetDelivery = {
      email: user.email,
      expiresAt,
      token,
    };

    await this.prisma.passwordResetToken.create({
      data: {
        expiresAt,
        tokenHash: this.hashPasswordResetToken(token),
        userId: user.id,
      },
    });
    await this.resetDelivery.deliverPasswordReset(delivery);

    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<AuthSuccess> {
    this.assertValidReplacementPassword(newPassword, "password");

    const storedToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashPasswordResetToken(token) },
    });
    const now = new Date();

    if (!storedToken || storedToken.usedAt || storedToken.expiresAt <= now) {
      throw this.invalidResetToken();
    }

    const passwordHash = await this.usersService.hashPassword(newPassword);

    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        data: { usedAt: now },
        where: {
          expiresAt: { gt: now },
          id: storedToken.id,
          usedAt: null,
        },
      });

      if (consumed.count !== 1) {
        throw this.invalidResetToken();
      }

      await transaction.user.update({
        data: { passwordHash },
        where: { id: storedToken.userId },
      });
      await transaction.refreshToken.updateMany({
        data: { revokedAt: now },
        where: { revokedAt: null, userId: storedToken.userId },
      });
    });

    return { ok: true };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      data: { revokedAt: new Date() },
      where: {
        revokedAt: null,
        tokenHash: this.hashRefreshToken(rawRefreshToken),
      },
    });
  }

  async refresh(rawRefreshToken: string | undefined): Promise<AuthSession> {
    if (!rawRefreshToken) {
      throw this.unauthorized();
    }

    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      include: { user: { select: AUTH_USER_SELECT } },
      where: { tokenHash },
    });

    if (!storedToken) {
      throw this.unauthorized();
    }

    const now = new Date();

    if (storedToken.revokedAt || storedToken.expiresAt <= now) {
      await this.prisma.refreshToken.updateMany({
        data: { revokedAt: now },
        where: { revokedAt: null, userId: storedToken.userId },
      });
      throw this.unauthorized();
    }

    const refreshToken = this.createRawRefreshToken();
    const expiresAt = this.refreshExpiresAt(now);
    const accessToken = await this.createAccessToken(storedToken.user);
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const revocation = await transaction.refreshToken.updateMany({
        data: { revokedAt: now },
        where: {
          expiresAt: { gt: now },
          id: storedToken.id,
          revokedAt: null,
        },
      });

      if (revocation.count !== 1) {
        throw this.unauthorized();
      }

      return transaction.refreshToken.create({
        data: {
          expiresAt,
          tokenHash: this.hashRefreshToken(refreshToken),
          userId: storedToken.userId,
        },
      });
    });

    void rotated;

    return {
      accessToken,
      refreshToken,
      user: this.toPublicUser(storedToken.user),
    };
  }

  async register(email: string, password: string): Promise<AuthSession> {
    const user = await this.usersService.createCustomer(email, password);

    return this.createSession(user);
  }

  private async createAccessToken(user: AuthUser): Promise<string> {
    const payload: AccessTokenPayload = {
      role: user.role,
      userId: user.id,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: this.configService.getOrThrow("jwtAccessTtlSeconds", { infer: true }),
    });
  }

  private async createSession(user: AuthUser): Promise<AuthSession> {
    const now = new Date();
    const refreshToken = this.createRawRefreshToken();
    const [accessToken] = await Promise.all([
      this.createAccessToken(user),
      this.prisma.refreshToken.create({
        data: {
          expiresAt: this.refreshExpiresAt(now),
          tokenHash: this.hashRefreshToken(refreshToken),
          userId: user.id,
        },
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: this.toPublicUser(user),
    };
  }

  private createRawRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  }

  private createRawPasswordResetToken(): string {
    return randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("base64url");
  }

  private hashRefreshToken(token: string): string {
    return this.hashToken(token, "refresh-token");
  }

  private hashPasswordResetToken(token: string): string {
    return this.hashToken(token, PASSWORD_RESET_HASH_CONTEXT);
  }

  private hashToken(token: string, context: string): string {
    return createHmac(
      "sha256",
      `${this.configService.getOrThrow("jwtRefreshSecret", { infer: true })}:${context}`,
    ).update(token).digest("hex");
  }

  private refreshExpiresAt(now: Date): Date {
    return new Date(
      now.getTime() + this.configService.getOrThrow("jwtRefreshTtlSeconds", { infer: true }) * 1_000,
    );
  }

  private passwordResetExpiresAt(now: Date): Date {
    return new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_SECONDS * 1_000);
  }

  private toPublicUser(user: AuthUser): PublicUser {
    return toPublicUserProjection(user);
  }

  private assertValidReplacementPassword(password: string, field: string): void {
    const result = passwordSchema.safeParse(password);

    if (result.success) {
      return;
    }

    throw new BadRequestException({
      code: ERROR_CODE.VALIDATION_ERROR,
      issues: result.error.issues.map((issue) => ({
        code: issue.code,
        field,
        message: issue.message,
      })),
      message: "Request validation failed.",
      ok: false,
    });
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: ERROR_CODE.INVALID_CREDENTIALS,
      message: "Invalid email or password.",
      ok: false,
    });
  }

  private invalidResetToken(): BadRequestException {
    return new BadRequestException({
      code: ERROR_CODE.INVALID_RESET_TOKEN,
      message: "Invalid or expired reset token.",
      ok: false,
    });
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({
      code: ERROR_CODE.UNAUTHORIZED,
      message: "Unauthorized.",
      ok: false,
    });
  }
}
