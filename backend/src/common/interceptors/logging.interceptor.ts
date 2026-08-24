import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";

import { ERROR_CODE } from "../errors/api-error.response";

interface RequestActor {
  id?: string;
}

interface RequestWithContext {
  method: string;
  path: string;
  requestId?: string;
  user?: RequestActor;
}

interface ResponseWithStatus {
  statusCode: number;
}

interface RequestLogRecord {
  actorId?: string;
  durationMs: number;
  errorCode?: string;
  method: string;
  requestId: string;
  route: string;
  status: number;
}

const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_FIELD_PATTERN = /authorization|cookie|password|token|secret|api[_-]?key|card|cvv/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function redactSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveData);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_FIELD_PATTERN.test(key) ? REDACTED_VALUE : redactSensitiveData(nestedValue),
    ]),
  );
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const response = context.switchToHttp().getResponse<ResponseWithStatus>();
    const startedAt = performance.now();

    return next.handle().pipe(
      tap({
        error: (error: unknown) => this.writeLog(
          request,
          this.statusForError(error),
          startedAt,
          this.errorCode(error),
        ),
        next: () => this.writeLog(request, response, startedAt),
      }),
    );
  }

  private errorCode(error: unknown): string {
    if (!(error instanceof HttpException)) {
      return ERROR_CODE.INTERNAL_ERROR;
    }

    const response = error.getResponse();

    if (typeof response !== "object" || response === null || !("code" in response)) {
      return this.errorCodeForStatus(error.getStatus());
    }

    return typeof response.code === "string" ? response.code : this.errorCodeForStatus(error.getStatus());
  }

  private errorCodeForStatus(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) {
      return ERROR_CODE.BAD_REQUEST;
    }

    if (status === HttpStatus.FORBIDDEN) {
      return ERROR_CODE.FORBIDDEN;
    }

    if (status === HttpStatus.NOT_FOUND) {
      return ERROR_CODE.NOT_FOUND;
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return ERROR_CODE.RATE_LIMITED;
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return ERROR_CODE.UNAUTHORIZED;
    }

    return ERROR_CODE.INTERNAL_ERROR;
  }

  private statusForError(error: unknown): number {
    return error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private writeLog(
    request: RequestWithContext,
    response: ResponseWithStatus | number,
    startedAt: number,
    errorCode?: string,
  ): void {
    const record: RequestLogRecord = {
      ...(request.user?.id ? { actorId: request.user.id } : {}),
      durationMs: Math.round(performance.now() - startedAt),
      ...(errorCode ? { errorCode } : {}),
      method: request.method,
      requestId: request.requestId ?? "unknown",
      route: request.path,
      status: typeof response === "number" ? response : response.statusCode,
    };

    this.logger.log(JSON.stringify(redactSensitiveData(record)));
  }
}
