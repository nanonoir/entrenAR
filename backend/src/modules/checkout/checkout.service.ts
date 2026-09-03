import { Injectable, Optional } from "@nestjs/common";

import { toCheckoutCompleteResponse } from "./checkout.mapper";
import {
  type CheckoutCompleteRequest,
  type CheckoutQuoteRequest,
} from "./checkout.schemas";
import {
  CheckoutRepository,
} from "./checkout.repository";
import { CatalogRepository } from "../catalog/catalog.repository";
import { CommerceRepository } from "../commerce/commerce.repository";
import { CheckoutCompletionService } from "./checkout-completion.service";
import { CheckoutDiscountRules } from "./checkout-discount.rules";
import { CheckoutLineResolver } from "./checkout-line-resolver";
import { CheckoutPaymentRules } from "./checkout-payment.rules";
import { CheckoutSnapshotBuilder } from "./checkout-snapshot.builder";
import {
  CheckoutQuoteService,
  type CheckoutActorContext,
  type CheckoutQuoteResult,
} from "./checkout-quote.service";
export type { CheckoutActorContext, CheckoutQuoteResult } from "./checkout-quote.service";

@Injectable()
export class CheckoutService {
  private readonly lineResolver: CheckoutLineResolver;
  private readonly discountRules: CheckoutDiscountRules;
  private readonly paymentRules: CheckoutPaymentRules;
  private readonly quoteService: CheckoutQuoteService;
  private readonly completionService: CheckoutCompletionService;
  private readonly snapshotBuilder: CheckoutSnapshotBuilder;

  constructor(
    private readonly checkoutRepository: CheckoutRepository,
    catalogRepository: CatalogRepository,
    commerceRepository: CommerceRepository,
    @Optional() lineResolver?: CheckoutLineResolver,
    @Optional() quoteService?: CheckoutQuoteService,
    @Optional() paymentRules?: CheckoutPaymentRules,
    @Optional() discountRules?: CheckoutDiscountRules,
    @Optional() completionService?: CheckoutCompletionService,
    @Optional() snapshotBuilder?: CheckoutSnapshotBuilder,
  ) {
    this.lineResolver = lineResolver ?? new CheckoutLineResolver(catalogRepository, checkoutRepository);
    this.discountRules = discountRules ?? new CheckoutDiscountRules(checkoutRepository, commerceRepository);
    this.paymentRules = paymentRules ?? new CheckoutPaymentRules(commerceRepository);
    this.quoteService = quoteService ?? new CheckoutQuoteService(
      checkoutRepository,
      catalogRepository,
      commerceRepository,
      this.lineResolver,
      undefined,
      this.paymentRules,
      this.discountRules,
    );
    this.completionService = completionService ?? new CheckoutCompletionService(
      checkoutRepository,
      this.quoteService,
      this.discountRules,
    );
    this.snapshotBuilder = snapshotBuilder ?? new CheckoutSnapshotBuilder(checkoutRepository, this.paymentRules);
  }

  async quote(
    input: CheckoutQuoteRequest,
    actor?: CheckoutActorContext,
  ): Promise<CheckoutQuoteResult> {
    return this.quoteService.quote(input, actor);
  }

  async getQuote(input: CheckoutQuoteRequest, actor?: CheckoutActorContext): Promise<CheckoutQuoteResult> {
    return this.quote(input, actor);
  }

  async complete(
    input: CheckoutCompleteRequest,
    actor?: CheckoutActorContext,
  ): Promise<ReturnType<typeof toCheckoutCompleteResponse>> {
    return this.completionService.complete(input, actor, this.snapshotBuilder);
  }

  async completeCheckout(
    input: CheckoutCompleteRequest,
    actor?: CheckoutActorContext,
  ): Promise<ReturnType<typeof toCheckoutCompleteResponse>> {
    return this.complete(input, actor);
  }
}
