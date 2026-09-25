import { Module } from "@nestjs/common";

import { InventoryModule } from "../inventory/inventory.module";
import type { FixtureRestorer } from "./fixtures/fixture-restorer";
import { CatalogFixtureRestorer } from "./restorers/catalog-fixture-restorer";
import { CheckoutPrerequisitesFixtureRestorer } from "./restorers/checkout-prerequisites-fixture-restorer";
import { CommerceFixtureRestorer } from "./restorers/commerce-fixture-restorer";
import { OrderDependentCrmFixtureRestorer } from "./restorers/order-dependent-crm-fixture-restorer";
import { ShowcaseResetRunMutex } from "./showcase-reset.run-mutex";
import { SHOWCASE_RESET_RESTORERS, ShowcaseResetService } from "./showcase-reset.service";

@Module({
  exports: [ShowcaseResetService],
  imports: [InventoryModule],
  providers: [
    ShowcaseResetRunMutex,
    ShowcaseResetService,
    {
      provide: SHOWCASE_RESET_RESTORERS,
      useFactory: (): readonly FixtureRestorer[] => [
        new CatalogFixtureRestorer(),
        new CommerceFixtureRestorer(),
        new CheckoutPrerequisitesFixtureRestorer(),
        new OrderDependentCrmFixtureRestorer(),
      ],
    },
  ],
})
export class ShowcaseResetModule {}
