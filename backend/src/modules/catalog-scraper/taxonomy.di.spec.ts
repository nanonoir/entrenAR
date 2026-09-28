import { Test } from "@nestjs/testing";
import { CatalogRepository } from "../catalog/catalog.repository";
import { CatalogTaxonomySyncService } from "./taxonomy";

describe("CatalogTaxonomySyncService Nest wiring", () => {
  it("resolves through Nest dependency injection", async () => {
    const testingModule = await Test.createTestingModule({
      providers: [
        CatalogTaxonomySyncService,
        { provide: CatalogRepository, useValue: {} },
      ],
    }).compile();

    expect(testingModule.get(CatalogTaxonomySyncService)).toBeInstanceOf(CatalogTaxonomySyncService);
    await testingModule.close();
  });
});
