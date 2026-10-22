import { Module } from "@nestjs/common";

import { MercadoPagoHttpOrdersAdapter } from "./mercadopago/mercadopago-orders.http-adapter";
import { MERCADOPAGO_ORDERS_PORT } from "./mercadopago/mercadopago-orders.port";

@Module({
  providers: [{ provide: MERCADOPAGO_ORDERS_PORT, useClass: MercadoPagoHttpOrdersAdapter }],
  exports: [MERCADOPAGO_ORDERS_PORT],
})
export class PaymentsModule {}
