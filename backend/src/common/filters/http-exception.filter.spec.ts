import { ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common";

import { ERROR_CODE } from "../errors/api-error.response";
import { HttpExceptionFilter } from "./http-exception.filter";

describe("http-exception.filter", () => {
  it("logs a 500 stack trace with request context and keeps the response sanitized", () => {
    const exception = new Error("database password leaked");
    const loggerSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();
    const response = {
      json: jest.fn(),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    const host = createHost(response, {
      method: "GET",
      originalUrl: "/api/v1/health",
      requestId: "request-500",
    });

    try {
      new HttpExceptionFilter().catch(exception, host);

      expect(loggerSpy).toHaveBeenCalledWith(
        JSON.stringify({
          message: exception.message,
          method: "GET",
          path: "/api/v1/health",
          requestId: "request-500",
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        }),
        exception.stack,
      );
      expect(response.json).toHaveBeenCalledWith({
        code: ERROR_CODE.INTERNAL_ERROR,
        message: "An internal error occurred.",
        ok: false,
      });
      expect(response.json.mock.calls[0]?.[0]).not.toHaveProperty("stack");
    } finally {
      loggerSpy.mockRestore();
    }
  });

  it("logs explicit HTTP 500 exceptions without exposing their internals", () => {
    const exception = new HttpException({
      code: ERROR_CODE.INTERNAL_ERROR,
      message: "private database details",
      ok: false,
    }, HttpStatus.INTERNAL_SERVER_ERROR);
    const loggerSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();
    const response = {
      json: jest.fn(),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    try {
      new HttpExceptionFilter().catch(exception, createHost(response, {
        method: "POST",
        originalUrl: "/api/v1/orders",
        requestId: "request-http-500",
      }));

      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(response.json).toHaveBeenCalledWith({
        code: ERROR_CODE.INTERNAL_ERROR,
        message: "An internal error occurred.",
        ok: false,
      });
    } finally {
      loggerSpy.mockRestore();
    }
  });
});

function createHost(response: ResponseHarness, request: RequestHarness): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
}

interface RequestHarness {
  method: string;
  originalUrl: string;
  requestId: string;
}

interface ResponseHarness {
  json: jest.Mock;
  setHeader: jest.Mock;
  status: jest.Mock;
}
