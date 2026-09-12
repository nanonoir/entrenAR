import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHmac, randomBytes } from "node:crypto";

import type { AppConfig } from "../../config/app.config";
import { NODE_ENV } from "../../config/app.config";
import type { AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { ERROR_CODE } from "../../common/errors/api-error.response";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  AUTH_USER_SELECT,
  toPublicUserProjection,
  UsersService,
  type AuthUser,
  type PublicUser,
} from "../users/users.service";
import { passwordSchema } from "./auth.schemas";
import { RefreshSessionType } from "../../generated/prisma/enums";
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
export const ADMIN_REFRESH_COOKIE_NAME = "entrenar_admin_refresh";

export interface AuthSession {
  accessToken: string;
  accessTokenExpiresAt: Date;
  idleExpiresAt?: Date;
  refreshToken: string;
  sessionType: RefreshSessionType;
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

  getRefreshCookieOptions(sessionType: RefreshSessionType = RefreshSessionType.CUSTOMER): RefreshCookieOptions {
    return {
      httpOnly: true,
      maxAge: this.refreshTtlSeconds(sessionType) * 1_000,
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

    if (!user || user.role !== "CUSTOMER" || !(await this.usersService.verifyPassword(password, user.passwordHash))) {
      throw this.invalidCredentials();
    }

    return this.createSession(user, RefreshSessionType.CUSTOMER);
  }

  async loginAdmin(email: string, password: string): Promise<AuthSession> {
    const user = await this.usersService.findByEmail(email);

    if (!user || user.role !== "ADMIN" || !(await this.usersService.verifyPassword(password, user.passwordHash))) {
      throw this.invalidCredentials();
    }

    return this.createSession(user, RefreshSessionType.ADMIN);
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

  async logout(rawRefreshToken: string | undefined, sessionType: RefreshSessionType = RefreshSessionType.CUSTOMER): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      data: { revokedAt: new Date() },
      where: {
        revokedAt: null,
        sessionType,
        tokenHash: this.hashRefreshToken(rawRefreshToken),
      },
    });
  }

  async refresh(rawRefreshToken: string | undefined, sessionType: RefreshSessionType = RefreshSessionType.CUSTOMER): Promise<AuthSession> {
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

    const storedSessionType = (storedToken as { sessionType?: RefreshSessionType }).sessionType ?? RefreshSessionType.CUSTOMER;
    const successorTokenHash = (storedToken as { successorTokenHash?: string | null }).successorTokenHash;
    const successorIssuedAt = (storedToken as { successorIssuedAt?: Date | null }).successorIssuedAt;

    if (storedSessionType !== sessionType) {
      throw this.unauthorized();
    }

    if (storedToken.revokedAt) {
      if (successorTokenHash && successorIssuedAt && this.isWithinConcurrencyTolerance(storedToken.revokedAt, now)) {
        const successorToken = this.createSuccessorRefreshToken(rawRefreshToken, successorIssuedAt);
        if (this.hashRefreshToken(successorToken) === successorTokenHash) {
          const accessToken = await this.createAccessToken(storedToken.user, sessionType);
          return this.createSessionResponse(
            storedToken.user,
            successorToken,
            sessionType,
            successorIssuedAt,
            accessToken,
          );
        }
      }

      await this.prisma.refreshToken.updateMany({
        data: { revokedAt: now },
        where: { revokedAt: null, sessionType, userId: storedToken.userId },
      });
      throw this.unauthorized();
    }

    if (storedToken.expiresAt <= now) {
      await this.prisma.refreshToken.updateMany({
        data: { revokedAt: now },
        where: { revokedAt: null, sessionType, userId: storedToken.userId },
      });
      throw this.unauthorized();
    }

    const refreshToken = this.createSuccessorRefreshToken(rawRefreshToken, now);
    const expiresAt = this.refreshExpiresAt(now, sessionType);
    const accessToken = await this.createAccessToken(storedToken.user, sessionType);
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const revocation = await transaction.refreshToken.updateMany({
        data: { revokedAt: now },
        where: {
          expiresAt: { gt: now },
          id: storedToken.id,
          revokedAt: null,
          sessionType,
        },
      });

      if (revocation.count !== 1) {
        throw this.unauthorized();
      }

      const successor = await transaction.refreshToken.create({
        data: {
          expiresAt,
          sessionType,
          tokenHash: this.hashRefreshToken(refreshToken),
          userId: storedToken.userId,
        },
      });

      await transaction.refreshToken.update({
        data: { successorIssuedAt: now, successorTokenHash: this.hashRefreshToken(refreshToken) },
        where: { id: storedToken.id },
      });

      return successor;
    });

    void rotated;

    return this.createSessionResponse(storedToken.user, refreshToken, sessionType, now, accessToken);
  }

  async register(email: string, password: string): Promise<AuthSession> {
    const user = await this.usersService.createCustomer(email, password);

    return this.createSession(user, RefreshSessionType.CUSTOMER);
  }

  private async createAccessToken(user: AuthUser, sessionType: RefreshSessionType): Promise<string> {
    const payload: AccessTokenPayload = {
      role: user.role,
      sessionType,
      userId: user.id,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: this.accessTtlSeconds(sessionType),
    });
  }

  private async createSession(user: AuthUser, sessionType: RefreshSessionType): Promise<AuthSession> {
    const now = new Date();
    const refreshToken = this.createRawRefreshToken();
    const [accessToken] = await Promise.all([
      this.createAccessToken(user, sessionType),
      this.prisma.refreshToken.create({
        data: {
          expiresAt: this.refreshExpiresAt(now),
          sessionType,
          tokenHash: this.hashRefreshToken(refreshToken),
          userId: user.id,
        },
      }),
    ]);

    return this.createSessionResponse(user, refreshToken, sessionType, now, accessToken);
  }

  private createSessionResponse(
    user: AuthUser,
    refreshToken: string,
    sessionType: RefreshSessionType,
    issuedAt: Date,
    accessToken: string,
  ): AuthSession {
    const accessTtlSeconds = this.accessTtlSeconds(sessionType);
    const idleExpiresAt = sessionType === RefreshSessionType.ADMIN
      ? new Date(issuedAt.getTime() + (this.configService.getOrThrow("jwtAdminRefreshTtlSeconds", { infer: true }) ?? 1_800) * 1_000)
      : undefined;

    return {
      accessToken,
      accessTokenExpiresAt: new Date(issuedAt.getTime() + accessTtlSeconds * 1_000),
      ...(idleExpiresAt ? { idleExpiresAt } : {}),
      refreshToken,
      sessionType,
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

  private createSuccessorRefreshToken(previousToken: string, issuedAt: Date): string {
    return createHmac(
      "sha256",
      `${this.configService.getOrThrow("jwtRefreshSecret", { infer: true })}:refresh-successor`,
    ).update(`${previousToken}:${issuedAt.toISOString()}`).digest("base64url");
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

  private refreshExpiresAt(now: Date, sessionType: RefreshSessionType = RefreshSessionType.CUSTOMER): Date {
    return new Date(
      now.getTime() + (sessionType === RefreshSessionType.ADMIN
        ? (this.configService.getOrThrow("jwtAdminRefreshTtlSeconds", { infer: true }) ?? 1_800)
        : this.configService.getOrThrow("jwtRefreshTtlSeconds", { infer: true })) * 1_000,
    );
  }

  private accessTtlSeconds(sessionType: RefreshSessionType): number {
    return sessionType === RefreshSessionType.ADMIN
      ? (this.configService.getOrThrow("jwtAdminAccessTtlSeconds", { infer: true }) ?? 900)
      : this.configService.getOrThrow("jwtAccessTtlSeconds", { infer: true });
  }

  private refreshTtlSeconds(sessionType: RefreshSessionType): number {
    return sessionType === RefreshSessionType.ADMIN
      ? (this.configService.getOrThrow("jwtAdminRefreshTtlSeconds", { infer: true }) ?? 1_800)
      : this.configService.getOrThrow("jwtRefreshTtlSeconds", { infer: true });
  }

  private isWithinConcurrencyTolerance(revokedAt: Date, now: Date): boolean {
    const tolerance = (this.configService.getOrThrow("refreshConcurrencyToleranceSeconds", { infer: true }) ?? 5) * 1_000;
    return now.getTime() - revokedAt.getTime() <= tolerance;
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
