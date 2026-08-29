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

import type { AccessTokenPayload } from "../../common/auth/jwt-authentication.guard";
import { Public } from "../../common/auth/public.decorator";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  AuthCredentialsDto,
  AuthSessionResponseDto,
  AuthSuccessResponseDto,
  AuthUserDto,
  ChangePasswordRequestDto,
  ForgotPasswordRequestDto,
  ResetPasswordRequestDto,
} from "./dto/auth-openapi.dto";
import { AuthService, REFRESH_COOKIE_NAME, type AuthSession } from "./auth.service";
import {
  changePasswordSchema,
  credentialsSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type AuthCredentialsInput,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "./auth.schemas";

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
    @Body(new ZodValidationPipe(credentialsSchema)) credentials: AuthCredentialsInput,
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
    @Body(new ZodValidationPipe(credentialsSchema)) credentials: AuthCredentialsInput,
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

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("forgot-password")
  @ApiOperation({ summary: "Start password recovery without revealing account existence" })
  @ApiBody({ type: ForgotPasswordRequestDto })
  @ApiOkResponse({ description: "Recovery request accepted.", type: AuthSuccessResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) input: ForgotPasswordInput,
  ) {
    return this.authService.forgotPassword(input.email);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("reset-password")
  @ApiOperation({ summary: "Set a new password with an opaque one-time recovery credential" })
  @ApiBody({ type: ResetPasswordRequestDto })
  @ApiOkResponse({ description: "Password reset completed.", type: AuthSuccessResponseDto })
  @ApiResponse({ description: "INVALID_RESET_TOKEN", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) input: ResetPasswordInput,
  ) {
    return this.authService.resetPassword(input.token, input.password);
  }

  @HttpCode(HttpStatus.OK)
  @Post("change-password")
  @ApiOperation({ summary: "Change the authenticated user's password" })
  @ApiBearerAuth("access-token")
  @ApiBody({ type: ChangePasswordRequestDto })
  @ApiOkResponse({ description: "Password changed and prior refresh sessions revoked.", type: AuthSuccessResponseDto })
  @ApiResponse({ description: "INVALID_CREDENTIALS", status: HttpStatus.UNAUTHORIZED, type: ApiErrorResponseDto })
  @ApiResponse({ description: "VALIDATION_ERROR", status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  async changePassword(
    @Req() request: RequestWithAuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) input: ChangePasswordInput,
  ) {
    return this.authService.changePassword(request.user.userId, input.currentPassword, input.newPassword);
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
    return this.authService.getRefreshCookieOptions();
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
