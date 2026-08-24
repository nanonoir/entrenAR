import { ArgumentsHost, CallHandler, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of } from "rxjs";
import { z } from "zod";

import { ERROR_CODE } from "./errors/api-error.response";
import { HttpExceptionFilter } from "./filters/http-exception.filter";
import { ROLE, RolesGuard } from "./guards/roles.guard";
import { LoggingInterceptor, redactSensitiveData } from "./interceptors/logging.interceptor";
import { ZodValidationPipe } from "./pipes/zod-validation.pipe";

describe("common foundation", () => {
  it("returns field-level validation issues from Zod 4 schemas", () => {
    const pipe = new ZodValidationPipe(z.object({ email: z.email({ error: "Email is invalid." }) }));

    expect(() => pipe.transform({ email: "not-an-email" })).toThrow(HttpException);

    try {
      pipe.transform({ email: "not-an-email" });
    } catch (error) {
      const exception = error as HttpException;
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.getResponse()).toEqual({
        code: ERROR_CODE.VALIDATION_ERROR,
        issues: [{ code: "invalid_format", field: "email", message: "Email is invalid." }],
        message: "Request validation failed.",
        ok: false,
      });
    }
  });

  it("hides unexpected exception details and preserves the request ID", () => {
    const response = {
      json: jest.fn(),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: "request-123" }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(new Error("database password leaked"), host);

    expect(response.setHeader).toHaveBeenCalledWith("x-request-id", "request-123");
    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      code: ERROR_CODE.INTERNAL_ERROR,
      message: "An internal error occurred.",
      ok: false,
    });
  });

  it("redacts credentials recursively before structured logging", () => {
    expect(redactSensitiveData({
      authorization: "Bearer access-token",
      nested: { password: "not-for-logs", safe: "value" },
      refreshToken: "not-for-logs",
    })).toEqual({
      authorization: "[REDACTED]",
      nested: { password: "[REDACTED]", safe: "value" },
      refreshToken: "[REDACTED]",
    });
  });

  it("writes structured logs without request credentials or query tokens", () => {
    const accessToken = "access-token-not-for-logs";
    const refreshToken = "refresh-token-not-for-logs";
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          authorization: `Bearer ${accessToken}`,
          cookie: `refresh_token=${refreshToken}`,
          method: "GET",
          path: "/api/v1/products",
          requestId: "request-456",
        }),
        getResponse: () => ({ statusCode: HttpStatus.OK }),
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of(undefined) } as CallHandler;

    try {
      new LoggingInterceptor().intercept(context, next).subscribe();

      const output = String(logSpy.mock.calls[0]?.[0]);
      expect(output).toContain("request-456");
      expect(output).toContain("/api/v1/products");
      expect(output).not.toContain(accessToken);
      expect(output).not.toContain(refreshToken);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("denies admin routes unless a trusted request actor has the ADMIN role", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const adminContext = createContext({ originalUrl: "/api/v1/admin/products", user: { role: ROLE.ADMIN } });
    const anonymousContext = createContext({ originalUrl: "/api/v1/admin/products" });

    expect(guard.canActivate(adminContext)).toBe(true);
    expect(() => guard.canActivate(anonymousContext)).toThrow(ForbiddenException);
  });
});

function createContext(request: { originalUrl: string; user?: { role: typeof ROLE.ADMIN } }): ExecutionContext {
  return {
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getClass: () => class TestController {},
    getHandler: () => () => undefined,
    getType: () => "http",
    switchToHttp: () => ({
      getNext: () => undefined,
      getRequest: () => request,
      getResponse: () => undefined,
    }),
    switchToRpc: () => ({ getContext: () => undefined, getData: () => undefined }),
    switchToWs: () => ({ getClient: () => undefined, getData: () => undefined, getPattern: () => undefined }),
  } as unknown as ExecutionContext;
}
