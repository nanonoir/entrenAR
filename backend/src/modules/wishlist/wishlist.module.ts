import { Module } from "@nestjs/common";

import { CatalogModule } from "../catalog/catalog.module";
import { WishlistController } from "./wishlist.controller";
import { WishlistRepository } from "./wishlist.repository";
import { WishlistService } from "./wishlist.service";

@Module({
  controllers: [WishlistController],
  exports: [WishlistService],
  imports: [CatalogModule],
  providers: [WishlistRepository, WishlistService],
})
export class WishlistModule {}
