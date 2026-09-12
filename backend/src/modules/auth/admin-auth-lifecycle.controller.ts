import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBody, ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { Public } from "../../common/auth/public.decorator";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RefreshSessionType } from "../../generated/prisma/enums";
import { ADMIN_REFRESH_COOKIE_NAME, AuthService, type AuthSession } from "./auth.service";
import { credentialsSchema, type AuthCredentialsInput } from "./auth.schemas";

const SENSITIVE_AUTH_THROTTLE_LIMIT = 5;
const SENSITIVE_AUTH_THROTTLE_TTL_MS = 60_000;

@ApiTags("Administrator Authentication")
@Controller("auth/admin")
export class AdminAuthLifecycleController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: SENSITIVE_AUTH_THROTTLE_LIMIT, ttl: SENSITIVE_AUTH_THROTTLE_TTL_MS } })
  @Post("login")
  @ApiOperation({ summary: "Authenticate an administrator" })
  @ApiBody({ schema: { properties: { email: { type: "string" }, password: { type: "string" } }, required: ["email", "password"], type: "object" } })
  @ApiOkResponse({ description: "Administrator session created." })
  @ApiResponse({ description: "INVALID_CREDENTIALS", status: HttpStatus.UNAUTHORIZED, type: ApiErrorResponseDto })
  async login(
    @Body(new ZodValidationPipe(credentialsSchema)) credentials: AuthCredentialsInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.loginAdmin(credentials.email, credentials.password);
    this.setRefreshCookie(response, session.refreshToken);
    return this.toResponse(session);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  @ApiOperation({ summary: "Rotate an administrator refresh session" })
  @ApiCookieAuth("admin-refresh-cookie")
  @ApiOkResponse({ description: "Administrator session refreshed." })
  @ApiResponse({ description: "UNAUTHORIZED", status: HttpStatus.UNAUTHORIZED, type: ApiErrorResponseDto })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.refresh(this.refreshCookieFrom(request), RefreshSessionType.ADMIN);
    this.setRefreshCookie(response, session.refreshToken);
    return this.toResponse(session);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  @ApiOperation({ summary: "Revoke an administrator refresh session" })
  @ApiCookieAuth("admin-refresh-cookie")
  @ApiNoContentResponse({ description: "Administrator session revoked." })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.authService.logout(this.refreshCookieFrom(request), RefreshSessionType.ADMIN);
    response.clearCookie(ADMIN_REFRESH_COOKIE_NAME, { ...this.authService.getRefreshCookieOptions(RefreshSessionType.ADMIN), path: "/api/v1/auth/admin" });
  }

  private refreshCookieFrom(request: Request): string | undefined {
    const cookie = request.headers.cookie?.split(";").find((item) => item.trim().startsWith(`${ADMIN_REFRESH_COOKIE_NAME}=`));
    if (!cookie) return undefined;

    try {
      return decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
    } catch {
      return undefined;
    }
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(ADMIN_REFRESH_COOKIE_NAME, refreshToken, {
      ...this.authService.getRefreshCookieOptions(RefreshSessionType.ADMIN),
      path: "/api/v1/auth/admin",
    });
  }

  private toResponse(session: AuthSession) {
    return {
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt.toISOString(),
      idleExpiresAt: session.idleExpiresAt?.toISOString(),
      refreshToken: session.refreshToken,
      sessionType: session.sessionType,
      user: session.user,
    };
  }
}
