export const ERROR_CODE = {
  BAD_REQUEST: "BAD_REQUEST",
  CONFLICT: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  INVALID_INVENTORY_OPERATION: "INVALID_INVENTORY_OPERATION",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  RATE_LIMITED: "RATE_LIMITED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export interface ApiFieldIssue {
  code: string;
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  code: ErrorCode;
  issues?: readonly ApiFieldIssue[];
  message: string;
  ok: false;
}
