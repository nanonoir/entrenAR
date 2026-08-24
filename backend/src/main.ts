import { INestApplication, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { configureHttpApplication } from "./app.setup";
import { loadAppConfig } from "./config/app.config";
import { REFRESH_COOKIE_NAME } from "./modules/auth/auth.service";

function configureSwagger(app: INestApplication): void {
  const documentConfig = new DocumentBuilder()
    .setTitle("EntrenAR Backend API")
    .setDescription("Phase 1 authentication and operational API contract.")
    .setVersion("1.0")
    .addBearerAuth(
      {
        bearerFormat: "JWT",
        description: "Use the short-lived access token.",
        scheme: "bearer",
        type: "http",
      },
      "access-token",
    )
    .addCookieAuth(REFRESH_COOKIE_NAME, { in: "cookie", type: "apiKey" }, "refresh-cookie")
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);

  SwaggerModule.setup("api/docs", app, document, {
    customSiteTitle: "EntrenAR API Docs",
    raw: false,
  });
}

async function bootstrap(): Promise<void> {
  const config = loadAppConfig();
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  configureHttpApplication(app, config);

  if (config.nodeEnv !== "production") {
    configureSwagger(app);
  }

  await app.listen(config.port, "0.0.0.0");
  Logger.log(`Backend listening on port ${config.port}.`, "Bootstrap");
}

void bootstrap();
