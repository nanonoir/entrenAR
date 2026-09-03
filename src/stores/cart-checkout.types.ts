import type {
  CheckoutCompleteInput,
  CheckoutCompletion,
  CheckoutLineItemInput,
  CheckoutOperationError,
  CheckoutQuote,
  CheckoutQuoteInput,
} from "@/lib/api/checkout/checkout.repository";

export const CHECKOUT_ASYNC_STATUS = {
  ERROR: "error",
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
} as const;

export type CheckoutAsyncStatus = (typeof CHECKOUT_ASYNC_STATUS)[keyof typeof CHECKOUT_ASYNC_STATUS];

export type CheckoutQuoteOptions = Omit<CheckoutQuoteInput, "items" | "sessionToken"> & {
  items?: readonly CheckoutLineItemInput[];
  sessionToken?: string | null;
};

export type CheckoutCompletionOptions = Omit<
  CheckoutCompleteInput,
  "idempotencyKey" | "items" | "quoteId" | "sessionToken"
> & {
  idempotencyKey?: string;
  items?: readonly CheckoutLineItemInput[];
  quoteId?: string | null;
  sessionToken?: string | null;
};

export type CheckoutState = {
  checkoutSessionToken: string | null;
  completion: CheckoutCompletion | null;
  completionConflict: CheckoutOperationError | null;
  completionError: CheckoutOperationError | null;
  completionRetryAvailable: boolean;
  completionStatus: CheckoutAsyncStatus;
  idempotencyKey: string | null;
  quote: CheckoutQuote | null;
  quoteConflict: CheckoutOperationError | null;
  quoteError: CheckoutOperationError | null;
  quoteRetryAvailable: boolean;
  quoteStatus: CheckoutAsyncStatus;
};
