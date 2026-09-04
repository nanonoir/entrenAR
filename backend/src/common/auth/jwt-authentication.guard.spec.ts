import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";

import { JwtAuthenticationGuard } from "./jwt-authentication.guard";
import { OPTIONAL_AUTH_METADATA_KEY } from "./optional-auth.decorator";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { ROLE } from "../guards/roles.guard";

describe("JwtAuthenticationGuard", () => {
  it("rejects missing or malformed bearer credentials", async () => {
    const guard = createGuard();

    await expect(guard.canActivate(createContext({}))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(createContext({ headers: { authorization: "Basic token" } }))).rejects.toMatchObject({ status: 401 });
  });

  it("validates the token payload and attaches trusted identity to the request", async () => {
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue({ role: ROLE.ADMIN, userId: "admin-1" }) };
    const guard = createGuard(jwtService);
    const request: RequestWithAuthorization = { headers: { authorization: "Bearer access-token" } };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({ role: ROLE.ADMIN, userId: "admin-1" });

    jwtService.verifyAsync.mockResolvedValue({ role: "UNKNOWN", userId: "admin-1" });
    await expect(guard.canActivate(createContext({ headers: { authorization: "Bearer invalid-payload" } })))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("supports public and optional-auth metadata without weakening protected routes", async () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => key === IS_PUBLIC_KEY),
    } as unknown as Reflector;
    const guard = new JwtAuthenticationGuard({ verifyAsync: jest.fn() } as unknown as JwtService, reflector);

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);

    const optionalReflector = {
      getAllAndOverride: jest.fn((key: string) => key === OPTIONAL_AUTH_METADATA_KEY),
    } as unknown as Reflector;
    const optionalGuard = new JwtAuthenticationGuard({ verifyAsync: jest.fn() } as unknown as JwtService, optionalReflector);
    await expect(optionalGuard.canActivate(createContext({}))).resolves.toBe(true);
  });
});

interface RequestWithAuthorization {
  headers?: { authorization?: string };
  user?: { role: string; userId: string };
}

function createGuard(jwtService: Partial<JwtService> = { verifyAsync: jest.fn() }): JwtAuthenticationGuard {
  return new JwtAuthenticationGuard(jwtService as JwtService, {
    getAllAndOverride: jest.fn().mockReturnValue(undefined),
  } as unknown as Reflector);
}

function createContext(request: RequestWithAuthorization = {}): ExecutionContext {
  const normalized = request as RequestWithAuthorization & { headers: { authorization?: string } };
  normalized.headers ??= {};

  return {
    getClass: () => class TestController {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => normalized }),
  } as unknown as ExecutionContext;
}
