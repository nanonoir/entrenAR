import { Module } from "@nestjs/common";

import { CatalogModule } from "../catalog/catalog.module";
import { CommerceModule } from "../commerce/commerce.module";
import { InventoryModule } from "../inventory/inventory.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutCartRepository } from "./checkout-cart.repository";
import { CheckoutCompletionService } from "./checkout-completion.service";
import { CheckoutDeliveryRules } from "./checkout-delivery.rules";
import { CheckoutDiscountRules } from "./checkout-discount.rules";
import { CheckoutIdempotencyRepository } from "./checkout-idempotency.repository";
import { CheckoutLineResolver } from "./checkout-line-resolver";
import { CheckoutOrderRepository } from "./checkout-order.repository";
import { CheckoutPaymentRules } from "./checkout-payment.rules";
import { CheckoutQuoteService } from "./checkout-quote.service";
import { CheckoutRepository } from "./checkout.repository";
import { CheckoutSessionRepository } from "./checkout-session.repository";
import { CheckoutSnapshotBuilder } from "./checkout-snapshot.builder";
import { CheckoutService } from "./checkout.service";
import { CheckoutTransaction } from "./checkout-transaction";

@Module({
  controllers: [CheckoutController],
  exports: [CheckoutService],
  imports: [CatalogModule, CommerceModule, InventoryModule],
  providers: [
    CheckoutCartRepository,
    CheckoutCompletionService,
    CheckoutDeliveryRules,
    CheckoutDiscountRules,
    CheckoutIdempotencyRepository,
    CheckoutLineResolver,
    CheckoutOrderRepository,
    CheckoutPaymentRules,
    CheckoutQuoteService,
    CheckoutRepository,
    CheckoutSessionRepository,
    CheckoutSnapshotBuilder,
    CheckoutService,
    CheckoutTransaction,
  ],
})
export class CheckoutModule {}
