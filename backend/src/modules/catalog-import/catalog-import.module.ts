import { Module } from "@nestjs/common";

import { CatalogImportService } from "./catalog-import.service";
import { PrismaCatalogImportRepository, CATALOG_IMPORT_REPOSITORY } from "./catalog-import.repository";
import { R2ObjectExistenceAdapter } from "./adapters/r2-object-existence.adapter";
import { OBJECT_EXISTENCE_PORT } from "./ports/object-existence.port";

@Module({
  exports: [CatalogImportService],
  providers: [
    CatalogImportService,
    PrismaCatalogImportRepository,
    R2ObjectExistenceAdapter,
    { provide: CATALOG_IMPORT_REPOSITORY, useExisting: PrismaCatalogImportRepository },
    { provide: OBJECT_EXISTENCE_PORT, useExisting: R2ObjectExistenceAdapter },
  ],
})
export class CatalogImportModule {}
