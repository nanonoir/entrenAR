import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export const ROLE = {
  ADMIN: "ADMIN",
  CUSTOMER: "CUSTOMER",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLES_METADATA_KEY = "roles";

interface RequestActor {
  role?: Role;
}

interface RequestWithActor {
  originalUrl: string;
  user?: RequestActor;
}

function isAdminRoute(url: string): boolean {
  const pathname = new URL(url, "http://localhost").pathname;

  return pathname === "/api/v1/admin" || pathname.startsWith("/api/v1/admin/");
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithActor>();
    const declaredRoles = this.reflector.getAllAndOverride<readonly Role[]>(ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = isAdminRoute(request.originalUrl) ? [ROLE.ADMIN] : (declaredRoles ?? []);

    if (requiredRoles.length === 0) {
      return true;
    }

    if (request.user?.role && requiredRoles.includes(request.user.role)) {
      return true;
    }

    throw new ForbiddenException({
      code: "FORBIDDEN",
      message: "Forbidden.",
      ok: false,
    });
  }
}
