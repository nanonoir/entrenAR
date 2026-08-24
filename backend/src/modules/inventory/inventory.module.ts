import { Module } from "@nestjs/common";

import { InventoryController } from "./inventory.controller";
import { InventoryRepository } from "./inventory.repository";
import { InventoryService } from "./inventory.service";

@Module({
  controllers: [InventoryController],
  exports: [InventoryService],
  providers: [InventoryRepository, InventoryService],
})
export class InventoryModule {}
