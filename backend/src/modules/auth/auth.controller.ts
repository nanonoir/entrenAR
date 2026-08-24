import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { z } from "zod";

import type { AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { Public } from "../../common/auth/public.decorator";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthCredentialsDto, AuthSessionResponseDto, AuthUserDto } from "./dto/auth-openapi.dto";
import { AuthService, REFRESH_COOKIE_NAME, type AuthSession } from "./auth.service";

const passwordSchema = z.string().min(12, { error: "Password must contain at least 12 characters." });

const credentialsSchema = z.object({
  email: z.email({ error: "Email must be valid." }).transform((email) => email.toLowerCase()),
  password: passwordSchema,
});

type CredentialsInput = z.infer<typeof credentialsSchema>;

interface RequestWithAuthenticatedUser extends Request {
  user: AccessTokenPayload;
}

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Register a customer account" })
  @ApiBody({ type: AuthCredentialsDto })
  @ApiCreatedResponse({ description: "Customer account and authenticated session created.", type: AuthSessionResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiResponse({ description: "CONFLICT", status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  async register(
    @Body(new ZodValidationPipe(credentialsSchema)) credentials: CredentialsInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReturnType<AuthController["toResponse"]>> {
    const session = await this.authService.register(credentials.email, credentials.password);

    this.setRefreshCookie(response, session.refreshToken);
    return this.toResponse(session);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("login")
  @ApiOperation({ summary: "Authenticate with email and password" })
  @ApiBody({ type: AuthCredentialsDto })
  @ApiOkResponse({ description: "Authenticated session created.", type: AuthSessionResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiResponse({ description: "INVALID_CREDENTIALS", status: HttpStatus.UNAUTHORIZED, type: ApiErrorResponseDto })
  async login(
    @Body(new ZodValidationPipe(credentialsSchema)) credentials: CredentialsInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReturnType<AuthController["toResponse"]>> {
    const session = await this.authService.login(credentials.email, credentials.password);

    this.setRefreshCookie(response, session.refreshToken);
    return this.toResponse(session);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  @ApiOperation({ summary: "Rotate the HttpOnly refresh cookie and issue a new access token" })
  @ApiCookieAuth("refresh-cookie")
  @ApiOkResponse({ description: "Session refreshed and refresh cookie rotated.", type: AuthSessionResponseDto })
  @ApiResponse({ description: "UNAUTHORIZED", status: HttpStatus.UNAUTHORIZED, type: ApiErrorResponseDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReturnType<AuthController["toResponse"]>> {
    const session = await this.authService.refresh(this.refreshCookieFrom(request));

    this.setRefreshCookie(response, session.refreshToken);
    return this.toResponse(session);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  @ApiOperation({ summary: "Revoke the current refresh session" })
  @ApiCookieAuth("refresh-cookie")
  @ApiNoContentResponse({ description: "Session cookie cleared." })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.refreshCookieFrom(request));
    response.clearCookie(REFRESH_COOKIE_NAME, this.refreshCookieOptions());
  }

  @Get("me")
  @ApiOperation({ summary: "Get the current authenticated user" })
  @ApiBearerAuth("access-token")
  @ApiOkResponse({ description: "Authenticated user.", type: AuthUserDto })
  @ApiResponse({ description: "UNAUTHORIZED", status: HttpStatus.UNAUTHORIZED, type: ApiErrorResponseDto })
  async me(@Req() request: RequestWithAuthenticatedUser) {
    return this.authService.getCurrentUser(request.user.userId);
  }

  private refreshCookieFrom(request: Request): string | undefined {
    const cookie = request.headers.cookie?.split(";").find((item) => {
      return item.trim().startsWith(`${REFRESH_COOKIE_NAME}=`);
    });

    if (!cookie) {
      return undefined;
    }

    const value = cookie.slice(cookie.indexOf("=") + 1);

    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  private refreshCookieOptions() {
    return {
      httpOnly: true,
      maxAge: 2_592_000_000,
      path: "/api/v1/auth",
      sameSite: "lax" as const,
      secure: true,
    };
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, this.refreshCookieOptions());
  }

  private toResponse(session: AuthSession) {
    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  }
}
