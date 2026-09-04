import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ROLE, RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  it("requires ADMIN for every admin URL even when metadata is absent", () => {
    const reflector = reflectorReturning(undefined);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext("/api/v1/admin/sales", { role: ROLE.ADMIN }))).toBe(true);
    expect(() => guard.canActivate(createContext("/api/v1/admin/sales", { role: ROLE.CUSTOMER })))
      .toThrow(ForbiddenException);
    expect(() => guard.canActivate(createContext("/api/v1/admin/sales"))).toThrow(ForbiddenException);
  });

  it("honors declared roles for non-admin routes and allows routes without requirements", () => {
    const reflector = reflectorReturning([ROLE.CUSTOMER]);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext("/api/v1/account/orders", { role: ROLE.CUSTOMER }))).toBe(true);
    expect(() => guard.canActivate(createContext("/api/v1/account/orders", { role: ROLE.ADMIN })))
      .toThrow(ForbiddenException);

    const openGuard = new RolesGuard(reflectorReturning(undefined));
    expect(openGuard.canActivate(createContext("/api/v1/health/live"))).toBe(true);
  });

  it("matches admin paths with query strings without widening unrelated routes", () => {
    const guard = new RolesGuard(reflectorReturning([ROLE.CUSTOMER]));

    expect(guard.canActivate(createContext("http://localhost/api/v1/admin/suppliers?status=active", { role: ROLE.ADMIN }))).toBe(true);
    expect(guard.canActivate(createContext("/api/v1/administer", { role: ROLE.CUSTOMER }))).toBe(true);
  });
});

function reflectorReturning(value: readonly string[] | undefined): Reflector {
  return { getAllAndOverride: jest.fn().mockReturnValue(value) } as unknown as Reflector;
}

function createContext(originalUrl: string, user?: { role: typeof ROLE.ADMIN | typeof ROLE.CUSTOMER }): ExecutionContext {
  return {
    getClass: () => class TestController {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ originalUrl, user }) }),
  } as unknown as ExecutionContext;
}
