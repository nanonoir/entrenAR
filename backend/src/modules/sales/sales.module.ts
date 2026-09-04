import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { InventoryModule } from "../inventory/inventory.module";
import { AdminSalesController } from "./admin-sales.controller";
import { SalesRepository } from "./sales.repository";
import { SalesService } from "./sales.service";

@Module({
  controllers: [AdminSalesController],
  exports: [SalesRepository, SalesService],
  imports: [AuthModule, InventoryModule],
  providers: [SalesRepository, SalesService],
})
export class SalesModule {}
