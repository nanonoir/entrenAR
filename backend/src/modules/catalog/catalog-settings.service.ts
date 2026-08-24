import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../common/prisma/prisma.service";
import type { CatalogSettings } from "../../generated/prisma/client";

const CATALOG_SETTINGS_ID = "singleton";

@Injectable()
export class CatalogSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<CatalogSettings> {
    return this.prisma.catalogSettings.upsert({
      where: { id: CATALOG_SETTINGS_ID },
      create: { id: CATALOG_SETTINGS_ID },
      update: {},
    });
  }

  async setShowOutOfStockAtEnd(showOutOfStockAtEnd: boolean): Promise<CatalogSettings> {
    return this.prisma.catalogSettings.upsert({
      where: { id: CATALOG_SETTINGS_ID },
      create: { id: CATALOG_SETTINGS_ID, showOutOfStockAtEnd },
      update: { showOutOfStockAtEnd },
    });
  }
}
