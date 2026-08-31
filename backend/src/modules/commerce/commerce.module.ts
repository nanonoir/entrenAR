import { Module } from "@nestjs/common";

import { DiscountsController } from "./controllers/discounts.controller";
import { PaymentMethodsController } from "./controllers/payment-methods.controller";
import { PickupPointsController } from "./controllers/pickup-points.controller";
import { ShippingController } from "./controllers/shipping.controller";
import { CommerceRepository } from "./commerce.repository";
import { DiscountService } from "./services/discount.service";
import { PaymentService } from "./services/payment.service";
import { ShippingService } from "./services/shipping.service";

@Module({
  controllers: [DiscountsController, PaymentMethodsController, PickupPointsController, ShippingController],
  exports: [DiscountService, PaymentService, ShippingService],
  providers: [CommerceRepository, DiscountService, PaymentService, ShippingService],
})
export class CommerceModule {}
