import {
  FetchCheckoutApiClient,
  type CheckoutApiClient,
} from "@/lib/api/checkout/client";
import {
  type CheckoutCompleteInput,
  type CheckoutCompletion,
  type CheckoutQuote,
  type CheckoutQuoteInput,
  type CheckoutRepository,
} from "@/lib/api/checkout/checkout.repository";
import { DATA_SOURCE } from "@/lib/api/config";
import { mapCompleteResponse, mapQuoteResponse } from "@/lib/api/checkout/checkout-api.mappers";
import { toCheckoutCompletePayload, toCheckoutQuotePayload } from "@/lib/api/checkout/checkout-api.payloads";

export class CheckoutApiRepository implements CheckoutRepository {
  readonly source = DATA_SOURCE.API;

  constructor(private readonly client: CheckoutApiClient = new FetchCheckoutApiClient()) {}

  async quote(input: CheckoutQuoteInput): Promise<CheckoutQuote> {
    const response = await this.client.post<unknown>("/checkout/quote", toCheckoutQuotePayload(input));
    return mapQuoteResponse(response);
  }

  async complete(input: CheckoutCompleteInput): Promise<CheckoutCompletion> {
    const response = await this.client.post<unknown>("/checkout/complete", toCheckoutCompletePayload(input));
    return mapCompleteResponse(response);
  }
}

export {
  checkoutCompleteRequestSchema,
  checkoutCompleteResponseSchema,
  checkoutQuoteRequestSchema,
  checkoutQuoteResponseSchema,
} from "@/lib/api/checkout/checkout-api.schemas";

export type {
  CheckoutCompleteRequestDto,
  CheckoutCompleteResponseDto,
  CheckoutQuoteRequestDto,
  CheckoutQuoteResponseDto,
} from "@/lib/api/checkout/checkout-api.schemas";

export {
  toCheckoutCompletePayload,
  toCheckoutQuotePayload,
} from "@/lib/api/checkout/checkout-api.payloads";
