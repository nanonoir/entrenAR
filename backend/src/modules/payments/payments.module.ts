import { Module } from "@nestjs/common";

import { InventoryModule } from "../inventory/inventory.module";
import { MercadoPagoHttpOrdersAdapter } from "./mercadopago/mercadopago-orders.http-adapter";
import { MERCADOPAGO_ORDERS_PORT } from "./mercadopago/mercadopago-orders.port";
import { MercadoPagoWebhookController } from "./mercadopago/mercadopago-webhook.controller";
import { PaymentNotificationProcessorService } from "./payment-notification-processor.service";
import { PaymentNotificationService } from "./payment-notification.service";
import { PaymentCircuitService } from "./payment-circuit.service";
import { PaymentDispatchService } from "./payment-dispatch.service";
import { PaymentReducerService } from "./payment-reducer.service";
import { PaymentRetryService } from "./payment-retry.service";
import { PaymentStatusService } from "./payment-status.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsRepository } from "./payments.repository";
import { PaymentsTransaction } from "./payments-transaction";

@Module({
  controllers: [PaymentsController, MercadoPagoWebhookController],
  exports: [
    MERCADOPAGO_ORDERS_PORT,
    PaymentCircuitService,
    PaymentDispatchService,
    PaymentNotificationProcessorService,
    PaymentReducerService,
    PaymentStatusService,
  ],
  imports: [InventoryModule],
  providers: [
    { provide: MERCADOPAGO_ORDERS_PORT, useClass: MercadoPagoHttpOrdersAdapter },
    PaymentCircuitService,
    PaymentDispatchService,
    PaymentNotificationProcessorService,
    PaymentNotificationService,
    PaymentReducerService,
    PaymentRetryService,
    PaymentStatusService,
    PaymentsRepository,
    PaymentsTransaction,
  ],
})
export class PaymentsModule {}
