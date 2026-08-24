import { Module } from "@nestjs/common";

import { CatalogSettingsService } from "./catalog-settings.service";
import { CatalogRepository } from "./catalog.repository";
import { CategoryService } from "./category.service";
import { ProductService } from "./product.service";

@Module({
  exports: [CatalogSettingsService, CategoryService, ProductService],
  providers: [CatalogSettingsService, CatalogRepository, CategoryService, ProductService],
})
export class CatalogModule {}
