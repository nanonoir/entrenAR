import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { configureHttpApplication } from "../src/app.setup";
import { loadAppConfig } from "../src/config/app.config";

describe("backend application (e2e)", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpApplication(app, loadAppConfig());
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports liveness independently of PostgreSQL", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "live" });
  });

  it("reports readiness after checking Dockerized PostgreSQL", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "ready" });
  });

  it("returns a structured validation envelope for an invalid login request", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      body: JSON.stringify({ email: "invalid-email", password: "short" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      issues: expect.arrayContaining([
        expect.objectContaining({ field: "email" }),
        expect.objectContaining({ field: "password" }),
      ]),
      message: "Request validation failed.",
      ok: false,
    });
  });
});
