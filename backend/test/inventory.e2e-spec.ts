import { randomUUID } from "node:crypto";

import * as bcrypt from "bcrypt";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { CatalogVisibility, Role, StockMode } from "../src/generated/prisma/enums";
import { AuthService } from "../src/modules/auth/auth.service";

describe("inventory administration (e2e)", () => {
  let app: INestApplication;
  let baseUrl: string;
  let accessToken: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const id = randomUUID();
    const prisma = moduleFixture.get(PrismaService);
    const email = `inventory-e2e-${id}@entrenar.test`;
    const password = "inventory_e2e_password";

    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: Role.ADMIN,
      },
    });
    productId = `inventory-e2e-product-${id}`;
    await prisma.product.create({
      data: {
        id: productId,
        name: "Inventory e2e fixture",
        publicSlug: `inventory-e2e-public-${id}`,
        quantity: 3,
        salePrice: "100.00",
        sku: `INV-E2E-PRODUCT-${id}`,
        slug: `inventory-e2e-${id}`,
        stockMode: StockMode.TRACKED,
        visibility: CatalogVisibility.HIDDEN,
      },
    });

    accessToken = (await moduleFixture.get(AuthService).login(email, password)).accessToken;
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(app, {
      bodyLimitBytes: 104_857,
      corsOrigin: "http://localhost:3000",
      databaseUrl: process.env["DATABASE_URL"] ?? "",
      jwtAccessSecret: process.env["JWT_ACCESS_SECRET"] ?? "",
      jwtAccessTtlSeconds: 900,
      jwtRefreshSecret: process.env["JWT_REFRESH_SECRET"] ?? "",
      jwtRefreshTtlSeconds: 2_592_000,
      nodeEnv: "test",
      port: 3001,
      throttleLimit: 100,
      throttleTtlSeconds: 60,
    });
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects fractional and client-authoritative resulting stock values with VALIDATION_ERROR", async () => {
    const response = await fetch(`${baseUrl}/api/v1/admin/inventory/${productId}`, {
      body: JSON.stringify({ operation: "replace", quantity: 1.5, resultingStock: 999, stockMode: "limited" }),
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      method: "PUT",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      code: "VALIDATION_ERROR",
      ok: false,
    }));
  });
});
