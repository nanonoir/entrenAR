import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AppConfig, validateEnvironment } from "./config/app.config";
import { JwtAuthenticationGuard } from "./common/auth/jwt-authentication.guard";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { RolesGuard } from "./common/guards/roles.guard";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AccountModule } from "./modules/account/account.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { CommerceModule } from "./modules/commerce/commerce.module";
import { HealthModule } from "./modules/health/health.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { WishlistModule } from "./modules/wishlist/wishlist.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => [
        {
          limit: configService.getOrThrow("throttleLimit", { infer: true }),
          ttl: configService.getOrThrow("throttleTtlSeconds", { infer: true }) * 1_000,
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    AccountModule,
    CatalogModule,
    CommerceModule,
    HealthModule,
    InventoryModule,
    WishlistModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
