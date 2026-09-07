import type { INestApplication } from "@nestjs/common";
import type { AppConfig } from "./config/app.config";
import { json, urlencoded } from "express";
import helmet from "helmet";

import { requestIdMiddleware } from "./common/middleware/request-id.middleware";

export type CorsOriginValidator = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => void;

export function configureHttpApplication(app: INestApplication, config: AppConfig): void {
  app.setGlobalPrefix("api/v1", {
    exclude: ["health", "api/v1/health"],
  });
  app.use(helmet());
  app.enableCors({
    credentials: true,
    origin: createCorsOriginValidator(config.corsOrigins ?? [config.corsOrigin]),
  });
  app.use(requestIdMiddleware);
  app.use(json({ limit: config.bodyLimitBytes }));
  app.use(urlencoded({ extended: false, limit: config.bodyLimitBytes }));
}

export function createCorsOriginValidator(allowedOrigins: readonly string[]): CorsOriginValidator {
  const normalizedAllowedOrigins = new Set(
    allowedOrigins
      .map((origin) => normalizeOrigin(origin))
      .filter((origin): origin is string => origin !== undefined),
  );

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    callback(null, normalizedOrigin !== undefined && normalizedAllowedOrigins.has(normalizedOrigin));
  };
}

function normalizeOrigin(origin: string): string | undefined {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}
