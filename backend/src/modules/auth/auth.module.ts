import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import type { AppConfig } from "../../config/app.config";
import { UsersModule } from "../users/users.module";
import { AdminAuthController } from "./admin-auth.controller";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { NoopResetDelivery, RESET_DELIVERY_PORT } from "./reset-delivery.port";

@Module({
  controllers: [AdminAuthController, AuthController],
  exports: [JwtModule],
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        secret: configService.getOrThrow("jwtAccessSecret", { infer: true }),
      }),
    }),
    UsersModule,
  ],
  providers: [
    AuthService,
    {
      provide: RESET_DELIVERY_PORT,
      useClass: NoopResetDelivery,
    },
  ],
})
export class AuthModule {}
