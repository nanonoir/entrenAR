import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";

import { ApiErrorResponse, ApiFieldIssue, ERROR_CODE, ErrorCode } from "../errors/api-error.response";
import { RequestWithId } from "../middleware/request-id.middleware";

type ErrorResponsePayload = Partial<ApiErrorResponse> & { issues?: unknown; message?: unknown; ok?: unknown };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const error = this.toResponse(exception, status);

    response.setHeader("x-request-id", request.requestId ?? "");
    response.status(status).json(error);
  }

  private toResponse(exception: unknown, status: number): ApiErrorResponse {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();

      if (typeof payload === "object" && payload !== null && "code" in payload) {
        const typedPayload = payload as ErrorResponsePayload;

        if (this.isErrorCode(typedPayload.code) && typeof typedPayload.message === "string") {
          return {
            code: typedPayload.code,
            ...(this.isFieldIssues(typedPayload.issues) ? { issues: typedPayload.issues } : {}),
            message: typedPayload.code === ERROR_CODE.INTERNAL_ERROR ? this.messageForStatus(status) : typedPayload.message,
            ok: false,
          };
        }
      }
    }

    return {
      code: this.codeForStatus(status),
      message: this.messageForStatus(status),
      ok: false,
    };
  }

  private codeForStatus(status: number): ErrorCode {
    if (status === HttpStatus.BAD_REQUEST) {
      return ERROR_CODE.BAD_REQUEST;
    }

    if (status === HttpStatus.CONFLICT) {
      return ERROR_CODE.CONFLICT;
    }

    if (status === HttpStatus.FORBIDDEN) {
      return ERROR_CODE.FORBIDDEN;
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return ERROR_CODE.RATE_LIMITED;
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return ERROR_CODE.UNAUTHORIZED;
    }

    if (status === HttpStatus.NOT_FOUND) {
      return ERROR_CODE.NOT_FOUND;
    }

    return ERROR_CODE.INTERNAL_ERROR;
  }

  private isErrorCode(value: unknown): value is ErrorCode {
    return typeof value === "string" && Object.values(ERROR_CODE).includes(value as ErrorCode);
  }

  private isFieldIssues(value: unknown): value is readonly ApiFieldIssue[] {
    return Array.isArray(value) && value.every((issue) => {
      return (
        typeof issue === "object" &&
        issue !== null &&
        "code" in issue &&
        "field" in issue &&
        "message" in issue &&
        typeof issue.code === "string" &&
        typeof issue.field === "string" &&
        typeof issue.message === "string"
      );
    });
  }

  private messageForStatus(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) {
      return "Bad request.";
    }

    if (status === HttpStatus.FORBIDDEN) {
      return "Forbidden.";
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return "Too many requests.";
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return "Unauthorized.";
    }

    if (status === HttpStatus.NOT_FOUND) {
      return "Resource not found.";
    }

    return "An internal error occurred.";
  }
}
