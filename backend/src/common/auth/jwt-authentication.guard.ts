import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";

import { ERROR_CODE } from "../errors/api-error.response";
import { ROLE, type Role } from "../guards/roles.guard";
import { OPTIONAL_AUTH_METADATA_KEY } from "./optional-auth.decorator";
import { IS_PUBLIC_KEY } from "./public.decorator";

export interface AccessTokenPayload {
  role: Role;
  userId: string;
}

interface RequestWithAuthorization {
  headers: {
    authorization?: string;
  };
  user?: AccessTokenPayload;
}

@Injectable()
export class JwtAuthenticationGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isOptional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuthorization>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token && isOptional) {
      return true;
    }

    if (!token) {
      throw this.unauthorized();
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);

      if (!this.isAccessTokenPayload(payload)) {
        throw this.unauthorized();
      }

      request.user = payload;
      return true;
    } catch {
      throw this.unauthorized();
    }
  }

  private extractBearerToken(authorization: string | undefined): string | undefined {
    const [scheme, token] = authorization?.split(" ") ?? [];

    return scheme === "Bearer" && token ? token : undefined;
  }

  private isAccessTokenPayload(payload: AccessTokenPayload): boolean {
    return (
      typeof payload.userId === "string" &&
      (payload.role === ROLE.ADMIN || payload.role === ROLE.CUSTOMER)
    );
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({
      code: ERROR_CODE.UNAUTHORIZED,
      message: "Unauthorized.",
      ok: false,
    });
  }
}
