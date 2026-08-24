import type { INestApplication } from "@nestjs/common";
import type { AppConfig } from "./config/app.config";
import { json, urlencoded } from "express";
import helmet from "helmet";

import { requestIdMiddleware } from "./common/middleware/request-id.middleware";

export function configureHttpApplication(app: INestApplication, config: AppConfig): void {
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.enableCors({
    credentials: true,
    origin: config.corsOrigin,
  });
  app.use(requestIdMiddleware);
  app.use(json({ limit: config.bodyLimitBytes }));
  app.use(urlencoded({ extended: false, limit: config.bodyLimitBytes }));
}
