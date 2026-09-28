import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { CatalogTaxonomySyncService } from "./taxonomy";

@Module({ imports: [CatalogModule], providers: [CatalogTaxonomySyncService], exports: [CatalogTaxonomySyncService] })
export class CatalogScraperModule {}
