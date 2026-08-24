import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHmac, randomBytes } from "node:crypto";

import type { AppConfig } from "../../config/app.config";
import type { AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { ERROR_CODE } from "../../common/errors/api-error.response";
import { ROLE } from "../../common/guards/roles.guard";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UsersService, type AuthUser, type PublicUser } from "../users/users.service";

const REFRESH_TOKEN_BYTES = 48;

export const REFRESH_COOKIE_NAME = "entrenar_refresh";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

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
      throw new UnauthorizedException({
        code: ERROR_CODE.INVALID_CREDENTIALS,
        message: "Invalid email or password.",
        ok: false,
      });
    }

    return this.createSession(user);
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
      include: { user: true },
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

  private hashRefreshToken(token: string): string {
    return createHmac(
      "sha256",
      this.configService.getOrThrow("jwtRefreshSecret", { infer: true }),
    ).update(token).digest("hex");
  }

  private refreshExpiresAt(now: Date): Date {
    return new Date(
      now.getTime() + this.configService.getOrThrow("jwtRefreshTtlSeconds", { infer: true }) * 1_000,
    );
  }

  private toPublicUser(user: AuthUser): PublicUser {
    return {
      email: user.email,
      id: user.id,
      role: user.role,
    };
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({
      code: ERROR_CODE.UNAUTHORIZED,
      message: "Unauthorized.",
      ok: false,
    });
  }
}
