import {
  toCommerceApiError,
  type CommerceApiIssue,
} from "@/lib/api/commerce/client";

export const COMMERCE_ASYNC_STATUS = {
  ERROR: "error",
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
} as const;

export type CommerceAsyncStatus = (typeof COMMERCE_ASYNC_STATUS)[keyof typeof COMMERCE_ASYNC_STATUS];

export interface CommerceStoreError {
  code: string;
  issues: readonly CommerceApiIssue[];
  message: string;
  status: number;
}

export function toCommerceStoreError(
  error: unknown,
  fallbackCode = "COMMERCE_OPERATION_FAILED",
  fallbackMessage = "The commerce operation could not be completed.",
): CommerceStoreError {
  const normalized = toCommerceApiError(error, fallbackCode, fallbackMessage);

  return {
    code: normalized.code,
    issues: normalized.issues,
    message: normalized.message,
    status: normalized.status,
  };
}
