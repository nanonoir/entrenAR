import * as assert from "node:assert/strict";

import { createCorsOriginValidator } from "../app.setup";
import { getMercadoPagoConfig, isMercadoPagoConfigured, loadAppConfig, NODE_ENV } from "./app.config";

const validEnvironment = {
  DATABASE_URL: "postgresql://entrenar:password@127.0.0.1:5432/entrenar?schema=public",
  ADMIN_GATE_SIGNING_SECRET: "gate-secret-with-at-least-thirty-two-characters",
  JWT_ACCESS_SECRET: "access-secret-with-at-least-thirty-two-characters",
  JWT_REFRESH_SECRET: "refresh-secret-with-at-least-thirty-two-characters",
};

describe("app.config", () => {
  it("loads validated defaults", () => {
    const config = loadAppConfig(validEnvironment);

    assert.equal(config.nodeEnv, NODE_ENV.DEVELOPMENT);
    assert.equal(config.port, 3001);
    assert.equal(config.throttleLimit, 100);
    assert.equal(config.jwtAdminAccessTtlSeconds, 900);
    assert.equal(config.jwtAdminRefreshTtlSeconds, 1_800);
    assert.equal(config.refreshConcurrencyToleranceSeconds, 5);
    assert.equal(config.adminGateSigningSecret, validEnvironment.ADMIN_GATE_SIGNING_SECRET);
    assert.deepEqual(config.corsOrigins, ["http://localhost:3000"]);
  });

  it("parses configured frontend and legacy CORS origins", () => {
    const config = loadAppConfig({
      ...validEnvironment,
      CORS_ORIGIN: "https://legacy.example.com/",
      CORS_ORIGINS: "http://localhost:3000, https://preview.example.com/path",
      FRONTEND_URL: "https://store.example.com/",
    });

    assert.deepEqual(config.corsOrigins, [
      "http://localhost:3000",
      "https://preview.example.com",
      "https://store.example.com",
      "https://legacy.example.com",
    ]);
    assert.equal(config.frontendUrl, "https://store.example.com");
  });

  it("validates credentialed CORS origins and permits same-origin requests", () => {
    const validator = createCorsOriginValidator([
      "http://localhost:3000",
      "https://store.example.com",
    ]);
    const check = (origin: string | undefined): boolean => {
      let allowed = false;
      validator(origin, (error, result) => {
        assert.equal(error, null);
        allowed = result === true;
      });
      return allowed;
    };

    assert.equal(check(undefined), true);
    assert.equal(check("https://store.example.com/"), true);
    assert.equal(check("https://untrusted.example.com"), false);
  });

  describe("Mercado Pago", () => {
    const credentials = {
      MERCADOPAGO_ACCESS_TOKEN: "TEST-access-token-value",
      MERCADOPAGO_WEBHOOK_SECRET: "webhook-secret-value",
    };

    it("is unavailable when no Mercado Pago variable is set, including blank values", () => {
      assert.equal(loadAppConfig(validEnvironment).mercadoPago, undefined);
      assert.equal(isMercadoPagoConfigured(loadAppConfig({ ...validEnvironment, MERCADOPAGO_ACCESS_TOKEN: "  " })), false);
    });

    it("is ready when fully configured", () => {
      const config = loadAppConfig({ ...validEnvironment, ...credentials, MERCADOPAGO_ENVIRONMENT: "production", NODE_ENV: "production" });

      assert.deepEqual(getMercadoPagoConfig(config), {
        accessToken: credentials.MERCADOPAGO_ACCESS_TOKEN,
        environment: "production",
        webhookSecret: credentials.MERCADOPAGO_WEBHOOK_SECRET,
      });
    });

    it("defaults the environment to test outside production", () => {
      const config = loadAppConfig({ ...validEnvironment, ...credentials });

      assert.equal(config.mercadoPago?.environment, "test");
    });

    it("requires an explicit environment in production", () => {
      assert.throws(
        () => loadAppConfig({ ...validEnvironment, ...credentials, NODE_ENV: "production" }),
        /MERCADOPAGO_ENVIRONMENT is required/,
      );
    });

    it("fails validation for partial configuration", () => {
      assert.throws(
        () => loadAppConfig({ ...validEnvironment, MERCADOPAGO_ACCESS_TOKEN: credentials.MERCADOPAGO_ACCESS_TOKEN }),
        /MERCADOPAGO_WEBHOOK_SECRET is required/,
      );
      assert.throws(
        () => loadAppConfig({ ...validEnvironment, MERCADOPAGO_ENVIRONMENT: "test" }),
        /MERCADOPAGO_ACCESS_TOKEN is required[\s\S]*MERCADOPAGO_WEBHOOK_SECRET is required/,
      );
    });

    it("rejects an unknown environment without echoing credentials", () => {
      assert.throws(
        () => loadAppConfig({ ...validEnvironment, ...credentials, MERCADOPAGO_ENVIRONMENT: "sandbox" }),
        (error: Error) => /MERCADOPAGO_ENVIRONMENT must be test or production/.test(error.message)
          && !error.message.includes(credentials.MERCADOPAGO_ACCESS_TOKEN),
      );
    });
  });

  it("rejects missing JWT secrets", () => {
    assert.throws(
      () => loadAppConfig({ DATABASE_URL: validEnvironment.DATABASE_URL }),
      /Invalid backend configuration:[\s\S]*JWT_ACCESS_SECRET[\s\S]*JWT_REFRESH_SECRET/,
    );
  });
});
