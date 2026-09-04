import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { InventoryModule } from "../inventory/inventory.module";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { AdminPurchaseOrdersController } from "./admin-purchase-orders.controller";
import { PurchaseOrdersRepository } from "./purchase-orders.repository";
import { PurchaseOrdersService } from "./purchase-orders.service";

@Module({
  controllers: [AdminPurchaseOrdersController],
  exports: [PurchaseOrdersRepository, PurchaseOrdersService],
  imports: [AuthModule, InventoryModule, SuppliersModule],
  providers: [PurchaseOrdersRepository, PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
