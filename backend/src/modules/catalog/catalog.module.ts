import { Module } from "@nestjs/common";

import { CatalogSettingsService } from "./catalog-settings.service";
import { CatalogQueryService } from "./catalog-query.service";
import { CatalogRepository } from "./catalog.repository";
import { CategoryService } from "./category.service";
import { ProductService } from "./product.service";
import { AdminCatalogController } from "./admin-catalog.controller";
import { PublicCatalogController } from "./public-catalog.controller";

@Module({
  controllers: [AdminCatalogController, PublicCatalogController],
  exports: [CatalogQueryService, CatalogRepository, CatalogSettingsService, CategoryService, ProductService],
  providers: [CatalogSettingsService, CatalogQueryService, CatalogRepository, CategoryService, ProductService],
})
export class CatalogModule {}
